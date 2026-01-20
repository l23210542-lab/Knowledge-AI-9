import OpenAI from 'openai';
import { supabase } from '../supabase';

// OpenAI Configuration
// Load the API key from environment variables
// The key must be prefixed with VITE_ to be accessible in the browser
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim() || '';

if (!openaiApiKey) {
  console.warn('⚠️ OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file');
}

// Initialize OpenAI client if API key is available
// Note: dangerouslyAllowBrowser is set to true for MVP purposes only
// In production, API calls should be made from a backend server to keep the API key secure
const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true, // Only for MVP - in production use backend server
}) : null;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    title: string;
    excerpt: string;
  }[];
}

export interface ChatQueryResponse {
  answer: string;
  sources: {
    title: string;
    excerpt: string;
  }[];
}

/**
 * Represents a document chunk with its metadata and similarity score
 */
interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
  similarity?: number; // Calculated similarity score for the chunk (0-1 range)
}

/**
 * Generates an embedding vector for the given text using OpenAI's embedding model
 * Embeddings are numerical representations of text that capture semantic meaning
 * 
 * @param text - The text to generate an embedding for
 * @returns A promise that resolves to an array of numbers representing the embedding vector
 * @throws Error if OpenAI is not configured or if the API call fails
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI is not configured. Please verify VITE_OPENAI_API_KEY in your .env file');
  }

  try {
    // Call OpenAI API to generate embedding using text-embedding-3-small model
    // This model creates 1536-dimensional vectors that represent semantic meaning
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    // Return the embedding vector from the first (and only) result
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Error generating embedding. Please verify your OpenAI API key.');
  }
}

/**
 * Calculates the cosine similarity between two vectors
 * Cosine similarity measures the cosine of the angle between two vectors
 * Returns a value between -1 and 1, where 1 means identical direction
 * 
 * @param a - First vector (array of numbers)
 * @param b - Second vector (array of numbers)
 * @returns Cosine similarity score between 0 and 1 (0 if vectors are orthogonal, 1 if identical)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  // Vectors must have the same dimension to calculate similarity
  if (a.length !== b.length) {
    return 0;
  }
  
  // Calculate dot product: sum of products of corresponding elements
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  
  // Calculate magnitude (length) of each vector using Euclidean norm
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  // Avoid division by zero if either vector has zero magnitude
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  // Cosine similarity formula: dot product divided by product of magnitudes
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Searches for similar document chunks using pgvector similarity search in Supabase
 * Returns chunks with their calculated similarity scores
 * 
 * @param embedding - The query embedding vector to search for similar chunks
 * @param limit - Maximum number of chunks to return (default: 5)
 * @returns Promise that resolves to an array of DocumentChunk objects with similarity scores
 */
