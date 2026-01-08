import { supabase } from '../supabase';

export interface Document {
  id: string;
  file_name: string;
  department_id: string;
  uploader_id: string;
  status: 'processing' | 'processed' | 'error';
  uploaded_at: string;
  storage_path?: string; // Path del archivo en Supabase Storage
  department?: {
    id: string;
    name: string;
  };
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Obtiene todos los documentos con información del departamento
 */
export async function getDocuments(): Promise<Document[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        departments (
          id,
          name
        )
      `)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    // Mapear los datos para que department sea un objeto anidado
    return (data || []).map((doc: any) => ({
      ...doc,
      department: doc.departments ? {
        id: doc.departments.id,
        name: doc.departments.name,
      } : undefined,
    }));
  } catch (error) {
    console.error('Error in getDocuments:', error);
    throw error;
  }
}

/**
 * Sube un documento a Supabase Storage y crea el registro en la base de datos
 */
export async function uploadDocument(
  file: File,
  departmentId: string,
  uploaderId: string
): Promise<Document> {
  try {
    // 1. Subir archivo a Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // 2. Crear registro en la tabla documents (guardar también el path del archivo)
    const { data: documentData, error: insertError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        department_id: departmentId,
        uploader_id: uploaderId,
        status: 'processed',
        storage_path: filePath, // Guardar el path del archivo en Storage
      })
      .select(`
        *,
        departments (
          id,
          name
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating document record:', insertError);
      // Intentar eliminar el archivo subido si falla la inserción
      await supabase.storage.from('documents').remove([filePath]);
      throw insertError;
    }

    // Mapear los datos para que department sea un objeto anidado
    return {
      ...documentData,
      department: documentData.departments ? {
        id: documentData.departments.id,
        name: documentData.departments.name,
      } : undefined,
    };
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de un documento
 */
export async function updateDocumentStatus(
  documentId: string,
  status: 'processing' | 'processed' | 'error'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateDocumentStatus:', error);
    throw error;
  }
}

/**
 * Obtiene un documento por ID
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        departments (
          id,
          name
        )
      `)
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw error;
    }

    // Mapear los datos para que department sea un objeto anidado
    return {
      ...data,
      department: data.departments ? {
        id: data.departments.id,
        name: data.departments.name,
      } : undefined,
    };
  } catch (error) {
    console.error('Error in getDocumentById:', error);
    return null;
  }
}

