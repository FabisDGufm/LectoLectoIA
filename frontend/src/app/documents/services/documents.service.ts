/**
 * Servicio de Documentos
 * Maneja todas las operaciones HTTP relacionadas con documentos
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Document,
  DocumentResponse,
  DocumentsResponse,
  CreateDocumentDto,
  UpdateDocumentDto
} from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/documents`;

  /**
   * Sube un nuevo documento al servidor
   */
  uploadDocument(dto: CreateDocumentDto): Observable<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', dto.file);
    if (dto.title) {
      formData.append('title', dto.title);
    }

    return this.http.post<DocumentResponse>(this.apiUrl, formData);
  }

  /**
   * Obtiene lista de documentos con paginación y filtros
   */
  getAllDocuments(params?: {
    page?: number;
    limit?: number;
    mimeType?: string;
    processingStatus?: string;
    search?: string;
  }): Observable<DocumentsResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<DocumentsResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtiene un documento específico por ID
   */
  getDocumentById(id: string): Observable<DocumentResponse> {
    return this.http.get<DocumentResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene la URL del archivo del documento para streaming
   */
  getDocumentFileUrl(id: string): string {
    return `${this.apiUrl}/${id}/file`;
  }

  /**
   * Descarga el archivo del documento
   */
  getDocumentFile(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/file`, {
      responseType: 'blob'
    });
  }

  /**
   * Actualiza metadatos de un documento
   */
  updateDocument(id: string, dto: UpdateDocumentDto): Observable<DocumentResponse> {
    return this.http.put<DocumentResponse>(`${this.apiUrl}/${id}`, dto);
  }

  /**
   * Elimina un documento
   */
  deleteDocument(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene estadísticas de documentos
   */
  getDocumentStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/summary`);
  }

  // ============================================
  // MÉTODOS DE EXPORTACIÓN
  // ============================================

  private exportApiUrl = `${environment.apiUrl}/export`;

  /**
   * Exporta PDF con anotaciones overlay
   */
  exportAnnotatedPdf(documentId: string): Observable<Blob> {
    return this.http.get(`${this.exportApiUrl}/${documentId}/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Exporta notas en formato JSON
   */
  exportNotesJson(documentId: string): Observable<Blob> {
    return this.http.get(`${this.exportApiUrl}/${documentId}/notes.json`, {
      responseType: 'blob'
    });
  }

  /**
   * Exporta notas en formato Markdown
   */
  exportNotesMarkdown(documentId: string): Observable<Blob> {
    return this.http.get(`${this.exportApiUrl}/${documentId}/notes.md`, {
      responseType: 'blob'
    });
  }

  /**
   * Exporta ZIP completo (PDF original + notas + PDF anotado)
   */
  exportZip(documentId: string): Observable<Blob> {
    return this.http.get(`${this.exportApiUrl}/${documentId}/zip`, {
      responseType: 'blob'
    });
  }

  /**
   * Descarga el PDF original sin anotaciones
   */
  downloadOriginal(documentId: string): Observable<Blob> {
    return this.http.get(`${this.exportApiUrl}/${documentId}/original`, {
      responseType: 'blob'
    });
  }

  /**
   * Helper para descargar un Blob como archivo
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
