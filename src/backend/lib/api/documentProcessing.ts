import { supabase } from '../supabase';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker once when the module loads
// Use local worker from the public folder (more reliable than CDN)
// In Vite, files in /public are served from the root
// The worker handles PDF parsing in a separate thread for better performance
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim() || '';
const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true,
}) : null;

/**
 * Detects chunks that are likely to be covers, indexes, or tables of contents.
 * Avoids generating embeddings for structural text with little semantic content.
 * 
 * This heuristic filters out non-semantic content to improve retrieval quality.
 * Structural chunks like TOCs and covers can degrade search results by matching
 * irrelevant queries with high similarity scores.
 * 
 * @param chunk - The text chunk to analyze
 * @returns true if the chunk is likely structural (should be skipped), false otherwise
 */
function isLikelyStructuralChunk(chunk: string): boolean {
  const text = chunk.trim();
  if (text.length === 0) {
    return true;
  }

  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
  const digitCount = (text.match(/\d/g) || []).length;
  const alphaCount = (text.match(/[a-zA-ZÁÉÍÓÚáéíóúÑñ]/g) || []).length;
  const digitRatio = (alphaCount + digitCount) === 0 ? 0 : digitCount / (alphaCount + digitCount);
  const lowerText = text.toLowerCase();
  const avgWordsPerLine = lines.length === 0 ? wordCount : wordCount / lines.length;

  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const meaningfulSentences = sentences.filter(sentence => sentence.split(/\s+/).filter(Boolean).length >= 6);
  const hasMeaningfulSentence = meaningfulSentences.length > 0;

  const tocKeywords = ['indice', 'índice', 'table of contents', 'contenido', 'contenidos', 'contents'];
  const coverKeywords = ['portada', 'cover', 'autor', 'author', 'versión', 'version', 'fecha', 'confidencial', 'revisión', 'revision'];

  const hasTocKeyword = tocKeywords.some(keyword => lowerText.includes(keyword));
  const hasCoverKeyword = coverKeywords.some(keyword => lowerText.includes(keyword));

  const numberingLines = lines.filter(line => /^(\d+(\.\d+)*|[ivxlcdm]+\.)\s+/i.test(line)).length;
  const dotLeaderLines = lines.filter(line => /\.{3,}\s*\d+$/.test(line)).length;
  const structuralLineRatio = lines.length === 0 ? 0 : (numberingLines + dotLeaderLines) / lines.length;

  const looksLikeToc =
    (hasTocKeyword && structuralLineRatio >= 0.2) ||
    (structuralLineRatio >= 0.6 && avgWordsPerLine <= 8 && lines.length >= 4) ||
    dotLeaderLines >= 3;

  const looksLikeCover =
    hasCoverKeyword &&
    wordCount <= 150 &&
    lines.length <= 15 &&
    !hasMeaningfulSentence;

  const highDigitShortText =
    digitRatio >= 0.6 &&
    wordCount <= 40 &&
    !hasMeaningfulSentence;

  const veryLowSemantic =
    uniqueWords <= 4 &&
    wordCount <= 10;

  if (hasMeaningfulSentence) {
    return false;
  }

  return looksLikeToc || looksLikeCover || highDigitShortText || veryLowSemantic;
}

/**
 * Processes a specific document: extracts text, creates chunks, and generates embeddings
 * 
 * Process flow:
 * 1. Fetch document metadata from database
 * 2. Check if document already has chunks (skip if already processed)
 * 3. Download file from Supabase Storage
 * 4. Extract text based on file type (PDF, TXT, MD)
 * 5. Split text into semantic chunks
 * 6. Filter out structural chunks (covers, TOCs, indexes)
 * 7. Generate embeddings for each semantic chunk
 * 8. Save chunks with embeddings to database
 * 
 * @param documentId - ID of the document to process
 * @param onProgress - Optional callback to report progress (0-100)
 * @returns true if processed successfully, false otherwise
 */
