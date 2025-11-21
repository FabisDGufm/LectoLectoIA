import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NotebookPage {
  _id: string;
  type: 'pdf' | 'blank';
  documentId?: {
    _id: string;
    title: string;
    originalName: string;
  };
  pageNumber?: number;
  order: number;
  visible: boolean;
}

export interface Notebook {
  _id: string;
  name: string;
  pages: NotebookPage[];
  bookModeEnabled: boolean;
  isActive: boolean;
  totalPages: number;
  pdfPages: number;
  blankPages: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookResponse {
  success: boolean;
  message?: string;
  data: Notebook;
}

@Injectable({
  providedIn: 'root'
})
export class NotebookService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notebooks`;

  private _activeNotebook = signal<Notebook | null>(null);
  readonly activeNotebook = computed(() => this._activeNotebook());

  readonly pages = computed(() => {
    const notebook = this._activeNotebook();
    if (!notebook) return [];
    return [...notebook.pages]
      .filter(p => p.visible)
      .sort((a, b) => a.order - b.order);
  });

  readonly hasPages = computed(() => this.pages().length > 0);

  readonly bookModeEnabled = computed(() => {
    const notebook = this._activeNotebook();
    return notebook?.bookModeEnabled ?? false;
  });

  loadActiveNotebook(): Observable<NotebookResponse> {
    return this.http.get<NotebookResponse>(`${this.apiUrl}/active`).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  addDocumentToNotebook(documentId: string): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.post<NotebookResponse>(`${this.apiUrl}/${notebook._id}/pages`, {
      documentId
    }).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  addBlankPage(afterOrder?: number): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.post<NotebookResponse>(`${this.apiUrl}/${notebook._id}/blank`, {
      afterOrder
    }).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  deletePage(pageId: string): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.delete<NotebookResponse>(`${this.apiUrl}/${notebook._id}/pages/${pageId}`).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  movePage(pageId: string, direction: 'up' | 'down'): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.put<NotebookResponse>(`${this.apiUrl}/${notebook._id}/move`, {
      pageId,
      direction
    }).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  reorderPages(pageOrders: { pageId: string; newOrder: number }[]): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.put<NotebookResponse>(`${this.apiUrl}/${notebook._id}/reorder`, {
      pageOrders
    }).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  toggleBookMode(): Observable<NotebookResponse> {
    const notebook = this._activeNotebook();
    if (!notebook) {
      throw new Error('No hay cuaderno activo');
    }

    return this.http.put<NotebookResponse>(`${this.apiUrl}/${notebook._id}/book-mode`, {}).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }

  createNotebook(name?: string): Observable<NotebookResponse> {
    return this.http.post<NotebookResponse>(this.apiUrl, { name }).pipe(
      tap(response => {
        if (response.success) {
          this._activeNotebook.set(response.data);
        }
      })
    );
  }
}
