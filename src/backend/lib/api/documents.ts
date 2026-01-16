import { supabase } from '../supabase';
import { processDocument } from './documentProcessing';

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

    // 2. Crear registro en la tabla documents con status 'processing'
    const { data: documentData, error: insertError } = await supabase
      .from('documents')
      .insert({
        file_name: file.name,
        department_id: departmentId,
        uploader_id: uploaderId,
        status: 'processing', // Cambiar a 'processing' mientras se procesa
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

    // 3. Procesar el documento (extraer texto, crear chunks, generar embeddings)
    try {
      const processed = await processDocument(documentData.id);
      
      if (processed) {
        // Actualizar estado a 'processed' si se procesó correctamente
        await updateDocumentStatus(documentData.id, 'processed');
      } else {
        // Si falla el procesamiento, marcar como error
        await updateDocumentStatus(documentData.id, 'error');
        throw new Error('Error al procesar el documento');
      }
    } catch (processError) {
      console.error('Error processing document:', processError);
      await updateDocumentStatus(documentData.id, 'error');
      throw processError;
    }

    // 4. Obtener el documento actualizado
    const { data: updatedDocument, error: fetchError } = await supabase
      .from('documents')
      .select(`
        *,
        departments (
          id,
          name
        )
      `)
      .eq('id', documentData.id)
      .single();

    if (fetchError || !updatedDocument) {
      // Si falla obtener el documento actualizado, retornar el original
      return {
        ...documentData,
        status: 'processed' as const,
        department: documentData.departments ? {
          id: documentData.departments.id,
          name: documentData.departments.name,
        } : undefined,
      };
    }

    // Mapear los datos para que department sea un objeto anidado
    return {
      ...updatedDocument,
      department: updatedDocument.departments ? {
        id: updatedDocument.departments.id,
        name: updatedDocument.departments.name,
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
 * Verifica si hay documentos en proceso
 */
export async function hasDocumentsProcessing(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if (error) {
      console.error('Error checking processing documents:', error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error('Error in hasDocumentsProcessing:', error);
    return false;
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

