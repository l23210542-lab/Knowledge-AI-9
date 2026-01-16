import OpenAI from 'openai';
import { supabase } from '../supabase';

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
 * Detecta si el mensaje es un saludo (no requiere RAG)
 */
function isGreeting(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
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
  
  // Verificar si el mensaje es solo un saludo (sin más contenido)
  const isOnlyGreeting = greetings.some(greeting => {
    const trimmed = lowerMessage.replace(/[.,!?;:]/g, '').trim();
    return trimmed === greeting || trimmed.startsWith(greeting + ' ');
  });
  
  // También verificar si el mensaje es muy corto y contiene un saludo
  const hasGreeting = greetings.some(greeting => lowerMessage.includes(greeting));
  const isShortMessage = lowerMessage.split(/\s+/).length <= 5;
  
  return isOnlyGreeting || (hasGreeting && isShortMessage);
}

/**
 * Responde a saludos sin usar RAG
 */
function answerGreeting(): ChatQueryResponse {
  return {
    answer: '¡Hola! Bienvenido. Estoy aquí para ayudarte. ¿Tienes alguna pregunta específica en la que pueda asistirte?',
    sources: [],
  };
}

/**
 * Detecta si una pregunta es sobre el sistema mismo (no requiere RAG)
 */
function isSystemQuestion(question: string): boolean {
  const lowerQuestion = question.toLowerCase();
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
  
  return systemKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Responde preguntas sobre el sistema sin usar RAG
 */
async function answerSystemQuestion(question: string): Promise<ChatQueryResponse> {
  const lowerQuestion = question.toLowerCase();
  
  // Contar documentos
  if (lowerQuestion.includes('cuántos documentos') || lowerQuestion.includes('cuantos documentos') || 
      lowerQuestion.includes('cuántos archivos') || lowerQuestion.includes('cuantos archivos')) {
    const { count: documentsCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processed');
    
    const { count: chunksCount } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    
    return {
      answer: `Actualmente hay ${documentsCount || 0} documento(s) procesado(s) en el sistema, con un total de ${chunksCount || 0} fragmento(s) de información indexados para búsqueda.`,
      sources: [],
    };
  }
  
  // Información sobre qué se puede consultar
  if (lowerQuestion.includes('qué información puedo') || lowerQuestion.includes('que información puedo')) {
    const { data: documents } = await supabase
      .from('documents')
      .select('file_name, departments(name)')
      .eq('status', 'processed')
      .limit(10);
    
    if (!documents || documents.length === 0) {
      return {
        answer: 'Actualmente no hay documentos en el sistema. Puedes subir documentos para que el sistema pueda responder preguntas sobre su contenido.',
        sources: [],
      };
    }
    
    const docList = documents.map(doc => `• ${doc.file_name}`).join('\n');
    return {
      answer: `Puedes consultar información sobre los siguientes documentos:\n\n${docList}\n\nPuedes hacer preguntas específicas sobre el contenido de cualquiera de estos documentos y el sistema buscará la información relevante para responderte.`,
      sources: [],
    };
  }
  
  // Cómo funciona el sistema
  if (lowerQuestion.includes('cómo funciona') || lowerQuestion.includes('como funciona')) {
    return {
      answer: 'El sistema de búsqueda utiliza inteligencia artificial para buscar información relevante en los documentos subidos. Cuando haces una pregunta, el sistema:\n\n1. Analiza tu pregunta usando embeddings\n2. Busca los fragmentos más relevantes en los documentos\n3. Genera una respuesta basada en la información encontrada\n4. Te muestra las fuentes de donde obtuvo la información',
      sources: [],
    };
  }
  
  // Tipos de documentos
  if (lowerQuestion.includes('qué tipos de documentos') || lowerQuestion.includes('que tipos de documentos')) {
    return {
      answer: 'El sistema acepta los siguientes tipos de documentos:\n\n• Archivos PDF (.pdf)\n• Archivos de texto (.txt)\n• Archivos Markdown (.md)\n\nUna vez subidos, estos documentos son procesados automáticamente para extraer su contenido y hacerlo buscable.',
      sources: [],
    };
  }
  
  // Respuesta genérica para preguntas del sistema
  return {
    answer: 'Esta es una pregunta sobre el sistema. Puedes consultar información sobre los documentos subidos haciendo preguntas específicas sobre su contenido.',
    sources: [],
  };
}

/**
 * Detecta si la respuesta indica que no se encontró información relevante
 */
function indicatesNoInformation(answer: string): boolean {
  const lowerAnswer = answer.toLowerCase();
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
  
  return noInfoPhrases.some(phrase => lowerAnswer.includes(phrase));
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

    // 0. Verificar si es un saludo (no requiere RAG)
    if (isGreeting(question)) {
      return answerGreeting();
    }

    // 0.1. Verificar si es una pregunta sobre el sistema (no requiere RAG)
    if (isSystemQuestion(question)) {
      return await answerSystemQuestion(question);
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
      return {
        answer: `Hay ${documentsCount} documento(s) en el sistema, pero aún no están procesados para búsqueda.\n\nLos documentos se procesan automáticamente cuando los subes. Si acabas de subir documentos, espera a que terminen de procesarse antes de hacer preguntas.\n\n**Solución:**\n1. Verifica en la página de "Subir Documentos" que los documentos hayan terminado de procesarse\n2. Asegúrate de que los documentos sean archivos TXT, PDF o MD\n3. Verifica que la API key de OpenAI esté configurada correctamente`,
        sources: [],
      };
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
- Si el usuario inicia la conversacion con un saludo, responde con un saludo de bienvenida y ofrece ayuda para comenzar a hacer preguntas.
- Si la pregunta es sobre el sistema mismo, responde usando la información proporcionada en el contexto.
- Si la pregunta no especifica un tema en especifico, responde con un mensaje sugiriendo que el usuario especifique el tema de la pregunta.
- Si el usuario pregunta sobre un tema que no está en el contexto, responde con un mensaje sugiriendo que el usuario especifique el tema de la pregunta.
- Responde SOLO usando la información proporcionada en el contexto
- Si la información no está en el contexto, di que no tienes esa información, pero que puedes consultar la documentación para obtener más información e inclusive proporciona una sugerencia de como buscar la información en la documentación.
- Sé preciso y conciso
- Si el usuario pregunta mas detalle sobre un tema, responde ampliando la informacion de la respuesta anterior con informacion nueva o adicional a la pregunta actual.
- Cita los documentos fuente cuando sea relevante
- Responde en el mismo idioma que la pregunta del usuario

CONTEXTO DE DOCUMENTOS:
${context}`;

    // Solo incluir historial si la pregunta actual requiere contexto de documentos
    // No incluir historial si la pregunta anterior era sobre el sistema
    const recentUserMessages = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-2); // Últimas 2 preguntas para contexto
    
    // Filtrar mensajes del sistema del historial para evitar confusión
    const relevantHistory = recentUserMessages
      .filter(msg => !isSystemQuestion(msg.content))
      .map(msg => ({ role: 'user' as const, content: msg.content }));
    
    const userMessages = relevantHistory;

    // 8. Llamar a OpenAI Chat Completion API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages,
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    // Si la respuesta indica que no hay información, no mostrar fuentes
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
