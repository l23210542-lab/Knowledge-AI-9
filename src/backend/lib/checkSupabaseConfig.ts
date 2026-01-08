/**
 * Verifica si las credenciales de Supabase están configuradas correctamente
 */
export function checkSupabaseConfig(): {
  isValid: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  message?: string;
} {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

  const isValid = !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-key');

  if (!isValid) {
    const message = `
⚠️ Configuración de Supabase no encontrada

Para solucionar este problema:

1. Crea un archivo .env en la raíz del proyecto (mismo nivel que package.json)

2. Agrega las siguientes líneas al archivo .env:
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

3. Obtén tus credenciales de Supabase:
   - Ve a https://supabase.com
   - Selecciona tu proyecto
   - Ve a Settings > API
   - Copia la "Project URL" y la "anon public" key

4. IMPORTANTE: Después de crear o modificar el archivo .env:
   - Detén el servidor (Ctrl+C)
   - Reinicia con: npm run dev

Estado actual:
- VITE_SUPABASE_URL: ${supabaseUrl ? '✓ Configurado' : '✗ No configurado'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓ Configurado' : '✗ No configurado'}
    `;
    return { isValid: false, supabaseUrl, supabaseAnonKey, message };
  }

  return { isValid: true, supabaseUrl, supabaseAnonKey };
}

