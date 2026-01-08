import { supabase } from '../supabase';
import type { Department } from './documents';

/**
 * Obtiene todos los departamentos
 */
export async function getDepartments(): Promise<Department[]> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Crea un departamento (útil para inicialización)
 */
export async function createDepartment(name: string): Promise<Department> {
  try {
    const { data, error } = await supabase
      .from('departments')
      .insert({ name })
      .select()
      .single();

    if (error) {
      console.error('Error creating department:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createDepartment:', error);
    throw error;
  }
}

