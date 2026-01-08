import OpenAI from 'openai';
import { supabase } from '../supabase';
import { processDocumentsAutomatically } from './documentProcessing';

// Configuración de OpenAI
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim() || '';

if (!openaiApiKey) {
  console.warn('⚠️ OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file');
}

const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true, // Solo para MVP - en producción usar backend
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

interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding?: number[];
}

/**
 * Genera un embedding para el texto usando OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI no está configurado. Verifica VITE_OPENAI_API_KEY en tu archivo .env');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Error al generar el embedding. Verifica tu API key de OpenAI.');
  }
}

/**
 * Busca chunks similares usando pgvector en Supabase
 */
async function searchSimilarChunks(embedding: number[], limit: number = 3): Promise<DocumentChunk[]> {
  try {
    // Usar la función de búsqueda por similitud de pgvector
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    });

    if (error) {
      // Si la función RPC no existe, intentar búsqueda alternativa
      console.warn('RPC function not found, trying alternative search:', error);
      
      // Búsqueda alternativa: obtener todos los chunks y calcular similitud en el cliente
      // NOTA: Esto no es eficiente para producción, pero funciona para MVP
      const { data: allChunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content, embedding')
        .not('embedding', 'is', null)
        .limit(100); // Limitar para MVP

      if (fetchError) {
        throw fetchError;
      }

      if (!allChunks || allChunks.length === 0) {
        console.warn('No se encontraron chunks con embeddings en la base de datos');
        console.log('Esto significa que los documentos no han sido procesados aún.');
        return [];
      }

      console.log(`Encontrados ${allChunks.length} chunks con embeddings. Calculando similitud...`);

      // Calcular similitud coseno (simplificado para MVP)
      const chunksWithSimilarity = allChunks
        .map((chunk: any) => {
          // Los embeddings pueden venir como array o como string JSON desde Supabase
          let chunkEmbedding: number[] = [];
          
          if (Array.isArray(chunk.embedding)) {
            chunkEmbedding = chunk.embedding;
          } else if (typeof chunk.embedding === 'string') {
            try {
              chunkEmbedding = JSON.parse(chunk.embedding);
            } catch (e) {
              console.warn('Error parseando embedding como JSON:', e);
              return null;
            }
          } else {
            console.warn('Embedding en formato desconocido:', typeof chunk.embedding);
            return null;
          }

          if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
            return null;
          }
          
          // Verificar que los embeddings tengan la misma dimensión
          if (chunkEmbedding.length !== embedding.length) {
            console.warn(`Dimension mismatch: query=${embedding.length}, chunk=${chunkEmbedding.length}`);
            return null;
          }
          
          // Calcular similitud coseno
          const dotProduct = embedding.reduce((sum, val, i) => sum + val * (chunkEmbedding[i] || 0), 0);
          const magnitudeA = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
          const magnitudeB = Math.sqrt(chunkEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
          const similarity = magnitudeB > 0 && magnitudeA > 0 ? dotProduct / (magnitudeA * magnitudeB) : 0;

          return { ...chunk, similarity };
        })
        .filter((chunk: any) => chunk !== null)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      console.log(`Chunks con similitud calculada: ${chunksWithSimilarity.length}`);
      console.log(`Similitudes:`, chunksWithSimilarity.map((c: any) => c.similarity.toFixed(3)).slice(0, 5));

      // Filtrar por threshold y limitar resultados
      const filteredChunks = chunksWithSimilarity
        .filter((chunk: any) => chunk.similarity >= 0.3) // Threshold más bajo para MVP (0.3)
        .slice(0, limit)
        .map(({ similarity, ...chunk }: any) => chunk);

      console.log(`Chunks después de filtrar (threshold 0.3): ${filteredChunks.length}`);

      return filteredChunks;
    }

    return data || [];
  } catch (error) {
    console.error('Error searching similar chunks:', error);
    return [];
  }
}

/**
 * Obtiene información del documento desde su ID
 */
