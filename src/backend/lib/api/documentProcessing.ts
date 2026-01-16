import { supabase } from '../supabase';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js una sola vez al cargar el módulo
// Usar worker local desde la carpeta public (más confiable que CDN)
// En Vite, los archivos en /public se sirven desde la raíz
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim() || '';
const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true,
}) : null;

/**
 * Detecta chunks que probablemente sean portadas, índices o tablas de contenido.
 * Evita generar embeddings para texto estructural con poca semántica.
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
 * Procesa un documento específico: extrae texto, crea chunks y genera embeddings
 * @param documentId - ID del documento a procesar
 * @param onProgress - Callback opcional para reportar progreso (0-100)
 * @returns true si se procesó correctamente, false en caso contrario
 */
export async function processDocument(
  documentId: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  try {
    if (!openai) {
      console.warn('OpenAI no está configurado, no se pueden procesar documentos');
      return false;
    }

    // 1. Obtener el documento
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      console.error(`Error obteniendo documento ${documentId}:`, docError);
      return false;
    }

    // 2. Verificar si ya tiene chunks
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('document_id', documentId)
      .limit(1);

    if (existingChunks && existingChunks.length > 0) {
      console.log(`Documento ${doc.file_name} ya tiene chunks procesados`);
      onProgress?.(100);
      return true;
    }

    onProgress?.(10);

    // 3. Obtener el archivo de Storage
    const fileExt = doc.file_name.split('.').pop()?.toLowerCase();
    
    if (!['txt', 'pdf', 'md'].includes(fileExt || '')) {
      console.log(`Saltando ${doc.file_name}: formato ${fileExt} no soportado`);
      return false;
    }

    const filePath = doc.storage_path || `documents/${doc.file_name}`;
    onProgress?.(20);

    // Obtener el contenido del archivo
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      console.warn(`Error descargando ${doc.file_name}:`, downloadError);
      return false;
    }

    onProgress?.(30);

    // 4. Extraer texto según el tipo de archivo
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

      if (!text || text.trim().length === 0) {
        console.warn(`El archivo ${doc.file_name} está vacío o no se pudo extraer texto`);
        return false;
      }

      console.log(`✓ Texto extraído de ${doc.file_name}: ${text.length} caracteres`);
    } catch (extractionError) {
      console.error(`Error extrayendo texto de ${doc.file_name}:`, extractionError);
      return false;
    }

    onProgress?.(50);

    // 5. Dividir en chunks inteligentemente
    const chunks = splitIntoChunks(text, 1200, 200);

    // Filtrar chunks estructurales
    const semanticChunks = chunks.filter(chunk => !isLikelyStructuralChunk(chunk));
    const skippedChunks = chunks.length - semanticChunks.length;

    if (skippedChunks > 0) {
      console.log(`ⓘ Chunks descartados por estructurales para "${doc.file_name}": ${skippedChunks}/${chunks.length}`);
    }

    if (semanticChunks.length === 0) {
      console.warn(`⚠️ Todos los chunks de "${doc.file_name}" parecen estructurales. Se omite generación de embeddings.`);
      return true; // No es un error, simplemente no hay contenido semántico
    }

    onProgress?.(60);

    // 6. Generar embeddings y guardar chunks
    const totalChunks = semanticChunks.length;
    for (let i = 0; i < semanticChunks.length; i++) {
      const chunk = semanticChunks[i];
      
      try {
        // Generar embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Guardar chunk en la base de datos
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert({
            document_id: doc.id,
            chunk_index: i,
            content: chunk,
            embedding: embedding,
          });

        if (insertError) {
          console.error(`❌ Error guardando chunk ${i + 1}/${totalChunks} de ${doc.file_name}:`, insertError);
        }

        // Actualizar progreso
        const progress = 60 + Math.floor((i + 1) / totalChunks * 35);
        onProgress?.(progress);
      } catch (chunkError) {
        console.error(`Error procesando chunk ${i} de ${doc.file_name}:`, chunkError);
      }
    }

    onProgress?.(95);

    // 7. Verificar que los chunks se guardaron correctamente
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id)
      .not('embedding', 'is', null);
    
    console.log(`✓✓✓ Documento "${doc.file_name}" procesado exitosamente:`);
    console.log(`   → Chunks con embeddings guardados: ${chunksCount || 0}`);

    onProgress?.(100);
    return true;
  } catch (error) {
    console.error(`Error procesando documento ${documentId}:`, error);
    return false;
  }
}

/**
 * Procesa documentos automáticamente: extrae texto, crea chunks y genera embeddings
 * Soporta archivos TXT, PDF y Markdown (.md)
 */