async function searchSimilarChunks(embedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
  try {
    // First, try to use the pgvector RPC function for efficient similarity search
    // This uses PostgreSQL's vector similarity operators for optimal performance
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.5, // Stricter threshold - only return chunks with similarity >= 0.5
      match_count: limit,
    });

    if (error) {
      // If the RPC function doesn't exist, fall back to alternative search method
      // This can happen if the database function hasn't been created yet
      console.warn('RPC function not found, trying alternative search:', error);
      
      // Alternative search: fetch all chunks and calculate similarity on the client side
      // NOTE: This is not efficient for production, but works for MVP
      // In production, the pgvector RPC function should be set up for better performance
      const { data: allChunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content, embedding')
        .not('embedding', 'is', null)
        .limit(200); // Increased limit to have more options for filtering

      if (fetchError) {
        throw fetchError;
      }

      if (!allChunks || allChunks.length === 0) {
        console.warn('No chunks with embeddings found in the database');
        console.log('This means documents have not been processed yet.');
        return [];
      }

      console.log(`Found ${allChunks.length} chunks with embeddings. Calculating similarity...`);

      // Calculate cosine similarity for all chunks
      // This processes each chunk to compute how similar it is to the query embedding
      const chunksWithSimilarity = allChunks
        .map((chunk: any) => {
          // Embeddings can come as arrays or JSON strings from Supabase
          // Handle both formats to ensure compatibility
          let chunkEmbedding: number[] = [];
          
          if (Array.isArray(chunk.embedding)) {
            // Already an array, use directly
            chunkEmbedding = chunk.embedding;
          } else if (typeof chunk.embedding === 'string') {
            // Parse JSON string to array
            try {
              chunkEmbedding = JSON.parse(chunk.embedding);
            } catch (e) {
              console.warn('Error parsing embedding as JSON:', e);
              return null;
            }
          } else {
            console.warn('Embedding in unknown format:', typeof chunk.embedding);
            return null;
          }

          // Validate that we have a valid embedding array
          if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
            return null;
          }
          
          // Verify that embeddings have the same dimension
          // Both query and chunk embeddings must be the same size for similarity calculation
          if (chunkEmbedding.length !== embedding.length) {
            console.warn(`Dimension mismatch: query=${embedding.length}, chunk=${chunkEmbedding.length}`);
            return null;
          }
          
          // Calculate cosine similarity between query embedding and chunk embedding
          const similarity = cosineSimilarity(embedding, chunkEmbedding);

          // Return chunk with similarity score attached
          return { ...chunk, similarity };
        })
        .filter((chunk: any) => chunk !== null)
        // Sort by similarity descending (most similar first)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      console.log(`Chunks with calculated similarity: ${chunksWithSimilarity.length}`);
      console.log(`Top similarities:`, chunksWithSimilarity.map((c: any) => c.similarity.toFixed(3)).slice(0, 10));

      // Return chunks with similarity (not filtered here, will be filtered later by document)
      // Return more chunks than requested to have options for document-level filtering
      return chunksWithSimilarity.slice(0, limit * 2) as DocumentChunk[];
    }

    // If RPC function works, process the results
    if (data && data.length > 0) {
      // If RPC function already returns similarity, use it
      // Otherwise, calculate it manually
      return data.map((chunk: any) => {
        if (chunk.similarity !== undefined) {
          // RPC function already calculated similarity
          return chunk as DocumentChunk;
        }
        // Calculate similarity if not included in response
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          const similarity = cosineSimilarity(embedding, chunk.embedding);
          return { ...chunk, similarity } as DocumentChunk;
        }
        return chunk as DocumentChunk;
      });
    }

    return [];
  } catch (error) {
    console.error('Error searching similar chunks:', error);
    return [];
  }
}

/**
 * Retrieves document information from the database using the document ID
 * Fetches the file name and associated department information
 * 
 * @param documentId - The unique identifier of the document
 * @returns Promise that resolves to document info object or null if not found
 */
