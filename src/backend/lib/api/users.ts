import { supabase } from '../supabase';

/**
 * User interface representing a user in the system
 */
export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Gets or creates the demo user for MVP
 * According to PRD, MVP uses a single hardcoded user
 * 
 * This function implements an idempotent pattern:
 * - First attempts to find existing demo user by email
 * - If not found, creates a new demo user
 * - Returns the user object in either case
 * 
 * @returns Promise that resolves to the demo User object
 * @throws Error if database operations fail
 */
export async function getOrCreateDemoUser(): Promise<User> {
  try {
    // Demo user credentials (hardcoded for MVP)
    const DEMO_USER_EMAIL = 'demo@knowledgehub.ai';
    const DEMO_USER_NAME = 'Demo User';

    // Try to get existing demo user
    // Search by email since it should be unique
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', DEMO_USER_EMAIL)
      .single();

    // If user exists and no error occurred, return it
    if (existingUser && !fetchError) {
      return existingUser;
    }

    // If user doesn't exist, create it
    // This happens on first run or if user was deleted
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

    // Return the newly created user
    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateDemoUser:', error);
    throw error;
  }
}

/**
 * Retrieves a user by their unique ID
 * 
 * @param userId - The unique identifier of the user to fetch
 * @returns Promise that resolves to User object if found, null if not found
 * @returns null if user doesn't exist or if query fails
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    // Query users table by ID
    // .single() expects exactly one result (throws if 0 or multiple)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      // Return null instead of throwing for graceful handling
      // Caller can check for null to handle "not found" case
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
}

