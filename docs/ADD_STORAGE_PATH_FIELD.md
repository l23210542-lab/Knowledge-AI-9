# Agregar campo storage_path a la tabla documents

Para mejorar la búsqueda de archivos, necesitas agregar un campo `storage_path` a la tabla `documents`.

## Ejecutar en SQL Editor de Supabase

```sql
-- Agregar columna storage_path a la tabla documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS storage_path text;

-- Crear índice para búsquedas más rápidas (opcional)
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON public.documents(storage_path);
```

## Verificar

Después de ejecutar el SQL, verifica que la columna existe:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents' AND column_name = 'storage_path';
```