export async function processDocumentsAutomatically(): Promise<boolean> {
  try {
    if (!openai) {
      console.warn('OpenAI no está configurado, no se pueden procesar documentos');
      return false;
    }

    // 1. Obtener TODOS los documentos procesados (sin límite)
    const { data: allDocuments, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('status', 'processed')
      .order('uploaded_at', { ascending: false }); // Más recientes primero

    if (docsError || !allDocuments || allDocuments.length === 0) {
      console.log('No hay documentos con status "processed" para procesar');
      return false;
    }

    console.log(`Total de documentos encontrados: ${allDocuments.length}`);

    // 2. Verificar cuáles documentos ya tienen chunks
    const allDocumentIds = allDocuments.map(doc => doc.id);
    const { data: existingChunks } = await supabase
      .from('document_chunks')
      .select('document_id')
      .in('document_id', allDocumentIds);

    const processedDocIds = new Set(existingChunks?.map(chunk => chunk.document_id) || []);
    const documentsToProcess = allDocuments.filter(doc => !processedDocIds.has(doc.id));

    console.log(`Documentos con chunks: ${processedDocIds.size}`);
    console.log(`Documentos sin procesar: ${documentsToProcess.length}`);

    if (documentsToProcess.length === 0) {
      console.log('Todos los documentos ya están procesados');
      return true; // Ya están procesados
    }

    console.log(`Documentos a procesar:`, documentsToProcess.map(d => d.file_name));

    // 3. Procesar cada documento
    for (const doc of documentsToProcess) {
      try {
        // Obtener el archivo de Storage
        const fileExt = doc.file_name.split('.').pop()?.toLowerCase();
        
        // Procesar solo archivos soportados: TXT, PDF y Markdown
        if (!['txt', 'pdf', 'md'].includes(fileExt || '')) {
          console.log(`Saltando ${doc.file_name}: formato ${fileExt} no soportado. Solo se procesan TXT, PDF y MD automáticamente`);
          continue;
        }

        // Buscar el archivo en Storage
        let filePath: string | null = null;

        // Primero intentar usar storage_path si está disponible
        if (doc.storage_path) {
          filePath = doc.storage_path;
          console.log(`Usando storage_path guardado: ${filePath}`);
        } else {
          // Si no hay storage_path, buscar el archivo por nombre
          const { data: allFiles, error: listError } = await supabase.storage
            .from('documents')
            .list('documents', {
              limit: 100,
              sortBy: { column: 'created_at', order: 'desc' },
            });

          if (listError) {
            console.warn(`Error listando archivos:`, listError);
            continue;
          }

          if (!allFiles || allFiles.length === 0) {
            console.warn(`No hay archivos en Storage para buscar`);
            continue;
          }

          // Buscar el archivo que coincida con el nombre del documento
          const docNameParts = doc.file_name.toLowerCase().split('.');
          const docExt = docNameParts[docNameParts.length - 1]?.toLowerCase();

          // Buscar archivos con la misma extensión
          const filesWithSameExt = allFiles.filter(file => {
            const fileName = file.name.toLowerCase();
            return fileName.endsWith(`.${docExt}`);
          });

          if (filesWithSameExt.length === 0) {
            console.warn(`No se encontró ningún archivo con extensión .${docExt} para ${doc.file_name}`);
            console.log('Archivos disponibles en Storage:', allFiles.map(f => f.name));
            continue;
          }

          // Usar el archivo más reciente con esa extensión
          // (asumiendo que el último subido es el correcto)
          const matchingFile = filesWithSameExt
            .sort((a, b) => {
              const dateA = new Date(a.created_at || a.updated_at || 0).getTime();
              const dateB = new Date(b.created_at || b.updated_at || 0).getTime();
              return dateB - dateA; // Más reciente primero
            })[0];

          if (!matchingFile) {
            console.warn(`No se pudo determinar el archivo para ${doc.file_name}`);
            continue;
          }

          filePath = `documents/${matchingFile.name}`;
          console.log(`✓ Archivo encontrado: ${filePath} para documento "${doc.file_name}"`);
        }

        // Obtener el contenido del archivo
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(filePath);

        if (downloadError || !fileData) {
          console.warn(`Error descargando ${doc.file_name}:`, downloadError);
          continue;
        }

        // Extraer texto según el tipo de archivo
        let text: string = '';

        try {
          if (fileExt === 'pdf') {
            // Procesar PDF usando pdfjs-dist (compatible con navegador)
            console.log(`Procesando PDF: ${doc.file_name}`);
            const arrayBuffer = await fileData.arrayBuffer();
            
            // El worker ya está configurado al inicio del módulo
            console.log(`Usando worker: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
            
            try {
              // Cargar el documento PDF
              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdfDocument = await loadingTask.promise;
              
              console.log(`PDF tiene ${pdfDocument.numPages} página(s)`);
              
              // Extraer texto de todas las páginas
              const textParts: string[] = [];
              for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ');
                textParts.push(pageText);
                console.log(`✓ Página ${pageNum}/${pdfDocument.numPages} procesada`);
              }
              
              text = textParts.join('\n\n');
            } catch (pdfError) {
              console.error(`Error procesando PDF ${doc.file_name}:`, pdfError);
              throw pdfError;
            }
          } else if (fileExt === 'md' || fileExt === 'txt') {
            // Procesar Markdown o TXT (ambos son texto plano)
            text = await fileData.text();
          } else {
            console.warn(`Formato no soportado: ${fileExt}`);
            continue;
          }

          if (!text || text.trim().length === 0) {
            console.warn(`El archivo ${doc.file_name} está vacío o no se pudo extraer texto`);
            continue;
          }

          console.log(`✓ Texto extraído de ${doc.file_name}: ${text.length} caracteres`);
        } catch (extractionError) {
          console.error(`Error extrayendo texto de ${doc.file_name}:`, extractionError);
          continue;
        }

        // 4. Dividir en chunks inteligentemente (respetando párrafos y oraciones)
        // Tamaño mayor y overlap más generoso para mantener contexto
        const chunks = splitIntoChunks(text, 1200, 200);

        // Filtrar chunks estructurales (índices/portadas/TOC) antes de generar embeddings
        const semanticChunks = chunks.filter(chunk => !isLikelyStructuralChunk(chunk));
        const skippedChunks = chunks.length - semanticChunks.length;

        if (skippedChunks > 0) {
          console.log(`ⓘ Chunks descartados por estructurales para "${doc.file_name}": ${skippedChunks}/${chunks.length}`);
        }

        if (semanticChunks.length === 0) {
          console.warn(`⚠️ Todos los chunks de "${doc.file_name}" parecen estructurales (portada/índice). Se omite generación de embeddings.`);
          continue;
        }

        // 5. Generar embeddings y guardar chunks
        for (let i = 0; i < semanticChunks.length; i++) {
          const chunk = semanticChunks[i];
          
          try {
            // Generar embedding
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: chunk,
            });

            const embedding = embeddingResponse.data[0].embedding;

            // Guardar chunk en la base de datos
            // Nota: Supabase/pgvector acepta el array directamente
            const { error: insertError } = await supabase
              .from('document_chunks')
              .insert({
                document_id: doc.id,
                chunk_index: i,
                content: chunk,
                embedding: embedding, // Array de números directamente
              });

            if (insertError) {
              console.error(`❌ Error guardando chunk ${i + 1}/${chunks.length} de ${doc.file_name}:`, insertError);
              console.error('Detalles del error:', JSON.stringify(insertError, null, 2));
            } else {
              if ((i + 1) % 5 === 0 || i === semanticChunks.length - 1) {
                console.log(`  → Chunk ${i + 1}/${semanticChunks.length} guardado para ${doc.file_name}`);
              }
            }
          } catch (chunkError) {
            console.error(`Error procesando chunk ${i} de ${doc.file_name}:`, chunkError);
            // Continuar con el siguiente chunk
          }
        }

        // Verificar que los chunks se guardaron correctamente
        const { count: chunksCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id)
          .not('embedding', 'is', null);
        
        console.log(`✓✓✓ Documento "${doc.file_name}" procesado exitosamente:`);
        console.log(`   → Chunks totales detectados: ${chunks.length}`);
        console.log(`   → Chunks descartados por estructurales: ${skippedChunks}`);
        console.log(`   → Chunks con embeddings guardados: ${chunksCount || 0}`);
        
        if (chunksCount !== semanticChunks.length) {
          console.warn(`⚠️ Advertencia: Se intentaron crear ${semanticChunks.length} chunks útiles pero solo ${chunksCount} se guardaron correctamente`);
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
 * Divide el texto en chunks inteligentemente, respetando párrafos y oraciones
 * para evitar pérdida de información y cortes en medio de palabras
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  // Normalizar saltos de línea
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Dividir en párrafos primero (doble salto de línea o salto de línea seguido de espacio)
  const paragraphs = normalizedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let currentChunkSize = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    const paragraphSize = paragraph.length;
    
    // Si el párrafo es muy grande, dividirlo en oraciones
    if (paragraphSize > chunkSize) {
      // Guardar el chunk actual si existe
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        // Iniciar nuevo chunk con overlap del anterior
        currentChunk = getOverlapText(currentChunk, overlap);
        currentChunkSize = currentChunk.length;
      }
      
      // Dividir el párrafo grande en oraciones
      const sentences = splitIntoSentences(paragraph);
      
      for (const sentence of sentences) {
        const sentenceSize = sentence.length;
        
        // Si agregar esta oración excede el tamaño, guardar chunk actual
        if (currentChunkSize + sentenceSize + 1 > chunkSize && currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
          // Iniciar nuevo chunk con overlap
          currentChunk = getOverlapText(currentChunk, overlap);
          currentChunkSize = currentChunk.length;
        }
        
        // Agregar oración al chunk actual
        if (currentChunk.length > 0) {
          currentChunk += ' ';
        }
        currentChunk += sentence;
        currentChunkSize = currentChunk.length;
      }
    } else {
      // Párrafo normal: verificar si cabe en el chunk actual
      const spaceNeeded = currentChunk.length > 0 ? paragraphSize + 2 : paragraphSize;
      
      if (currentChunkSize + spaceNeeded > chunkSize && currentChunk.trim().length > 0) {
        // Guardar chunk actual y empezar uno nuevo
        chunks.push(currentChunk.trim());
        // Iniciar nuevo chunk con overlap
        currentChunk = getOverlapText(currentChunk, overlap);
        currentChunkSize = currentChunk.length;
      }
      
      // Agregar párrafo al chunk actual
      if (currentChunk.length > 0) {
        currentChunk += '\n\n';
      }
      currentChunk += paragraph;
      currentChunkSize = currentChunk.length;
    }
  }
  
  // Agregar el último chunk si existe
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Divide un texto largo en oraciones, respetando puntos finales
 * Maneja casos especiales como abreviaciones
 */
function splitIntoSentences(text: string): string[] {
  // Lista de abreviaciones comunes que no deben dividir oraciones
  const abbreviations = ['Sr', 'Sra', 'Srta', 'Dr', 'Dra', 'Prof', 'Ing', 'Lic', 'etc', 'vs', 'p', 'ej', 'pág', 'págs'];
  
  // Dividir por puntos, signos de exclamación o interrogación seguidos de espacio
  // y que estén seguidos de mayúscula (inicio de nueva oración)
  const sentenceEndings = /([.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = sentenceEndings.exec(text)) !== null) {
    const potentialSentence = text.slice(lastIndex, match.index + 1);
    
    // Verificar si el punto es parte de una abreviación
    const beforePoint = potentialSentence.slice(-10).toLowerCase();
    const isAbbreviation = abbreviations.some(abbr => 
      beforePoint.endsWith(abbr.toLowerCase() + '.')
    );
    
    if (!isAbbreviation) {
      const sentence = potentialSentence.trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
  }
  
  // Agregar la última oración
  const lastSentence = text.slice(lastIndex).trim();
  if (lastSentence.length > 0) {
    sentences.push(lastSentence);
  }
  
  // Si no se encontraron oraciones, dividir por tamaño máximo
  if (sentences.length === 0) {
    // Dividir en fragmentos de máximo 800 caracteres en espacios
    const maxSize = 800;
    const fragments: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      const fragment = text.slice(currentIndex, currentIndex + maxSize);
      const lastSpace = fragment.lastIndexOf(' ');
      
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
 * Obtiene el texto de overlap desde el final de un chunk
 * Busca un punto de corte natural (oración o párrafo)
 */
function getOverlapText(chunk: string, overlapSize: number): string {
  if (chunk.length <= overlapSize) {
    return chunk;
  }
  
  // Tomar los últimos N caracteres
  const overlap = chunk.slice(-overlapSize);
  
  // Intentar encontrar un punto de corte natural
  // Buscar el primer espacio, punto o salto de línea
  const firstSpace = overlap.indexOf(' ');
  const firstPeriod = overlap.indexOf('.');
  const firstNewline = overlap.indexOf('\n');
  
  let cutPoint = -1;
  if (firstNewline >= 0) {
    cutPoint = firstNewline + 1;
  } else if (firstPeriod >= 0) {
    cutPoint = firstPeriod + 1;
  } else if (firstSpace >= 0) {
    cutPoint = firstSpace + 1;
  }
  
  if (cutPoint > 0) {
    return overlap.slice(cutPoint).trim();
  }
  
  return overlap.trim();
}

