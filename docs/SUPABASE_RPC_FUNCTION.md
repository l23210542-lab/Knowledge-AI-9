# Función RPC para Búsqueda por Similitud en Supabase

Para mejorar el rendimiento de la búsqueda RAG, puedes crear una función RPC en Supabase que use pgvector de manera más eficiente.

## Crear la Función RPC

Ejecuta este SQL en el **SQL Editor** de Supabase:

```sql
-- Función para buscar chunks similares usando pgvector
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_index,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE document_chunks.embedding IS NOT NULL
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Configurar Permisos

Después de crear la función, configura los permisos para que pueda ser llamada desde el cliente:

```sql
-- Permitir que usuarios anónimos llamen a la función
GRANT EXECUTE ON FUNCTION match_document_chunks TO anon;
GRANT EXECUTE ON FUNCTION match_document_chunks TO authenticated;
```

## Verificación

Después de crear la función, el código en `chat.ts` la usará automáticamente. Si la función no existe, el código usará un fallback menos eficiente pero funcional.

## Notas

- La función usa el operador `<=>` de pgvector que calcula la distancia coseno
- `1 - distancia` convierte la distancia en similitud (0-1)
- El índice `ivfflat` creado en `SUPABASE_SETUP.md` mejora el rendimiento

