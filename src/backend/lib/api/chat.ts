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
  similarity?: number; // Similitud calculada para el chunk
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
 * Calcula la similitud coseno entre dos vectores
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Busca chunks similares usando pgvector en Supabase
 * Retorna chunks con su similitud calculada
 */
async function searchSimilarChunks(embedding: number[], limit: number = 5): Promise<DocumentChunk[]> {
  try {
    // Usar la función de búsqueda por similitud de pgvector
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.5, // Threshold más estricto
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
        .limit(200); // Aumentar límite para tener más opciones

      if (fetchError) {
        throw fetchError;
      }

      if (!allChunks || allChunks.length === 0) {
        console.warn('No se encontraron chunks con embeddings en la base de datos');
        console.log('Esto significa que los documentos no han sido procesados aún.');
        return [];
      }

      console.log(`Encontrados ${allChunks.length} chunks con embeddings. Calculando similitud...`);

      // Calcular similitud coseno para todos los chunks
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
          const similarity = cosineSimilarity(embedding, chunkEmbedding);

          return { ...chunk, similarity };
        })
        .filter((chunk: any) => chunk !== null)
        .sort((a: any, b: any) => b.similarity - a.similarity);

      console.log(`Chunks con similitud calculada: ${chunksWithSimilarity.length}`);
      console.log(`Top similitudes:`, chunksWithSimilarity.map((c: any) => c.similarity.toFixed(3)).slice(0, 10));

      // Retornar chunks con similitud (sin filtrar aquí, se filtrará después por documento)
      return chunksWithSimilarity.slice(0, limit * 2) as DocumentChunk[]; // Obtener más para tener opciones
    }

    // Si la función RPC funciona, calcular similitud para los resultados
    if (data && data.length > 0) {
      // Si la función RPC ya devuelve similitud, usarla
      // Si no, calcularla
      return data.map((chunk: any) => {
        if (chunk.similarity !== undefined) {
          return chunk as DocumentChunk;
        }
        // Calcular similitud si no viene en la respuesta
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
  const greetings = [
    '¡Hola! 👋 Me da mucho gusto ayudarte. ¿En qué puedo asistirte hoy?',
    '¡Hola! 😊 Estoy aquí para ayudarte a encontrar información en tus documentos. ¿Qué te gustaría saber?',
    '¡Hola! Bienvenido. Cuéntame, ¿qué información necesitas buscar hoy?',
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  return {
    answer: randomGreeting,
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
    
    const docCount = documentsCount || 0;
    const chunkCount = chunksCount || 0;
    
    if (docCount === 0) {
      return {
        answer: 'Por ahora no hay documentos procesados en el sistema. ¿Te gustaría subir algunos documentos para empezar?',
        sources: [],
      };
    }
    
    return {
      answer: `Actualmente tengo ${docCount} documento${docCount > 1 ? 's' : ''} procesado${docCount > 1 ? 's' : ''} en el sistema, con un total de ${chunkCount} fragmento${chunkCount > 1 ? 's' : ''} de información indexados. ¡Estoy listo para ayudarte a encontrar lo que necesitas! 😊`,
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
  
  // Cómo funciona el sistema
  if (lowerQuestion.includes('cómo funciona') || lowerQuestion.includes('como funciona')) {
    return {
      answer: '¡Te explico cómo trabajo! 😊\n\nCuando me haces una pregunta:\n\n1. Analizo tu pregunta usando inteligencia artificial para entender qué buscas\n2. Busco en todos los documentos los fragmentos más relevantes a tu pregunta\n3. Genero una respuesta clara basada en la información que encontré\n4. Te muestro las fuentes de donde obtuve la información para que puedas verificarla\n\nBásicamente, soy como un asistente que lee todos tus documentos y te ayuda a encontrar la información que necesitas de forma rápida y precisa. ¿Hay algo específico que te gustaría buscar?',
      sources: [],
    };
  }
  
  // Tipos de documentos
  if (lowerQuestion.includes('qué tipos de documentos') || lowerQuestion.includes('que tipos de documentos')) {
    return {
      answer: 'Acepto los siguientes tipos de documentos:\n\n• Archivos PDF (.pdf)\n• Archivos de texto (.txt)\n• Archivos Markdown (.md)\n\nUna vez que los subas, los proceso automáticamente para extraer su contenido y hacerlo buscable. ¡Es muy fácil! Solo súbelos y podrás hacer preguntas sobre ellos de inmediato.',
      sources: [],
    };
  }
  
  // Respuesta genérica para preguntas del sistema
  return {
    answer: '¡Claro! Estoy aquí para ayudarte. Puedes hacerme preguntas sobre los documentos que tengas subidos, o si necesitas ayuda con algo más específico del sistema, con gusto te ayudo. ¿Qué te gustaría saber?',
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
        answer: 'Por ahora no tengo documentos disponibles para consultar. ¿Te gustaría subir algunos documentos primero? Una vez que los subas, podré ayudarte a encontrar la información que necesitas.',
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
        answer: `Veo que hay ${documentsCount} documento${documentsCount > 1 ? 's' : ''} en el sistema, pero aún se están procesando. 😊\n\nLos documentos se procesan automáticamente cuando los subes. Si acabas de subirlos, dale unos momentos para que terminen de procesarse. Una vez que estén listos, podré ayudarte a encontrar cualquier información que necesites.\n\n**Para verificar:**\n• Revisa en la página de "Subir Documentos" que los documentos hayan terminado de procesarse\n• Asegúrate de que sean archivos TXT, PDF o MD\n• Si pasan varios minutos y aún no se procesan, verifica que la configuración esté correcta\n\n¡Vuelve en un momento y estaré listo para ayudarte!`,
        sources: [],
      };
    }

    // 2. Generar embedding de la pregunta
    const questionEmbedding = await generateEmbedding(question);

    // 3. Buscar chunks similares (obtener más para tener opciones)
    const similarChunks = await searchSimilarChunks(questionEmbedding, 10);

    if (similarChunks.length === 0) {
      return {
        answer: 'Hmm, no encontré información específica sobre eso en los documentos que tengo disponibles. ¿Podrías reformular tu pregunta o darme más detalles sobre lo que buscas? Estoy aquí para ayudarte a encontrar lo que necesitas.',
        sources: [],
      };
    }

    // 4. Filtrar y agrupar chunks por documento según similitud
    // Umbral de similitud mínimo para considerar un chunk relevante
    const MIN_SIMILARITY_THRESHOLD = 0.5;
    
    // Agrupar chunks por documento y encontrar la similitud máxima por documento
    const chunksByDocument = new Map<string, { chunks: DocumentChunk[], maxSimilarity: number }>();
    
    for (const chunk of similarChunks) {
      const similarity = chunk.similarity || 0;
      
      // Solo considerar chunks con similitud suficiente
      if (similarity < MIN_SIMILARITY_THRESHOLD) {
        continue;
      }
      
      const docId = chunk.document_id;
      const existing = chunksByDocument.get(docId);
      
      if (!existing) {
        chunksByDocument.set(docId, { chunks: [chunk], maxSimilarity: similarity });
      } else {
        existing.chunks.push(chunk);
        if (similarity > existing.maxSimilarity) {
          existing.maxSimilarity = similarity;
        }
      }
    }

    // Ordenar documentos por similitud máxima (de mayor a menor)
    const sortedDocuments = Array.from(chunksByDocument.entries())
      .sort((a, b) => b[1].maxSimilarity - a[1].maxSimilarity);

    if (sortedDocuments.length === 0) {
      return {
        answer: 'No encontré información que coincida directamente con tu pregunta en los documentos disponibles. ¿Podrías ser un poco más específico sobre lo que necesitas? Por ejemplo, puedes mencionar el tema o el área de interés, y con gusto te ayudo a buscar la información relevante.',
        sources: [],
      };
    }

    // 5. Seleccionar documentos para incluir en la respuesta
    // Si hay múltiples documentos con alta similitud (>= 0.6), incluir hasta 2
    // Si solo hay un documento con alta similitud, solo incluir ese
    // Si hay documentos con similitud media (0.5-0.6), incluir solo el mejor
    const HIGH_SIMILARITY_THRESHOLD = 0.6;
    
    const highSimilarityDocs = sortedDocuments.filter(([_, data]) => data.maxSimilarity >= HIGH_SIMILARITY_THRESHOLD);
    const selectedDocuments = highSimilarityDocs.length > 1 
      ? highSimilarityDocs.slice(0, 2) // Si hay múltiples con alta similitud, incluir hasta 2
      : sortedDocuments.slice(0, 1); // Si solo hay uno o todos tienen similitud media, solo el mejor

    // 6. Construir el contexto con los chunks de los documentos seleccionados
    const contextChunks: DocumentChunk[] = [];
    for (const [docId, data] of selectedDocuments) {
      // Tomar el chunk con mayor similitud de cada documento seleccionado
      const bestChunk = data.chunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))[0];
      if (bestChunk) {
        contextChunks.push(bestChunk);
      }
    }

    const context = contextChunks
      .map((chunk, index) => `[Documento ${index + 1}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    // 7. Obtener información de los documentos fuente seleccionados
    const selectedDocumentIds = selectedDocuments.map(([docId]) => docId);
    const documentInfos = await Promise.all(
      selectedDocumentIds.map(id => getDocumentInfo(id))
    );

    const sources = documentInfos
      .filter((info): info is NonNullable<typeof info> => info !== null)
      .map((info, index) => {
        const docId = selectedDocumentIds[index];
        const docData = chunksByDocument.get(docId);
        const bestChunk = docData?.chunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))[0];
        return {
          title: info.file_name,
          excerpt: bestChunk?.content.substring(0, 150) || '',
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
      temperature: 0.8, // Aumentado para respuestas más naturales y variadas
      max_tokens: 600, // Aumentado para respuestas más completas y naturales
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
