/**
 * Modelo de Documento
 * Interfaz TypeScript que representa un documento en el sistema
 */

export interface Document {
  _id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  pages: number;
  processingStatus: 'pending' | 'extracting' | 'completed' | 'failed';
  metadata?: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
  formattedSize?: string; // Virtual field del backend
}

export interface DocumentMetadata {
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
}

/**
 * DTO para crear un documento
 */
export interface CreateDocumentDto {
  file: File;
  title?: string;
}

/**
 * DTO para actualizar un documento
 */
export interface UpdateDocumentDto {
  title?: string;
  pages?: number;
  processingStatus?: 'pending' | 'extracting' | 'completed' | 'failed';
  metadata?: Partial<DocumentMetadata>;
}

/**
 * Respuesta de la API para documentos
 */
export interface DocumentsResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  pages: number;
  data: Document[];
}

export interface DocumentResponse {
  success: boolean;
  message?: string;
  data: Document;
}