async function getDocumentInfo(documentId: string): Promise<{ file_name: string; department?: { name: string } } | null> {
  try {
    // Query the documents table with a join to departments table
    // Uses Supabase's nested select syntax to get related department data
    const { data, error } = await supabase
      .from('documents')
      .select(`
        file_name,
        departments (name)
      `)
      .eq('id', documentId)
      .single(); // Expect exactly one result

    if (error) {
      console.error('Error fetching document info:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getDocumentInfo:', error);
    return null;
  }
}

/**
 * Detects if a message is a greeting (does not require RAG processing)
 * Greetings are handled separately to provide friendly responses without document search
 * 
 * @param message - The user's message to check
 * @returns true if the message is identified as a greeting, false otherwise
 */
function isGreeting(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // List of common greetings in multiple languages (English and Spanish)
  const greetings = [
    'hi',
    'hola',
    'hello',
    'hey',
    'buenos días',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'saludos',
    'qué tal',
    'que tal',
    'cómo estás',
    'como estas',
    'cómo estás?',
    'como estas?',
    'buen día',
    'buen dia',
    'buena tarde',
    'buena noche',
  ];
  
  // Check if the message is only a greeting (without additional content)
  // Remove punctuation to match greetings more flexibly
  const isOnlyGreeting = greetings.some(greeting => {
    const trimmed = lowerMessage.replace(/[.,!?;:]/g, '').trim();
    return trimmed === greeting || trimmed.startsWith(greeting + ' ');
  });
  
  // Also check if the message is very short and contains a greeting
  // This catches cases like "Hi there" or "Hola, cómo estás"
  const hasGreeting = greetings.some(greeting => lowerMessage.includes(greeting));
  const isShortMessage = lowerMessage.split(/\s+/).length <= 5;
  
  // Return true if it's a pure greeting or a short message containing a greeting
  return isOnlyGreeting || (hasGreeting && isShortMessage);
}

/**
 * Responds to greetings without using RAG (Retrieval-Augmented Generation)
 * Provides a friendly welcome message to start the conversation
 * Uses random selection to make responses feel more natural
 * 
 * @returns ChatQueryResponse with a greeting message and no sources
 */
function answerGreeting(): ChatQueryResponse {
  // Array of greeting responses in Spanish
  // Random selection adds variety to make the conversation feel more natural
  const greetings = [
    '¡Hola! 👋 Me da mucho gusto ayudarte. ¿En qué puedo asistirte hoy?',
    '¡Hola! 😊 Estoy aquí para ayudarte a encontrar información en tus documentos. ¿Qué te gustaría saber?',
    '¡Hola! Bienvenido. Cuéntame, ¿qué información necesitas buscar hoy?',
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  return {
    answer: randomGreeting,
    sources: [], // No sources needed for greetings
  };
}

/**
 * Detects if a question is about the system itself (does not require RAG)
 * System questions are answered directly without searching documents
 * Examples: "How many documents?", "How does the system work?"
 * 
 * @param question - The user's question to check
 * @returns true if the question is about the system, false otherwise
 */
function isSystemQuestion(question: string): boolean {
  const lowerQuestion = question.toLowerCase();
  
  // Keywords that indicate system-related questions
  // Includes variations with and without accents for Spanish
  const systemKeywords = [
    'cuántos documentos',
    'cuantos documentos',
    'qué documentos',
    'que documentos',
    'qué información puedo',
    'que información puedo',
    'cómo funciona el sistema',
    'como funciona el sistema',
    'qué tipos de documentos',
    'que tipos de documentos',
    'cuántos archivos',
    'cuantos archivos',
    'cuántos archivos hay',
    'cuantos archivos hay',
    'cuántos documentos hay',
    'cuantos documentos hay',
  ];
  
  // Check if any system keyword appears in the question
  return systemKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Answers questions about the system without using RAG
 * Handles meta-questions about the system itself, document counts, etc.
 * 
 * @param question - The system-related question to answer
 * @returns ChatQueryResponse with system information and no sources
 */
async function answerSystemQuestion(question: string): Promise<ChatQueryResponse> {
  const lowerQuestion = question.toLowerCase();
  
  // Handle document count questions
  // User wants to know how many documents are in the system
  if (lowerQuestion.includes('cuántos documentos') || lowerQuestion.includes('cuantos documentos') || 
      lowerQuestion.includes('cuántos archivos') || lowerQuestion.includes('cuantos archivos')) {
    // Count processed documents (only count documents that are ready for search)
    const { count: documentsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processed');
    
    // Count document chunks with embeddings (indexed content)
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    
    const docCount = documentsCount || 0;
    const chunkCount = chunksCount || 0;
    
    if (docCount === 0) {
      return {
        answer: 'Por ahora no hay documentos procesados en el sistema. ¿Te gustaría subir algunos documentos para empezar?',
        sources: [],
      };
    }
    
    // Return friendly response with document and chunk counts
    return {
      answer: `Actualmente tengo ${docCount} documento${docCount > 1 ? 's' : ''} procesado${docCount > 1 ? 's' : ''} en el sistema, con un total de ${chunkCount} fragmento${chunkCount > 1 ? 's' : ''} de información indexados. ¡Estoy listo para ayudarte a encontrar lo que necesitas! 😊`,
      sources: [],
    };
  }
  
  // Handle questions about what information can be queried
  // User wants to know what documents are available for querying
  if (lowerQuestion.includes('qué información puedo') || lowerQuestion.includes('que información puedo')) {
    const { data: documents } = await supabase
      .from('documents')
      .select('file_name, departments(name)')
      .eq('status', 'processed')
      .limit(10);
    
    if (!documents || documents.length === 0) {
      return {
        answer: 'Por ahora no tengo documentos disponibles. ¿Te gustaría subir algunos? Una vez que los subas, podré ayudarte a encontrar cualquier información que necesites en ellos.',
        sources: [],
      };
    }
    
    const docList = documents.map(doc => `• ${doc.file_name}`).join('\n');
    return {
      answer: `¡Claro! Puedo ayudarte a consultar información sobre estos documentos:\n\n${docList}\n\nSolo hazme una pregunta específica sobre el contenido de cualquiera de estos documentos y buscaré la información relevante para responderte. ¿Qué te gustaría saber? 😊`,
      sources: [],
    };
  }
  
  // Handle questions about how the system works
  // User wants to understand the RAG (Retrieval-Augmented Generation) process
  if (lowerQuestion.includes('cómo funciona') || lowerQuestion.includes('como funciona')) {
    return {
      answer: '¡Te explico cómo trabajo! 😊\n\nCuando me haces una pregunta:\n\n1. Analizo tu pregunta usando inteligencia artificial para entender qué buscas\n2. Busco en todos los documentos los fragmentos más relevantes a tu pregunta\n3. Genero una respuesta clara basada en la información que encontré\n4. Te muestro las fuentes de donde obtuve la información para que puedas verificarla\n\nBásicamente, soy como un asistente que lee todos tus documentos y te ayuda a encontrar la información que necesitas de forma rápida y precisa. ¿Hay algo específico que te gustaría buscar?',
      sources: [],
    };
  }
  
  // Handle questions about supported document types
  // User wants to know what file formats are supported
  if (lowerQuestion.includes('qué tipos de documentos') || lowerQuestion.includes('que tipos de documentos')) {
    return {
      answer: 'Acepto los siguientes tipos de documentos:\n\n• Archivos PDF (.pdf)\n• Archivos de texto (.txt)\n• Archivos Markdown (.md)\n\nUna vez que los subas, los proceso automáticamente para extraer su contenido y hacerlo buscable. ¡Es muy fácil! Solo súbelos y podrás hacer preguntas sobre ellos de inmediato.',
      sources: [],
    };
  }
  
  // Generic response for other system questions
  // Fallback for system questions that don't match specific patterns
  return {
    answer: '¡Claro! Estoy aquí para ayudarte. Puedes hacerme preguntas sobre los documentos que tengas subidos, o si necesitas ayuda con algo más específico del sistema, con gusto te ayudo. ¿Qué te gustaría saber?',
    sources: [],
  };
}

/**
 * Detects if the AI response indicates that no relevant information was found
 * Used to determine whether to show sources - if AI says it has no info, don't show sources
 * 
 * @param answer - The AI's response text to check
 * @returns true if the answer indicates no information was found, false otherwise
 */
function indicatesNoInformation(answer: string): boolean {
  const lowerAnswer = answer.toLowerCase();
  
  // Phrases that indicate the AI couldn't find relevant information
  // These phrases suggest the answer is not based on document content
  const noInfoPhrases = [
    'no tengo información',
    'no encontré información',
    'no tengo esa información',
    'no está en el contexto',
    'no está disponible',
    'no puedo responder',
    'no hay información',
    'no se encontró',
    'no se encuentra',
  ];
  
  // Check if any of these phrases appear in the answer
  return noInfoPhrases.some(phrase => lowerAnswer.includes(phrase));
}

/**
 * Sends a query using RAG (Retrieval-Augmented Generation)
 * This is the main function that processes user questions and returns AI responses
 * 
 * Process flow:
 * 1. Check if question is a greeting or system question (handle separately)
 * 2. Verify documents exist and are processed
 * 3. Generate embedding for the user's question
 * 4. Search for similar document chunks using vector similarity
 * 5. Filter and group chunks by document, selecting only highly relevant ones
 * 6. Build context from selected chunks
 * 7. Generate AI response using OpenAI with the context
 * 8. Return response with source citations
 * 
 * @param question - The user's question
 * @param conversationHistory - Optional conversation history for context
 * @returns Promise that resolves to ChatQueryResponse with answer and sources
 */
export async function queryChat(
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatQueryResponse> {
  try {
    if (!openai) {
      throw new Error('OpenAI is not configured. Please set VITE_OPENAI_API_KEY in your .env file');
    }

    // Step 0: Check if it's a greeting (doesn't require RAG)
    // Greetings get friendly responses without document search
    if (isGreeting(question)) {
      return answerGreeting();
    }

    // Step 0.1: Check if it's a system question (doesn't require RAG)
    // System questions are answered directly without document search
    if (isSystemQuestion(question)) {
      return await answerSystemQuestion(question);
    }

    // Step 1: Verify that documents exist in the system
    // Only count documents with 'processed' status (ready for search)
    const { count: documentsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processed');

    if (!documentsCount || documentsCount === 0) {
      return {
        answer: 'Por ahora no tengo documentos disponibles para consultar. ¿Te gustaría subir algunos documentos primero? Una vez que los subas, podré ayudarte a encontrar la información que necesitas.',
        sources: [],
      };
    }

    // Step 2: Verify that chunks are processed (have embeddings)
    // Chunks without embeddings cannot be searched
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!chunksCount || chunksCount === 0) {
      return {
        answer: `Veo que hay ${documentsCount} documento${documentsCount > 1 ? 's' : ''} en el sistema, pero aún se están procesando. 😊\n\nLos documentos se procesan automáticamente cuando los subes. Si acabas de subirlos, dale unos momentos para que terminen de procesarse. Una vez que estén listos, podré ayudarte a encontrar cualquier información que necesites.\n\n**Para verificar:**\n• Revisa en la página de "Subir Documentos" que los documentos hayan terminado de procesarse\n• Asegúrate de que sean archivos TXT, PDF o MD\n• Si pasan varios minutos y aún no se procesan, verifica que la configuración esté correcta\n\n¡Vuelve en un momento y estaré listo para ayudarte!`,
        sources: [],
      };
    }

    // Step 3: Generate embedding for the user's question
    // Convert the question text into a numerical vector representation
    const questionEmbedding = await generateEmbedding(question);

    // Step 4: Search for similar chunks (get more than needed for filtering options)
    // Fetch more chunks initially to have options for document-level filtering
    const similarChunks = await searchSimilarChunks(questionEmbedding, 10);

    if (similarChunks.length === 0) {
      return {
        answer: 'Hmm, no encontré información específica sobre eso en los documentos que tengo disponibles. ¿Podrías reformular tu pregunta o darme más detalles sobre lo que buscas? Estoy aquí para ayudarte a encontrar lo que necesitas.',
        sources: [],
      };
    }

    // Step 5: Filter and group chunks by document according to similarity
    // Minimum similarity threshold to consider a chunk relevant
    // Chunks below this threshold are likely not related to the question
    const MIN_SIMILARITY_THRESHOLD = 0.5;
    
    // Group chunks by document and find the maximum similarity per document
    // This allows us to select the best documents, not just the best chunks
    const chunksByDocument = new Map<string, { chunks: DocumentChunk[], maxSimilarity: number }>();
    
    for (const chunk of similarChunks) {
      const similarity = chunk.similarity || 0;
      
      // Only consider chunks with sufficient similarity
      // Skip chunks that are not relevant enough
      if (similarity < MIN_SIMILARITY_THRESHOLD) {
        continue;
      }
      
      const docId = chunk.document_id;
      const existing = chunksByDocument.get(docId);
      
      if (!existing) {
        // First chunk from this document
        chunksByDocument.set(docId, { chunks: [chunk], maxSimilarity: similarity });
      } else {
        // Add chunk to existing document group
        existing.chunks.push(chunk);
        // Update max similarity if this chunk is more similar
        if (similarity > existing.maxSimilarity) {
          existing.maxSimilarity = similarity;
        }
      }
    }

    // Sort documents by maximum similarity (highest to lowest)
    // This prioritizes documents with the most relevant content
    const sortedDocuments = Array.from(chunksByDocument.entries())
      .sort((a, b) => b[1].maxSimilarity - a[1].maxSimilarity);

    if (sortedDocuments.length === 0) {
      return {
        answer: 'No encontré información que coincida directamente con tu pregunta en los documentos disponibles. ¿Podrías ser un poco más específico sobre lo que necesitas? Por ejemplo, puedes mencionar el tema o el área de interés, y con gusto te ayudo a buscar la información relevante.',
        sources: [],
      };
    }

    // Step 6: Select documents to include in the response
    // Strategy: If multiple documents have high similarity (>= 0.6), include up to 2
    // If only one document has high similarity, include only that one
    // If documents have medium similarity (0.5-0.6), include only the best one
    const HIGH_SIMILARITY_THRESHOLD = 0.6;
    
    // Filter documents with high similarity scores
    const highSimilarityDocs = sortedDocuments.filter(([_, data]) => data.maxSimilarity >= HIGH_SIMILARITY_THRESHOLD);
    
    // Select documents based on similarity distribution
    const selectedDocuments = highSimilarityDocs.length > 1 
      ? highSimilarityDocs.slice(0, 2) // If multiple high similarity docs exist, include up to 2
      : sortedDocuments.slice(0, 1); // If only one or all have medium similarity, include only the best

    // Step 7: Build context from chunks of selected documents
    // Use the best chunk from each selected document for the context
    const contextChunks: DocumentChunk[] = [];
    for (const [docId, data] of selectedDocuments) {
      // Take the chunk with highest similarity from each selected document
      // Sort chunks by similarity descending and take the first one
      const bestChunk = data.chunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))[0];
      if (bestChunk) {
        contextChunks.push(bestChunk);
      }
    }

    // Format context for the AI prompt
    // Each document chunk is labeled and separated for clarity
    const context = contextChunks
      .map((chunk, index) => `[Documento ${index + 1}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    // Step 8: Get information about selected source documents
    // Fetch document metadata (file name, department) for source citations
    const selectedDocumentIds = selectedDocuments.map(([docId]) => docId);
    const documentInfos = await Promise.all(
      selectedDocumentIds.map(id => getDocumentInfo(id))
    );

    // Build sources array with document names and excerpts
    // Excerpts are taken from the best chunk of each document
    const sources = documentInfos
      .filter((info): info is NonNullable<typeof info> => info !== null)
      .map((info, index) => {
        const docId = selectedDocumentIds[index];
        const docData = chunksByDocument.get(docId);
        // Get the best chunk for the excerpt
        const bestChunk = docData?.chunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))[0];
        return {
          title: info.file_name,
          excerpt: bestChunk?.content.substring(0, 150) || '', // First 150 characters as excerpt
        };
      });

    // 7. Construir el prompt con el contexto
    const systemPrompt = `Eres un asistente de IA amigable y conversacional que ayuda a los usuarios a encontrar información en sus documentos. Tu personalidad es cálida, empática y natural, como si fueras un compañero de trabajo que está ahí para ayudar.

ESTILO DE COMUNICACIÓN:
- Sé natural y conversacional, como si estuvieras hablando con un amigo o colega
- Usa un tono amigable y accesible, evitando lenguaje robótico o demasiado formal
- Muestra entusiasmo genuino por ayudar
- Sé empático cuando no encuentres información específica
- Usa variación en tus respuestas para evitar sonar repetitivo
- Puedes usar emojis ocasionalmente para hacer la conversación más amena (pero con moderación)

INSTRUCCIONES:
- Si el usuario pregunta sobre algo que NO está en el contexto proporcionado:
  * NO digas "no tengo información" o "no encontré información" de forma directa y fría
  * En su lugar, sé empático y ofrece ayuda: "No encontré información específica sobre eso en los documentos que tengo, pero puedo ayudarte. ¿Podrías darme más detalles sobre lo que buscas? Por ejemplo, ¿es sobre [tema relacionado] o algo diferente?"
  * Sugiere formas alternativas de buscar o reformular la pregunta de manera amigable
  * Mantén un tono positivo y útil, como si realmente quisieras ayudar

- Si la información SÍ está en el contexto:
  * Responde de forma clara y completa usando la información proporcionada
  * Sé natural en tu explicación, como si estuvieras explicándoselo a un compañero
  * Si es apropiado, puedes hacer conexiones o dar contexto adicional de forma conversacional
  * Cita los documentos fuente cuando sea relevante, pero hazlo de forma natural

- Si el usuario pregunta más detalles sobre un tema:
  * Amplía la información de forma natural, conectando con lo que ya se ha discutido
  * Mantén el contexto de la conversación

- Si la pregunta es vaga o no específica:
  * Responde de forma amigable pidiendo aclaración: "Me gustaría ayudarte mejor. ¿Podrías contarme un poco más sobre [tema]? Por ejemplo, ¿qué aspecto específico te interesa?"

- Responde SOLO usando la información proporcionada en el contexto cuando sea relevante
- Responde en el mismo idioma que la pregunta del usuario
- Sé preciso pero también conversacional - no necesitas ser extremadamente conciso si puedes hacer la respuesta más natural

CONTEXTO DE DOCUMENTOS:
${context}`;

    // Step 9: Prepare conversation history for context
    // Only include history if current question requires document context
    // Don't include history if previous question was about the system
    const recentUserMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-2); // Last 2 questions for context
    
    // Filter system messages from history to avoid confusion
    // System questions don't provide useful context for document queries
    const relevantHistory = recentUserMessages
      .filter(msg => !isSystemQuestion(msg.content))
      .map(msg => ({ role: 'user' as const, content: msg.content }));
    
    const userMessages = relevantHistory;

    // Step 10: Call OpenAI Chat Completion API
    // Use GPT-4o-mini model for cost-effective, fast responses
    // System prompt contains instructions and document context
    // User messages provide conversation history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages,
        { role: 'user', content: question },
      ],
      temperature: 0.8, // Increased for more natural and varied responses
      max_tokens: 600, // Increased for more complete and natural responses
    });

    // Extract the AI's response from the completion
    const answer = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    // Step 11: Determine if sources should be shown
    // Don't show sources if the AI explicitly states it found no information
    // This prevents showing irrelevant sources when the AI couldn't answer
    const shouldShowSources = !indicatesNoInformation(answer) && sources.length > 0;

    return {
      answer,
      sources: shouldShowSources ? sources : [],
    };
  } catch (error) {
    console.error('Error in queryChat:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Error al procesar la consulta. Por favor, verifica tu configuración de OpenAI.');
  }
}