async function getDocumentInfo(documentId: string): Promise<{ file_name: string; department?: { name: string } } | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        file_name,
        departments (name)
      `)
      .eq('id', documentId)
      .single();

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
 * Envía una consulta usando RAG (Retrieval-Augmented Generation)
 * 
 * @param question - La pregunta del usuario
 * @param conversationHistory - Historial de conversación (opcional, para contexto)
 * @returns Respuesta de la IA con fuentes
 */
export async function queryChat(
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatQueryResponse> {
  try {
    if (!openai) {
      throw new Error('OpenAI no está configurado. Por favor, configura VITE_OPENAI_API_KEY en tu archivo .env');
    }

    // 1. Verificar que hay documentos en el sistema
    const { count: documentsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processed');

    if (!documentsCount || documentsCount === 0) {
      return {
        answer: 'No hay documentos en el sistema. Por favor, sube algunos documentos primero antes de hacer preguntas.',
        sources: [],
      };
    }

    // 2. Verificar que hay chunks procesados (con embeddings)
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!chunksCount || chunksCount === 0) {
      console.log(`No hay chunks procesados. Intentando procesar ${documentsCount} documento(s) automáticamente...`);
      
      // Intentar procesar documentos automáticamente
      const processed = await processDocumentsAutomatically();
      
      if (!processed) {
        console.warn('El procesamiento automático no pudo completarse');
        return {
          answer: `Hay ${documentsCount} documento(s) en el sistema, pero aún no están procesados para búsqueda.\n\nLos documentos necesitan ser procesados (extraer texto, dividir en chunks y generar embeddings) antes de poder hacer preguntas sobre ellos.\n\n**Solución:**\n1. Asegúrate de que los documentos sean archivos TXT, PDF o MD\n2. Verifica que la API key de OpenAI esté configurada correctamente\n3. Revisa la consola del navegador para ver errores específicos`,
          sources: [],
        };
      }

      // Esperar un momento para que se completen las inserciones
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verificar nuevamente después del procesamiento
      const { count: newChunksCount } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);

      if (!newChunksCount || newChunksCount === 0) {
        return {
          answer: `Se intentó procesar los documentos, pero no se pudieron crear chunks con embeddings.\n\n**Posibles causas:**\n- Los archivos no son TXT, PDF o MD\n- Error al generar embeddings con OpenAI\n- Error al guardar en la base de datos\n\nRevisa la consola del navegador para más detalles.`,
          sources: [],
        };
      }

      console.log(`✓ Procesamiento completado. Se crearon ${newChunksCount} chunks en total.`);
    } else {
      // SIEMPRE verificar si hay documentos nuevos sin procesar
      console.log(`Hay ${chunksCount} chunks existentes. Verificando si hay documentos nuevos sin procesar...`);
      
      const processed = await processDocumentsAutomatically();
      if (processed) {
        console.log('✓ Se procesaron documentos nuevos. Esperando a que se completen las inserciones...');
        // Esperar un momento para que se completen las inserciones
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verificar el nuevo conteo de chunks
        const { count: updatedChunksCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .not('embedding', 'is', null);
        
        console.log(`✓ Total de chunks actualizado: ${updatedChunksCount} (antes: ${chunksCount})`);
      } else {
        console.log('No hay documentos nuevos sin procesar');
      }
    }

    // 2. Generar embedding de la pregunta
    const questionEmbedding = await generateEmbedding(question);

    // 3. Buscar chunks similares
    const similarChunks = await searchSimilarChunks(questionEmbedding, 3);

    if (similarChunks.length === 0) {
      return {
        answer: 'No encontré información relevante en los documentos subidos para responder tu pregunta. Intenta reformularla o verifica que hay documentos procesados en el sistema.',
        sources: [],
      };
    }

    // 5. Construir el contexto con los chunks encontrados
    const context = similarChunks
      .map((chunk, index) => `[Documento ${index + 1}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    // 6. Obtener información de los documentos fuente
    const documentIds = [...new Set(similarChunks.map(chunk => chunk.document_id))];
    const documentInfos = await Promise.all(
      documentIds.map(id => getDocumentInfo(id))
    );

    const sources = documentInfos
      .filter((info): info is NonNullable<typeof info> => info !== null)
      .map((info, index) => ({
        title: info.file_name,
        excerpt: similarChunks.find(chunk => chunk.document_id === documentIds[index])?.content.substring(0, 150) || '',
      }));

    // 7. Construir el prompt con el contexto
    const systemPrompt = `Eres un asistente de IA especializado en responder preguntas basándote exclusivamente en la documentación proporcionada. 

INSTRUCCIONES:
- Responde SOLO usando la información proporcionada en el contexto
- Si la información no está en el contexto, di claramente que no tienes esa información
- Sé preciso y conciso
- Cita los documentos fuente cuando sea relevante
- Responde en el mismo idioma que la pregunta del usuario

CONTEXTO DE DOCUMENTOS:
${context}`;

    const userMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-3) // Últimas 3 preguntas para contexto
      .map(msg => ({ role: 'user' as const, content: msg.content }));

    // 8. Llamar a OpenAI Chat Completion API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages,
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    return {
      answer,
      sources,
    };
  } catch (error) {
    console.error('Error in queryChat:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Error al procesar la consulta. Por favor, verifica tu configuración de OpenAI.');
  }
}