export async function processDocument(
  documentId: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  try {
    if (!openai) {
      console.warn('OpenAI is not configured, cannot process documents');
      return false;
    }

    // Step 1: Get the document from database
    // Fetch document metadata including file name and storage path
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      console.error(`Error fetching document ${documentId}:`, docError);
      return false;
    }

    // Step 2: Check if document already has chunks
    // Skip processing if chunks already exist (idempotent operation)
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('document_id', documentId)
      .limit(1);

    if (existingChunks && existingChunks.length > 0) {
      console.log(`Document ${doc.file_name} already has processed chunks`);
      onProgress?.(100);
      return true;
    }

    onProgress?.(10);

    // Step 3: Get file from Storage
    // Determine file extension to handle different file types
    const fileExt = doc.file_name.split('.').pop()?.toLowerCase();
    
    // Only process supported file formats
    if (!['txt', 'pdf', 'md'].includes(fileExt || '')) {
      console.log(`Skipping ${doc.file_name}: format ${fileExt} not supported`);
      return false;
    }

    // Use storage_path if available, otherwise construct path from file name
    const filePath = doc.storage_path || `documents/${doc.file_name}`;
    onProgress?.(20);

    // Download file content from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      console.warn(`Error downloading ${doc.file_name}:`, downloadError);
      return false;
    }

    onProgress?.(30);

    // Step 4: Extract text based on file type
    // Different extraction methods for PDF vs text files
    let text: string = '';
    
    try {
      if (fileExt === 'pdf') {
        console.log(`Procesando PDF: ${doc.file_name}`);
        const arrayBuffer = await fileData.arrayBuffer();
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        
        console.log(`PDF tiene ${pdfDocument.numPages} página(s)`);
        
        const textParts: string[] = [];
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          textParts.push(pageText);
        }
        
        text = textParts.join('\n\n');
      } else if (fileExt === 'md' || fileExt === 'txt') {
        text = await fileData.text();
      }

      // Validate that text was extracted successfully
      if (!text || text.trim().length === 0) {
        console.warn(`File ${doc.file_name} is empty or text could not be extracted`);
        return false;
      }

      console.log(`✓ Text extracted from ${doc.file_name}: ${text.length} characters`);
    } catch (extractionError) {
      console.error(`Error extracting text from ${doc.file_name}:`, extractionError);
      return false;
    }

    onProgress?.(50);

    // Step 5: Split text into intelligent chunks
    // Parameters: chunk size 1200 chars, overlap 200 chars
    // Overlap helps maintain context between chunks
    const chunks = splitIntoChunks(text, 1200, 200);

    // Filter out structural chunks (covers, TOCs, indexes)
    // These chunks don't contain semantic content and degrade search quality
    const semanticChunks = chunks.filter(chunk => !isLikelyStructuralChunk(chunk));
    const skippedChunks = chunks.length - semanticChunks.length;

    if (skippedChunks > 0) {
      console.log(`ⓘ Chunks discarded as structural for "${doc.file_name}": ${skippedChunks}/${chunks.length}`);
    }

    // If all chunks are structural, skip embedding generation
    // This is not an error - some documents may only contain structural content
    if (semanticChunks.length === 0) {
      console.warn(`⚠️ All chunks of "${doc.file_name}" appear to be structural. Skipping embedding generation.`);
      return true; // Not an error, simply no semantic content
    }

    onProgress?.(60);

    // Step 6: Generate embeddings and save chunks
    // Process each semantic chunk: generate embedding and save to database
    const totalChunks = semanticChunks.length;
    for (let i = 0; i < semanticChunks.length; i++) {
      const chunk = semanticChunks[i];
      
      try {
        // Generate embedding vector for this chunk using OpenAI
        // text-embedding-3-small creates 1536-dimensional vectors
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Save chunk to database with its embedding
        // The embedding is stored as a vector in PostgreSQL using pgvector extension
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert({
            document_id: doc.id,
            chunk_index: i,
            content: chunk,
            embedding: embedding,
          });

        if (insertError) {
          console.error(`❌ Error saving chunk ${i + 1}/${totalChunks} of ${doc.file_name}:`, insertError);
        }

        // Update progress: 60% base + up to 35% for chunk processing
        const progress = 60 + Math.floor((i + 1) / totalChunks * 35);
        onProgress?.(progress);
      } catch (chunkError) {
        console.error(`Error processing chunk ${i} of ${doc.file_name}:`, chunkError);
      }
    }

    onProgress?.(95);

    // Step 7: Verify that chunks were saved correctly
    // Count chunks with embeddings to confirm successful processing
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id)
      .not('embedding', 'is', null);
    
    console.log(`✓✓✓ Document "${doc.file_name}" processed successfully:`);
    console.log(`   → Chunks with embeddings saved: ${chunksCount || 0}`);

    onProgress?.(100);
    return true;
  } catch (error) {
    console.error(`Error procesando documento ${documentId}:`, error);
    return false;
  }
}

