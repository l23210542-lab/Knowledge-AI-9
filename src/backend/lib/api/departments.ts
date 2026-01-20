import { supabase } from '../supabase';
import type { Department } from './documents';

/**
 * Retrieves all departments from the database
 * Departments are used to organize documents by organizational unit
 * 
 * @returns Promise that resolves to an array of Department objects
 * @throws Error if database query fails
 */
export async function getDepartments(): Promise<Department[]> {
  try {
    // Query the departments table
    // Select all columns and order by name alphabetically (A-Z)
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }

    // Return empty array if no data (instead of null)
    // This ensures consistent return type
    return data || [];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Creates a new department in the database
 * Useful for initialization or adding new organizational units
 * 
 * @param name - The name of the department to create
 * @returns Promise that resolves to the created Department object
 * @throws Error if database insertion fails
 */
export async function createDepartment(name: string): Promise<Department> {
  try {
    // Insert new department into the database
    // .select() returns the inserted row
    // .single() ensures exactly one row is returned
    const { data, error } = await supabase
      .from('departments')
      .insert({ name })
      .select()
      .single();

    if (error) {
      console.error('Error creating department:', error);
      throw error;
    }

    // Return the created department object
    return data;
  } catch (error) {
    console.error('Error in createDepartment:', error);
    throw error;
  }
}

