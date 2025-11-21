/**
 * Servicio de Notas
 * Maneja todas las operaciones HTTP relacionadas con notas
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Note,
  NoteResponse,
  NotesResponse,
  CreateNoteDto,
  UpdateNoteDto,
  NoteFilters
} from '../models/note.model';

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notes`;

  // Estado reactivo de notas (para actualización en tiempo real)
  private notesSubject = new BehaviorSubject<Note[]>([]);
  public notes$ = this.notesSubject.asObservable();

  /**
   * Crea una nueva nota
   */
  createNote(dto: CreateNoteDto): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(this.apiUrl, dto).pipe(
      tap((response) => {
        if (response.success) {
          // Agregar nota al estado local
          const currentNotes = this.notesSubject.value;
          this.notesSubject.next([...currentNotes, response.data]);
        }
      })
    );
  }

  /**
   * Obtiene lista de notas con filtros
   */
  getAllNotes(filters?: NoteFilters): Observable<NotesResponse> {
    let httpParams = new HttpParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<NotesResponse>(this.apiUrl, { params: httpParams }).pipe(
      tap((response) => {
        if (response.success) {
          this.notesSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Obtiene una nota específica por ID
   */
  getNoteById(id: string): Observable<NoteResponse> {
    return this.http.get<NoteResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Actualiza una nota
   */
  updateNote(id: string, dto: UpdateNoteDto): Observable<NoteResponse> {
    return this.http.put<NoteResponse>(`${this.apiUrl}/${id}`, dto).pipe(
      tap((response) => {
        if (response.success) {
          // Actualizar nota en el estado local
          const currentNotes = this.notesSubject.value;
          const index = currentNotes.findIndex((n) => n._id === id);
          if (index !== -1) {
            currentNotes[index] = response.data;
            this.notesSubject.next([...currentNotes]);
          }
        }
      })
    );
  }

  /**
   * Elimina una nota
   */
  deleteNote(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap((response) => {
        if (response.success) {
          // Eliminar nota del estado local
          const currentNotes = this.notesSubject.value.filter((n) => n._id !== id);
          this.notesSubject.next(currentNotes);
        }
      })
    );
  }

  /**
   * Elimina todas las notas de un documento
   */
  deleteNotesByDocument(documentId: string): Observable<{ success: boolean; message: string; data?: any }> {
    return this.http.delete<{ success: boolean; message: string; data?: any }>(`${this.apiUrl}/document/${documentId}`).pipe(
      tap((response) => {
        if (response.success) {
          // Eliminar notas del documento del estado local
          const currentNotes = this.notesSubject.value.filter((n) => n.documentId !== documentId);
          this.notesSubject.next(currentNotes);
        }
      })
    );
  }

  /**
   * Obtiene notas favoritas
   */
  getFavoriteNotes(documentId?: string): Observable<NotesResponse> {
    let httpParams = new HttpParams();
    if (documentId) {
      httpParams = httpParams.set('documentId', documentId);
    }

    return this.http.get<NotesResponse>(`${this.apiUrl}/favorites`, { params: httpParams });
  }

  /**
   * Busca notas por texto
   */
  searchNotesByText(documentId: string, query: string): Observable<NotesResponse> {
    const httpParams = new HttpParams().set('query', query);
    return this.http.get<NotesResponse>(`${this.apiUrl}/search/${documentId}`, { params: httpParams });
  }

  /**
   * Obtiene estadísticas de notas por documento
   */
  getNoteStats(documentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/${documentId}`);
  }

  /**
   * Filtra notas localmente por texto
   */
  filterNotesByText(searchTerm: string): void {
    const allNotes = this.notesSubject.value;
    if (!searchTerm.trim()) {
      return;
    }

    const filtered = allNotes.filter((note) =>
      note.text?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    this.notesSubject.next(filtered);
  }

  /**
   * Limpia el estado de notas
   */
  clearNotes(): void {
    this.notesSubject.next([]);
  }
}
