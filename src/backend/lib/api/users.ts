import { supabase } from '../supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Obtiene o crea el usuario demo para el MVP
 * Según el PRD, para MVP usamos un usuario único hardcodeado
 */
export async function getOrCreateDemoUser(): Promise<User> {
  try {
    const DEMO_USER_EMAIL = 'demo@knowledgehub.ai';
    const DEMO_USER_NAME = 'Demo User';

    // Intentar obtener el usuario demo
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', DEMO_USER_EMAIL)
      .single();

    if (existingUser && !fetchError) {
      return existingUser;
    }

    // Si no existe, crearlo
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        name: DEMO_USER_NAME,
        email: DEMO_USER_EMAIL,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating demo user:', createError);
      throw createError;
    }

    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateDemoUser:', error);
    throw error;
  }
}

/**
 * Obtiene un usuario por ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
}