/**
 * Automatically processes documents: extracts text, creates chunks, and generates embeddings
 * Supports TXT, PDF, and Markdown (.md) files
 * 
 * This function processes all documents with 'processed' status that don't have chunks yet.
 * It's designed to be idempotent - documents already processed are skipped.
 * 
 * @returns Promise that resolves to true if processing completed, false on error
 */
export async function processDocumentsAutomatically(): Promise<boolean> {
  try {
    if (!openai) {
      console.warn('OpenAI is not configured, cannot process documents');
      return false;
    }

    // Step 1: Get ALL processed documents (no limit)
    // Only fetch documents with 'processed' status (ready for chunking)
    // Order by upload date descending (most recent first)
    const { data: allDocuments, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('status', 'processed')
      .order('uploaded_at', { ascending: false }); // Most recent first

    if (docsError || !allDocuments || allDocuments.length === 0) {
      console.log('No hay documentos con status "processed" para procesar');
      return false;
    }

    console.log(`Total de documentos encontrados: ${allDocuments.length}`);

    // Step 2: Check which documents already have chunks
    // Create a set of document IDs that already have chunks to skip them
    const allDocumentIds = allDocuments.map(doc => doc.id);
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('document_id')
      .in('document_id', allDocumentIds);

    // Build set of processed document IDs for fast lookup
    const processedDocIds = new Set(existingChunks?.map(chunk => chunk.document_id) || []);
    // Filter to only documents that need processing
    const documentsToProcess = allDocuments.filter(doc => !processedDocIds.has(doc.id));

    console.log(`Documents with chunks: ${processedDocIds.size}`);
    console.log(`Documents to process: ${documentsToProcess.length}`);

    if (documentsToProcess.length === 0) {
      console.log('All documents are already processed');
      return true; // Already processed
    }

    console.log(`Documents to process:`, documentsToProcess.map(d => d.file_name));

    // Step 3: Process each document
    // Process documents sequentially to avoid overwhelming the API
    for (const doc of documentsToProcess) {
      try {
        // Get file from Storage
        // Determine file extension to handle different file types
        const fileExt = doc.file_name.split('.').pop()?.toLowerCase();
        
        // Only process supported file formats: TXT, PDF, and Markdown
        if (!['txt', 'pdf', 'md'].includes(fileExt || '')) {
          console.log(`Skipping ${doc.file_name}: format ${fileExt} not supported. Only TXT, PDF, and MD are processed automatically`);
          continue;
        }

        // Find the file in Storage
        let filePath: string | null = null;

        // First, try to use storage_path if available
        // storage_path is the most reliable way to locate the file
        if (doc.storage_path) {
          filePath = doc.storage_path;
          console.log(`Using saved storage_path: ${filePath}`);
        } else {
          // If no storage_path, search for file by name
          // This is a fallback when storage_path is not set
          const { data: allFiles, error: listError } = await supabase.storage
            .from('documents')
            .list('documents', {
              limit: 100,
              sortBy: { column: 'created_at', order: 'desc' },
            });

          if (listError) {
            console.warn(`Error listing files:`, listError);
            continue;
          }

          if (!allFiles || allFiles.length === 0) {
            console.warn(`No files found in Storage to search`);
            continue;
          }

          // Find file that matches the document name
          // Extract file extension from document name
          const docNameParts = doc.file_name.toLowerCase().split('.');
          const docExt = docNameParts[docNameParts.length - 1]?.toLowerCase();

          // Search for files with the same extension
          // Match by extension since exact name match may not work
          const filesWithSameExt = allFiles.filter(file => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith(`.${docExt}`);
          });

          if (filesWithSameExt.length === 0) {
            console.warn(`No file found with extension .${docExt} for ${doc.file_name}`);
            console.log('Available files in Storage:', allFiles.map(f => f.name));
            continue;
          }

          // Use the most recent file with that extension
          // Assumes the last uploaded file is the correct one
          const matchingFile = filesWithSameExt
            .sort((a, b) => {
              const dateA = new Date(a.created_at || a.updated_at || 0).getTime();
              const dateB = new Date(b.created_at || b.updated_at || 0).getTime();
              return dateB - dateA; // Most recent first
            })[0];

          if (!matchingFile) {
            console.warn(`Could not determine file for ${doc.file_name}`);
            continue;
          }

          filePath = `documents/${matchingFile.name}`;
          console.log(`✓ File found: ${filePath} for document "${doc.file_name}"`);
        }

        // Get file content from Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(filePath);

        if (downloadError || !fileData) {
          console.warn(`Error downloading ${doc.file_name}:`, downloadError);
          continue;
        }

        // Extract text based on file type
        // Different extraction methods for PDF vs text files
        let text: string = '';

        try {
          if (fileExt === 'pdf') {
            // Process PDF using pdfjs-dist (browser-compatible)
            console.log(`Processing PDF: ${doc.file_name}`);
            const arrayBuffer = await fileData.arrayBuffer();
            
            // Worker is already configured at module initialization
            console.log(`Using worker: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
            
            try {
              // Load the PDF document
              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdfDocument = await loadingTask.promise;
              
              console.log(`PDF has ${pdfDocument.numPages} page(s)`);
              
              // Extract text from all pages
              // Process each page sequentially to extract text content
              const textParts: string[] = [];
              for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();
                // Join text items from the page into a single string
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ');
                textParts.push(pageText);
                console.log(`✓ Page ${pageNum}/${pdfDocument.numPages} processed`);
              }
              
              // Join all pages with double newlines
              text = textParts.join('\n\n');
            } catch (pdfError) {
              console.error(`Error processing PDF ${doc.file_name}:`, pdfError);
              throw pdfError;
            }
          } else if (fileExt === 'md' || fileExt === 'txt') {
            // Process Markdown or TXT (both are plain text)
            // Simply read as text string
            text = await fileData.text();
          } else {
            console.warn(`Format not supported: ${fileExt}`);
            continue;
          }

          // Validate extracted text
          if (!text || text.trim().length === 0) {
            console.warn(`File ${doc.file_name} is empty or text could not be extracted`);
            continue;
          }

          console.log(`✓ Text extracted from ${doc.file_name}: ${text.length} characters`);
        } catch (extractionError) {
          console.error(`Error extracting text from ${doc.file_name}:`, extractionError);
          continue;
        }

        // Step 4: Split into intelligent chunks (respecting paragraphs and sentences)
        // Larger chunk size and more generous overlap to maintain context
        const chunks = splitIntoChunks(text, 1200, 200);

        // Filter structural chunks (indexes/covers/TOC) before generating embeddings
        // This improves search quality by removing non-semantic content
        const semanticChunks = chunks.filter(chunk => !isLikelyStructuralChunk(chunk));
        const skippedChunks = chunks.length - semanticChunks.length;

        if (skippedChunks > 0) {
          console.log(`ⓘ Chunks discarded as structural for "${doc.file_name}": ${skippedChunks}/${chunks.length}`);
        }

        if (semanticChunks.length === 0) {
          console.warn(`⚠️ All chunks of "${doc.file_name}" appear to be structural (cover/index). Skipping embedding generation.`);
          continue;
        }

        // Step 5: Generate embeddings and save chunks
        // Process each semantic chunk sequentially
        for (let i = 0; i < semanticChunks.length; i++) {
          const chunk = semanticChunks[i];
          
          try {
            // Generate embedding vector for this chunk
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: chunk,
            });

            const embedding = embeddingResponse.data[0].embedding;

            // Save chunk to database
            // Note: Supabase/pgvector accepts the array directly
            const { error: insertError } = await supabase
              .from('document_chunks')
              .insert({
                document_id: doc.id,
                chunk_index: i,
                content: chunk,
                embedding: embedding, // Array of numbers directly
              });

            if (insertError) {
              console.error(`❌ Error saving chunk ${i + 1}/${chunks.length} of ${doc.file_name}:`, insertError);
              console.error('Error details:', JSON.stringify(insertError, null, 2));
            } else {
              // Log progress every 5 chunks or on last chunk
              if ((i + 1) % 5 === 0 || i === semanticChunks.length - 1) {
                console.log(`  → Chunk ${i + 1}/${semanticChunks.length} saved for ${doc.file_name}`);
              }
            }
          } catch (chunkError) {
            console.error(`Error processing chunk ${i} of ${doc.file_name}:`, chunkError);
            // Continue with next chunk
          }
        }

        // Verify that chunks were saved correctly
        // Count chunks with embeddings to confirm successful processing
        const { count: chunksCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id)
          .not('embedding', 'is', null);
        
        console.log(`✓✓✓ Document "${doc.file_name}" processed successfully:`);
        console.log(`   → Total chunks detected: ${chunks.length}`);
        console.log(`   → Chunks discarded as structural: ${skippedChunks}`);
        console.log(`   → Chunks with embeddings saved: ${chunksCount || 0}`);
        
        // Warn if not all semantic chunks were saved
        if (chunksCount !== semanticChunks.length) {
          console.warn(`⚠️ Warning: Attempted to create ${semanticChunks.length} useful chunks but only ${chunksCount} were saved successfully`);
        }
      } catch (docError) {
        console.error(`Error procesando documento ${doc.file_name}:`, docError);
        // Continuar con el siguiente documento
      }
    }

    return true;
  } catch (error) {
    console.error('Error en processDocumentsAutomatically:', error);
    return false;
  }
}

/**
 * Intelligently splits text into chunks, respecting paragraphs and sentences
 * to avoid information loss and cuts in the middle of words
 * 
 * Strategy:
 * 1. Normalize line breaks
 * 2. Split into paragraphs first
 * 3. For large paragraphs, split into sentences
 * 4. Build chunks respecting chunk size limits
 * 5. Use overlap to maintain context between chunks
 * 
 * @param text - The text to split into chunks
 * @param chunkSize - Maximum size of each chunk in characters
 * @param overlap - Number of characters to overlap between chunks for context
 * @returns Array of text chunks
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  // Normalize line breaks
  // Convert Windows (\r\n) and old Mac (\r) line breaks to Unix (\n)
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into paragraphs first (double newline or newline followed by space)
  // Paragraphs are natural semantic units that should be preserved
  const paragraphs = normalizedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let currentChunkSize = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    const paragraphSize = paragraph.length;
    
    // If paragraph is very large, split it into sentences
    // This prevents creating chunks that are too large
    if (paragraphSize > chunkSize) {
      // Save current chunk if it exists
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        // Start new chunk with overlap from previous
        currentChunk = getOverlapText(currentChunk, overlap);
        currentChunkSize = currentChunk.length;
      }
      
      // Split large paragraph into sentences
      const sentences = splitIntoSentences(paragraph);
      
      for (const sentence of sentences) {
        const sentenceSize = sentence.length;
        
        // If adding this sentence exceeds size, save current chunk
        if (currentChunkSize + sentenceSize + 1 > chunkSize && currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
          // Start new chunk with overlap
          currentChunk = getOverlapText(currentChunk, overlap);
          currentChunkSize = currentChunk.length;
        }
        
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ';
        }
        currentChunk += sentence;
        currentChunkSize = currentChunk.length;
      }
    } else {
      // Normal paragraph: check if it fits in current chunk
      const spaceNeeded = currentChunk.length > 0 ? paragraphSize + 2 : paragraphSize;
      
      if (currentChunkSize + spaceNeeded > chunkSize && currentChunk.trim().length > 0) {
        // Save current chunk and start a new one
        chunks.push(currentChunk.trim());
        // Start new chunk with overlap
        currentChunk = getOverlapText(currentChunk, overlap);
        currentChunkSize = currentChunk.length;
      }
      
      // Add paragraph to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n';
      }
      currentChunk += paragraph;
      currentChunkSize = currentChunk.length;
    }
  }
  
  // Add the last chunk if it exists
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Splits a long text into sentences, respecting sentence endings
 * Handles special cases like abbreviations that shouldn't split sentences
 * 
 * @param text - The text to split into sentences
 * @returns Array of sentences
 */
function splitIntoSentences(text: string): string[] {
  // List of common abbreviations that should not split sentences
  // These abbreviations end with periods but aren't sentence endings
  const abbreviations = ['Sr', 'Sra', 'Srta', 'Dr', 'Dra', 'Prof', 'Ing', 'Lic', 'etc', 'vs', 'p', 'ej', 'pág', 'págs'];
  
  // Split by periods, exclamation marks, or question marks followed by space
  // and followed by uppercase letter (start of new sentence)
  const sentenceEndings = /([.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = sentenceEndings.exec(text)) !== null) {
    const potentialSentence = text.slice(lastIndex, match.index + 1);
    
    // Check if the period is part of an abbreviation
    // Look at the last 10 characters before the period
    const beforePoint = potentialSentence.slice(-10).toLowerCase();
    const isAbbreviation = abbreviations.some(abbr => 
      beforePoint.endsWith(abbr.toLowerCase() + '.')
    );
    
    // Only split if it's not an abbreviation
    if (!isAbbreviation) {
      const sentence = potentialSentence.trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
  }
  
  // Add the last sentence
  const lastSentence = text.slice(lastIndex).trim();
  if (lastSentence.length > 0) {
    sentences.push(lastSentence);
  }
  
  // If no sentences were found, split by maximum size
  // Fallback for text without clear sentence boundaries
  if (sentences.length === 0) {
    // Split into fragments of maximum 800 characters at spaces
    const maxSize = 800;
    const fragments: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      const fragment = text.slice(currentIndex, currentIndex + maxSize);
      const lastSpace = fragment.lastIndexOf(' ');
      
      // If space is found in second half of fragment, split there
      // Otherwise, split at maxSize
      if (lastSpace > maxSize * 0.5 && currentIndex + maxSize < text.length) {
        fragments.push(text.slice(currentIndex, currentIndex + lastSpace).trim());
        currentIndex += lastSpace + 1;
      } else {
        fragments.push(fragment.trim());
        currentIndex += maxSize;
      }
    }
    
    return fragments.filter(f => f.length > 0);
  }
  
  return sentences;
}

/**
 * Gets overlap text from the end of a chunk
 * Searches for a natural cut point (sentence or paragraph boundary)
 * 
 * Overlap helps maintain context between chunks by including some text
 * from the previous chunk at the start of the next chunk.
 * 
 * @param chunk - The chunk to extract overlap from
 * @param overlapSize - Number of characters to include in overlap
 * @returns Overlap text starting from a natural boundary
 */
function getOverlapText(chunk: string, overlapSize: number): string {
  // If chunk is smaller than overlap size, return entire chunk
  if (chunk.length <= overlapSize) {
    return chunk;
  }
  
  // Take the last N characters
  const overlap = chunk.slice(-overlapSize);
  
  // Try to find a natural cut point
  // Prefer newlines, then periods, then spaces
  // This ensures overlap starts at a semantic boundary
  const firstSpace = overlap.indexOf(' ');
  const firstPeriod = overlap.indexOf('.');
  const firstNewline = overlap.indexOf('\n');
  
  let cutPoint = -1;
  // Prefer newlines (paragraph boundaries)
  if (firstNewline >= 0) {
    cutPoint = firstNewline + 1;
  } else if (firstPeriod >= 0) {
    // Then periods (sentence boundaries)
    cutPoint = firstPeriod + 1;
  } else if (firstSpace >= 0) {
    // Finally spaces (word boundaries)
    cutPoint = firstSpace + 1;
  }
  
  // If natural boundary found, start overlap from there
  if (cutPoint > 0) {
    return overlap.slice(cutPoint).trim();
  }
  
  // If no natural boundary, return overlap as-is
  return overlap.trim();
}

