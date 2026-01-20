import { createClient } from '@supabase/supabase-js';

// These variables must be in a .env file
// VITE_ prefix is required for Vite to expose them to the browser
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Validate that credentials are present
// Check that values exist and are not placeholder values
const hasValidCredentials = !!(supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key');

if (!hasValidCredentials) {
  // Try to detect project path for error message
  // Helps user locate the .env file
  let envFilePath = '.env (in project root, same level as package.json)';
  
  try {
    // In Node.js we can get the real path
    // This works in build/development environments
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const projectRoot = process.cwd();
      envFilePath = path.join(projectRoot, '.env');
    }
  } catch (e) {
    // If it fails (e.g., in browser or modules not available), use default value
  }
  
  const errorMessage = `
⚠️ Supabase credentials not found!

📁 Ubicación del archivo .env:
   ${envFilePath}

📝 Contenido del archivo .env:
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui

⚠️ IMPORTANTE:
   1. Crea el archivo .env en la raíz del proyecto (donde está package.json)
   2. Agrega las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
   3. Reinicia el servidor: npm run dev
   (Vite solo lee .env al iniciar)

Estado actual:
   VITE_SUPABASE_URL: ${supabaseUrl ? '✓ Configurada' : '✗ No configurada'}
   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓ Configurada' : '✗ No configurada'}

Debug:
   - Claves VITE_ encontradas: ${Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')).join(', ') || 'Ninguna'}
   - VITE_SUPABASE_URL: ${supabaseUrl || '(vacío)'}
   - VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '***' + supabaseAnonKey.slice(-4) : '(vacío)'}
  `;
  console.error(errorMessage);
}

// Create Supabase client
// If credentials are empty, use placeholders to avoid initialization error
// This allows the app to start even without proper config (for development)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Export function to verify configuration
// Used by other modules to check if Supabase is properly configured
export const isSupabaseConfigured = hasValidCredentials;

