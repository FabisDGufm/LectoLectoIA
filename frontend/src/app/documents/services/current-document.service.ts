/**
 * Servicio para manejar documentos mostrados en el visor
 * Permite mostrar múltiples PDFs en secuencia (como notas continuas)
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Document } from '../models/document.model';
import { DocumentsService } from './documents.service';

export interface DocumentWithUrl {
  document: Document;
  pdfUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrentDocumentService {
  private readonly documentsService = inject(DocumentsService);

  // Lista de documentos actualmente mostrados en el visor (en secuencia)
  private _activeDocuments = signal<DocumentWithUrl[]>([]);

  // Computed properties públicas
  readonly activeDocuments = computed(() => this._activeDocuments());
  readonly hasDocuments = computed(() => this._activeDocuments().length > 0);
  readonly documentsCount = computed(() => this._activeDocuments().length);

  // Para compatibilidad con el código existente
  readonly pdfUrl = computed(() => {
    const docs = this._activeDocuments();
    return docs.length > 0 ? docs[0].pdfUrl : null;
  });
  readonly documentId = computed(() => {
    const docs = this._activeDocuments();
    return docs.length > 0 ? docs[0].document._id : null;
  });
  readonly currentDocument = computed(() => {
    const docs = this._activeDocuments();
    return docs.length > 0 ? docs[0].document : null;
  });
  // Alias para compatibilidad
  readonly documents = computed(() => this._activeDocuments().map(d => d.document));

  /**
   * Carga todos los documentos desde el servidor y los muestra en secuencia
   */
  loadDocuments(): void {
    this.documentsService.getAllDocuments({ limit: 100 }).subscribe({
      next: (response) => {
        // Convertir documentos a formato con URL
        const docsWithUrls: DocumentWithUrl[] = response.data.map(doc => ({
          document: doc,
          pdfUrl: this.documentsService.getDocumentFileUrl(doc._id)
        }));

        this._activeDocuments.set(docsWithUrls);
        console.log('Documentos cargados para mostrar:', docsWithUrls.length);
      },
      error: (err) => {
        console.error('Error cargando documentos:', err);
      }
    });
  }

  /**
   * Agrega un nuevo documento al visor (se muestra al final)
   */
  addDocument(document: Document, pdfUrl: string): void {
    // Verificar que no exista ya
    const exists = this._activeDocuments().some(d => d.document._id === document._id);
    if (!exists) {
      this._activeDocuments.update(docs => [...docs, { document, pdfUrl }]);
      console.log('Documento agregado al visor:', document.title);
    }
  }

  /**
   * Establece el documento (compatibilidad) - agrega al visor
   */
  setDocument(document: Document, pdfUrl: string): void {
    this.addDocument(document, pdfUrl);
  }

  /**
   * Elimina un documento del visor
   */
  removeDocument(documentId: string): void {
    this._activeDocuments.update(docs =>
      docs.filter(d => d.document._id !== documentId)
    );
  }

  /**
   * Limpia todos los documentos del visor
   */
  clearDocuments(): void {
    this._activeDocuments.set([]);
  }

  /**
   * Alias para compatibilidad
   */
  clearDocument(): void {
    this.clearDocuments();
  }

  /**
   * Obtiene la URL del primer PDF (compatibilidad)
   */
  getPdfUrl(): string | null {
    return this.pdfUrl();
  }

  /**
   * Selecciona un documento (no usado en modo secuencial, pero mantenido por compatibilidad)
   */
  selectDocument(document: Document): void {
    // En modo secuencial, esto no hace nada especial
    console.log('Documento en visor:', document.title);
  }
}
