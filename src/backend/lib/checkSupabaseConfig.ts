/**
 * Verifies if Supabase credentials are configured correctly
 * 
 * This function checks that environment variables are set and not using placeholder values.
 * It's used throughout the application to validate configuration before making API calls.
 * 
 * @returns Object containing:
 *   - isValid: boolean indicating if credentials are properly configured
 *   - supabaseUrl: The Supabase project URL (may be empty or placeholder)
 *   - supabaseAnonKey: The Supabase anonymous key (may be empty or placeholder)
 *   - message: Optional error message with setup instructions (only if invalid)
 */
export function checkSupabaseConfig(): {
  isValid: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  message?: string;
} {
  // Load environment variables
  // VITE_ prefix is required for Vite to expose them to the browser
  // .trim() removes any accidental whitespace
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

  // Validate credentials
  // Check that both values exist and are not placeholder values
  // Placeholders are used when Supabase client is initialized without real credentials
  const isValid = !!(supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-key');

  if (!isValid) {
    // Generate helpful error message with setup instructions
    // Message is in Spanish since it's user-facing
    const message = `
⚠️ Supabase configuration not found

To fix this issue:

1. Create a .env file in the project root (same level as package.json)

2. Add the following lines to the .env file:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here

3. Get your Supabase credentials:
   - Go to https://supabase.com
   - Select your project
   - Go to Settings > API
   - Copy the "Project URL" and "anon public" key

4. IMPORTANT: After creating or modifying the .env file:
   - Stop the server (Ctrl+C)
   - Restart with: npm run dev

Current status:
- VITE_SUPABASE_URL: ${supabaseUrl ? '✓ Configured' : '✗ Not configured'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓ Configured' : '✗ Not configured'}
    `;
    return { isValid: false, supabaseUrl, supabaseAnonKey, message };
  }

  // Return success status with credentials
  // Credentials are valid and ready to use
  return { isValid: true, supabaseUrl, supabaseAnonKey };
}

