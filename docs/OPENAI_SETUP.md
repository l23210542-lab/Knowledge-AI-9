# Configuración de OpenAI para el Chatbot

Esta guía te ayudará a configurar la API key de OpenAI para que el chatbot funcione correctamente.

## Pasos de Configuración

### 1. Obtener API Key de OpenAI

1. Ve a [platform.openai.com](https://platform.openai.com)
2. Inicia sesión o crea una cuenta
3. Ve a **API keys** en el menú lateral
4. Haz clic en **"Create new secret key"**
5. Copia la API key (solo se muestra una vez, guárdala de forma segura)

### 2. Agregar API Key al archivo .env

Abre el archivo `.env` en la raíz del proyecto y agrega la siguiente línea:

```env
VITE_OPENAI_API_KEY=sk-proj-tu_api_key_aqui
```

**Ejemplo:**
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_OPENAI_API_KEY=sk-proj-tu_api_key_aqui
VITE_API_URL=http://localhost:3000
```

### 3. Reiniciar el Servidor

**CRÍTICO:** Después de agregar o modificar la API key en `.env`:

1. Detén el servidor actual (presiona `Ctrl+C` en la terminal)
2. Inicia el servidor nuevamente:
   ```bash
   npm run dev
   ```

Vite solo lee las variables de entorno al iniciar, por lo que los cambios no se aplican hasta que reinicies.

### 4. Verificar que Funciona

1. Abre la aplicación en el navegador
2. Ve a la página de **Chat**
3. Haz una pregunta de prueba
4. Deberías recibir una respuesta del chatbot

## Cómo Funciona

El sistema RAG (Retrieval-Augmented Generation) funciona así:

1. **Usuario hace una pregunta** → El sistema genera un embedding de la pregunta usando OpenAI
2. **Búsqueda semántica** → Busca chunks similares en la base de datos usando pgvector
3. **Construcción del contexto** → Combina los chunks encontrados como contexto
4. **Generación de respuesta** → OpenAI genera una respuesta basada en el contexto encontrado
5. **Retorno al usuario** → Se muestra la respuesta con las fuentes de los documentos

## Modelos Utilizados

- **Embeddings:** `text-embedding-3-small` (para convertir texto en vectores)
- **Chat:** `gpt-3.5-turbo` (para generar respuestas)

## Solución de Problemas

### Error: "OpenAI no está configurado"

**Causa:** La API key no está configurada o no se leyó correctamente.

**Solución:**
1. Verifica que el archivo `.env` existe en la raíz del proyecto
2. Verifica que la línea `VITE_OPENAI_API_KEY=...` está presente
3. Verifica que no hay espacios alrededor del signo `=`
4. Reinicia el servidor de desarrollo

### Error: "Invalid API key"

**Causa:** La API key es incorrecta o ha expirado.

**Solución:**
1. Verifica que copiaste la API key completa (son muy largas)
2. Verifica que no hay espacios o saltos de línea en la key
3. Genera una nueva API key en OpenAI si es necesario
4. Actualiza el archivo `.env` y reinicia el servidor

### Error: "Rate limit exceeded"

**Causa:** Has excedido el límite de uso de la API de OpenAI.

**Solución:**
1. Verifica tu uso en [platform.openai.com/usage](https://platform.openai.com/usage)
2. Espera unos minutos antes de intentar de nuevo
3. Considera actualizar tu plan de OpenAI si necesitas más uso

### El chatbot no encuentra información

**Causa:** No hay documentos procesados o no hay chunks con embeddings.

**Solución:**
1. Asegúrate de haber subido documentos
2. Los documentos deben estar procesados (tener chunks con embeddings)
3. Nota: Actualmente el procesamiento de documentos (extracción de texto, chunking, embeddings) debe implementarse por separado

## Seguridad

⚠️ **IMPORTANTE:**
- **NUNCA** subas el archivo `.env` a Git (ya está en `.gitignore`)
- **NUNCA** compartas tu API key públicamente
- Si accidentalmente expusiste tu API key, revócala inmediatamente en OpenAI y genera una nueva
- La API key se usa en el frontend (MVP), pero en producción debería usarse en un backend

## Costos

OpenAI cobra por uso:
- **Embeddings:** ~$0.02 por 1M tokens
- **Chat (gpt-3.5-turbo):** ~$0.50 por 1M tokens de entrada, ~$1.50 por 1M tokens de salida

Para el MVP con pocos documentos, los costos deberían ser mínimos.

## Próximos Pasos

Una vez configurada la API key, el chatbot debería funcionar. Sin embargo, para que encuentre información:

1. **Sube documentos** usando la página de Upload
2. **Procesa los documentos** (extrae texto, divide en chunks, genera embeddings)
   - Esta funcionalidad debe implementarse por separado
   - Los documentos subidos tienen estado "processing" hasta que se procesen
