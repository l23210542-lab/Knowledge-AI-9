# Configuración de Supabase para KnowledgeHub AI

Esta guía te ayudará a configurar Supabase para conectar la aplicación con la base de datos.

## Pasos de Configuración

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta o inicia sesión
2. Crea un nuevo proyecto
3. Anota la **URL del proyecto** y la **anon key** (las encontrarás en Settings > API)

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_OPENAI_API_KEY=sk-proj-tu_api_key_de_openai
VITE_API_URL=http://localhost:3000
```

**Nota sobre OpenAI API Key:**
- Necesaria para la funcionalidad de chat con RAG
- Obtén tu API key en [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- La key debe empezar con `sk-proj-` o `sk-`

**Nota:** El archivo `.env` no debe subirse a Git. Ya está incluido en `.gitignore`.

### 3. Crear las Tablas en Supabase

Ejecuta el siguiente SQL en el SQL Editor de Supabase (Dashboard > SQL Editor):

```sql
-- Crear tabla de usuarios
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Crear tabla de departamentos
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

-- Crear tabla de documentos
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  department_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing'::text,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT fk_department FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT fk_uploader FOREIGN KEY (uploader_id) REFERENCES public.users(id)
);

-- Crear tabla de chunks de documentos (para RAG)
CREATE TABLE public.document_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536), -- Para text-embedding-3-small de OpenAI
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE
);

-- Habilitar extensión pgvector (necesaria para embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear índice para búsqueda de similitud
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 4. Configurar Supabase Storage

1. Ve a **Storage** en el dashboard de Supabase
2. Crea un nuevo bucket llamado `documents`
3. Configura las opciones del bucket:
   - **Public Access:** Deshabilitado (solo acceso autenticado)
   - **File size limit:** 10MB
   - **Allowed MIME types:** `application/pdf`, `text/plain`, `text/markdown`

4. **Configurar Políticas RLS del Bucket (IMPORTANTE):**

   Después de crear el bucket, debes configurar las políticas de Storage. Ve a la pestaña **"Policies"** del bucket `documents` y crea las siguientes políticas:

   **Política 1: Permitir subida de archivos (INSERT)**
   ```sql
   -- Nombre: Allow authenticated uploads
   -- Operación: INSERT
   -- Definición:
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'documents');
   ```

   **Política 2: Permitir lectura de archivos (SELECT)**
   ```sql
   -- Nombre: Allow authenticated reads
   -- Operación: SELECT
   -- Definición:
   CREATE POLICY "Allow authenticated reads"
   ON storage.objects
   FOR SELECT
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   **Política 3: Permitir eliminación de archivos (DELETE)**
   ```sql
   -- Nombre: Allow authenticated deletes
   -- Operación: DELETE
   -- Definición:
   CREATE POLICY "Allow authenticated deletes"
   ON storage.objects
   FOR DELETE
   TO authenticated
   USING (bucket_id = 'documents');
   ```

   **Alternativa rápida para MVP (menos seguro):**
   
   Si prefieres una solución más simple para desarrollo, puedes crear una política que permita todo:
   ```sql
   -- Nombre: Allow all operations
   -- Operación: ALL
   -- Definición:
   CREATE POLICY "Allow all operations"
   ON storage.objects
   FOR ALL
   TO authenticated
   USING (bucket_id = 'documents')
   WITH CHECK (bucket_id = 'documents');
   ```

   **Nota:** Para el MVP sin autenticación real, también puedes usar `anon` en lugar de `authenticated`:
   ```sql
   CREATE POLICY "Allow anon uploads"
   ON storage.objects
   FOR INSERT
   TO anon
   WITH CHECK (bucket_id = 'documents');
   ```

### 5. Insertar Departamentos Iniciales

Ejecuta este SQL para crear los departamentos por defecto:

```sql
INSERT INTO public.departments (name) VALUES
  ('RRHH'),
  ('Ventas'),
  ('Operaciones'),
  ('Soporte'),
  ('Otro')
ON CONFLICT (name) DO NOTHING;
```

### 6. Configurar Políticas RLS (Row Level Security)

Para el MVP, puedes deshabilitar RLS temporalmente o configurar políticas básicas:

```sql
-- Deshabilitar RLS para desarrollo (MVP)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
```

**Nota:** En producción, deberías configurar políticas RLS apropiadas.

### 7. Verificar la Configuración

1. Reinicia el servidor de desarrollo: `npm run dev`
2. Ve a la página de subida de documentos
3. Intenta subir un documento de prueba
4. Verifica que aparezca en la lista de documentos

## Estructura de Datos

### Tabla `users`
- Almacena información de usuarios (para MVP: usuario demo único)
- Se crea automáticamente el usuario "Demo User" al usar la aplicación

### Tabla `departments`
- Almacena los departamentos disponibles
- Se pueden agregar más departamentos desde la base de datos

### Tabla `documents`
- Almacena metadatos de documentos subidos
- Estado: `processing`, `processed`, `error`
- Relacionado con `departments` y `users`

### Tabla `document_chunks`
- Almacena chunks de texto de los documentos procesados
- Incluye embeddings vectoriales para búsqueda semántica
- Usado por el sistema RAG para responder preguntas

## Próximos Pasos

1. **Backend API:** Configura el backend para procesar documentos y generar embeddings
2. **Procesamiento de Documentos:** Implementa la lógica para:
   - Extraer texto de PDFs
   - Dividir en chunks
   - Generar embeddings con OpenAI
   - Guardar en `document_chunks`
3. **API de Chat:** Implementa el endpoint `/api/chat/query` que:
   - Convierte preguntas en embeddings
   - Busca chunks similares usando pgvector
   - Genera respuestas con OpenAI

## Solución de Problemas

### Error: "Supabase credentials not found"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo después de crear/modificar `.env`

### Error al subir archivos: "new row violates row-level security policy"
- **Solución:** Este error indica que faltan políticas RLS en el bucket de Storage
- **Guía completa:** Ver [docs/STORAGE_RLS_FIX.md](./STORAGE_RLS_FIX.md) para instrucciones detalladas
- **Solución rápida:** Ejecuta este SQL en el SQL Editor de Supabase:
  ```sql
  CREATE POLICY "Allow anon uploads"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'documents');
  
  CREATE POLICY "Allow anon reads"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'documents');
  ```
- Verifica que el bucket `documents` existe en Storage
- Verifica que las políticas están habilitadas en Storage → documents → Policies

### Error al cargar documentos
- Verifica que las tablas existen en Supabase
- Verifica que las relaciones (foreign keys) están correctamente configuradas
- Revisa la consola del navegador y la pestaña Network para ver los errores de API

