-- Agregar columna storage_path a la tabla documents
-- Ejecuta este SQL en el SQL Editor de Supabase

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS storage_path text;

-- Comentario: Esta columna almacena la ruta del archivo en Supabase Storage
-- para facilitar la búsqueda y procesamiento de documentos

