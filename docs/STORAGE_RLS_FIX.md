# Solución: Error "new row violates row-level security policy" en Storage

## Problema

Al intentar subir un archivo, recibes el error:
```
StorageApiError: new row violates row-level security policy
```

Esto significa que las políticas RLS (Row Level Security) del bucket de Storage están bloqueando la operación.

## Solución Rápida

### Opción 1: Configurar Políticas RLS (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Storage** en el menú lateral
3. Haz clic en el bucket `documents`
4. Ve a la pestaña **"Policies"**
5. Haz clic en **"New Policy"**

#### Crear Política de Subida (INSERT):

1. Selecciona **"Create a policy from scratch"**
2. Configura:
   - **Policy name:** `Allow uploads`
   - **Allowed operation:** `INSERT`
   - **Target roles:** `anon` (o `authenticated` si usas autenticación)
   - **Policy definition:** 
     ```sql
     bucket_id = 'documents'
     ```
3. Haz clic en **"Review"** y luego **"Save policy"**

#### Crear Política de Lectura (SELECT):

1. **New Policy** → **"Create a policy from scratch"**
2. Configura:
   - **Policy name:** `Allow reads`
   - **Allowed operation:** `SELECT`
   - **Target roles:** `anon`
   - **Policy definition:**
     ```sql
     bucket_id = 'documents'
     ```
3. Guarda la política

#### Crear Política de Eliminación (DELETE):

1. **New Policy** → **"Create a policy from scratch"**
2. Configura:
   - **Policy name:** `Allow deletes`
   - **Allowed operation:** `DELETE`
   - **Target roles:** `anon`
   - **Policy definition:**
     ```sql
     bucket_id = 'documents'
     ```
3. Guarda la política

### Opción 2: Usar SQL Editor (Más Rápido)

Ve a **SQL Editor** en Supabase y ejecuta este script completo:

```sql
-- Política para INSERT (subir archivos)
CREATE POLICY "Allow anon uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documents');

-- Política para SELECT (leer archivos)
CREATE POLICY "Allow anon reads"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'documents');

-- Política para DELETE (eliminar archivos)
CREATE POLICY "Allow anon deletes"
ON storage.objects
FOR DELETE
TO anon
USING (bucket_id = 'documents');
```

### Opción 3: Política Única para Todo (MVP - Menos Seguro)

Si prefieres una solución más simple para desarrollo:

```sql
CREATE POLICY "Allow all document operations"
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');
```

## Verificar que Funciona

1. Después de crear las políticas, intenta subir un archivo nuevamente
2. El error debería desaparecer
3. El archivo debería subirse correctamente a Supabase Storage

## Notas Importantes

- **Para MVP:** Usar `anon` es aceptable ya que no hay autenticación real
- **Para Producción:** Deberías usar `authenticated` y configurar autenticación adecuada
- Las políticas RLS son importantes para la seguridad, no las deshabilites completamente

## Solución de Problemas

### Si sigues viendo el error después de crear las políticas:

1. **Verifica que el bucket existe:**
   - Ve a Storage → Buckets
   - Asegúrate de que existe un bucket llamado exactamente `documents`

2. **Verifica las políticas creadas:**
   - Ve a Storage → `documents` → Policies
   - Deberías ver las políticas que creaste
   - Verifica que están habilitadas (toggle activo)

3. **Verifica los roles:**
   - Si usas autenticación, cambia `anon` por `authenticated` en las políticas
   - Si no usas autenticación, asegúrate de usar `anon`

4. **Revisa la consola del navegador:**
   - Abre las DevTools (F12)
   - Ve a la pestaña Network
   - Intenta subir un archivo
   - Revisa la respuesta del error para más detalles

### Si el bucket no existe:

1. Ve a **Storage** → **Buckets**
2. Haz clic en **"New bucket"**
3. Nombre: `documents`
4. **Public bucket:** Deshabilitado
5. Haz clic en **"Create bucket"**
6. Luego crea las políticas como se describe arriba

