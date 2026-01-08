import { createClient } from '@supabase/supabase-js';

// Estas variables deben estar en un archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Validar que las credenciales estén presentes
const hasValidCredentials = !!(supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key');

if (!hasValidCredentials) {
  const errorMessage = `
⚠️ Supabase credentials not found!

Please create a .env file in the root of your project with:
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

After creating/updating .env, restart the dev server with: npm run dev

Current values:
VITE_SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}
VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓ Set' : '✗ Missing'}

Debug info:
- import.meta.env keys: ${Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')).join(', ') || 'None found'}
- VITE_SUPABASE_URL value: ${supabaseUrl || '(empty)'}
- VITE_SUPABASE_ANON_KEY value: ${supabaseAnonKey ? '***' + supabaseAnonKey.slice(-4) : '(empty)'}
  `;
  console.error(errorMessage);
}

// Crear el cliente de Supabase
// Si las credenciales están vacías, se usan placeholders para evitar el error de inicialización
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Exportar función para verificar configuración
export const isSupabaseConfigured = hasValidCredentials;

