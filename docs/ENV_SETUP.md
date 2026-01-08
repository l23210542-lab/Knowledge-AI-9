# Configuración del archivo .env

## Problema: "Supabase credentials not found"

Si ves este error, significa que el archivo `.env` no existe o no está configurado correctamente.

## Solución paso a paso

### 1. Verificar la ubicación del archivo

El archivo `.env` debe estar en la **raíz del proyecto**, al mismo nivel que `package.json`.

```
blueprint-builder-main/
├── .env          ← AQUÍ
├── package.json
├── src/
└── ...
```

### 2. Crear el archivo .env

**En Windows:**
1. Abre el Explorador de Archivos
2. Navega a la carpeta del proyecto: `C:\Users\stans\Downloads\KnowledgeHub IA\blueprint-builder-main`
3. Crea un nuevo archivo de texto llamado `.env` (sin extensión)
   - Si Windows te pregunta por la extensión, asegúrate de que sea solo `.env` (no `.env.txt`)

**Alternativa (usando PowerShell):**
```powershell
cd "C:\Users\stans\Downloads\KnowledgeHub IA\blueprint-builder-main"
New-Item -Path .env -ItemType File
```

**Usando un editor de texto:**
1. Abre VS Code o cualquier editor de texto
2. Crea un nuevo archivo
3. Guárdalo como `.env` en la raíz del proyecto

### 3. Agregar las variables

Abre el archivo `.env` y agrega estas líneas (reemplaza con tus credenciales reales):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_OPENAI_API_KEY=sk-proj-tu_api_key_de_openai
VITE_API_URL=http://localhost:3000
```

**IMPORTANTE para OpenAI:**
- La API key debe empezar con `sk-proj-` o `sk-`
- No dejes espacios alrededor del signo `=`
- No uses comillas alrededor del valor

**IMPORTANTE:**
- No dejes espacios alrededor del signo `=`
- No uses comillas alrededor de los valores
- Cada variable debe estar en su propia línea
- Las variables DEBEN empezar con `VITE_` para que Vite las reconozca

### 4. Obtener tus credenciales de Supabase

1. Ve a [https://supabase.com](https://supabase.com) e inicia sesión
2. Selecciona tu proyecto (o crea uno nuevo)
3. Ve a **Settings** (Configuración) en el menú lateral
4. Haz clic en **API**
5. Encontrarás:
   - **Project URL** → copia este valor para `VITE_SUPABASE_URL`
   - **anon public** key → copia este valor para `VITE_SUPABASE_ANON_KEY`

### 5. Reiniciar el servidor

**CRÍTICO:** Después de crear o modificar el archivo `.env`, DEBES reiniciar el servidor:

1. Detén el servidor actual (presiona `Ctrl+C` en la terminal)
2. Inicia el servidor nuevamente:
   ```bash
   npm run dev
   ```

Vite solo lee las variables de entorno al iniciar, por lo que los cambios en `.env` no se aplican hasta que reinicies.

### 6. Verificar que funciona

Después de reiniciar, deberías ver:
- ✅ La aplicación carga sin errores en la consola
- ✅ No aparece el mensaje "Supabase credentials not found"
- ✅ Puedes navegar por la aplicación normalmente

## Ejemplo de archivo .env correcto

```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890
VITE_API_URL=http://localhost:3000
```

## Solución de problemas

### El archivo .env existe pero sigue sin funcionar

1. **Verifica el nombre del archivo:**
   - Debe ser exactamente `.env` (con el punto al inicio)
   - No debe ser `.env.txt` o `env` o `.env.local`

2. **Verifica la ubicación:**
   - Debe estar en la raíz del proyecto
   - No dentro de la carpeta `src/` o cualquier otra carpeta

3. **Verifica el formato:**
   - Sin espacios alrededor del `=`
   - Sin comillas innecesarias
   - Cada variable en su propia línea

4. **Reinicia el servidor:**
   - Detén completamente el servidor (Ctrl+C)
   - Inicia nuevamente con `npm run dev`

### Ver las variables de entorno en la consola

Puedes verificar qué variables está leyendo Vite agregando esto temporalmente en `src/lib/supabase.ts`:

```typescript
console.log('Environment variables:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '***' + import.meta.env.VITE_SUPABASE_ANON_KEY.slice(-4) : 'missing',
  allViteKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
});
```

### El archivo .env no aparece en el explorador

En Windows, los archivos que empiezan con punto (`.env`) pueden estar ocultos. Para verlos:

1. En el Explorador de Archivos, ve a la pestaña **Ver**
2. Marca la casilla **"Elementos ocultos"**

O simplemente crea el archivo desde VS Code o cualquier editor de texto.

## Seguridad

⚠️ **NUNCA** subas el archivo `.env` a Git. Ya está incluido en `.gitignore` para proteger tus credenciales.

Si accidentalmente subiste el archivo `.env` a Git:
1. Elimínalo del repositorio
2. Regenera tus credenciales en Supabase (Settings > API > Reset keys)
3. Actualiza el archivo `.env` con las nuevas credenciales

