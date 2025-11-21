/**
 * Servicio de Notas
 * Maneja todas las operaciones HTTP relacionadas con notas
 * Con sincronización mejorada y manejo robusto de errores
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, retry, finalize } from 'rxjs/operators';
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

  // Estado de sincronización
  isSyncing = signal(false);
  lastSyncTime = signal<Date | null>(null);
  syncError = signal<string | null>(null);

  // Respaldo para rollback en caso de error
  private notesBackup: Note[] = [];

  // Cola de operaciones pendientes
  private pendingOperations = signal<number>(0);

  /**
   * Guarda el estado actual como respaldo
   */
  private saveBackup(): void {
    this.notesBackup = [...this.notesSubject.value];
  }

  /**
   * Restaura el estado desde el respaldo
   */
  private restoreBackup(): void {
    if (this.notesBackup.length > 0) {
      this.notesSubject.next([...this.notesBackup]);
    }
  }

  /**
   * Crea una nueva nota con retry automático
   */
  createNote(dto: CreateNoteDto): Observable<NoteResponse> {
    this.saveBackup();
    this.isSyncing.set(true);
    this.syncError.set(null);
    this.pendingOperations.update(v => v + 1);

    return this.http.post<NoteResponse>(this.apiUrl, dto).pipe(
      retry({ count: 2, delay: 1000 }),
      tap((response) => {
        if (response.success) {
          // Agregar nota al estado local (copia profunda)
          const currentNotes = [...this.notesSubject.value];
          const newNote = { ...response.data };
          this.notesSubject.next([...currentNotes, newNote]);
          this.lastSyncTime.set(new Date());
          console.log('[NotesService] Nota creada y sincronizada:', newNote._id);
        }
      }),
      catchError((error) => {
        console.error('[NotesService] Error creando nota:', error);
        this.syncError.set('Error al crear la nota. Reintentando...');
        this.restoreBackup();
        throw error;
      }),
      finalize(() => {
        this.isSyncing.set(false);
        this.pendingOperations.update(v => Math.max(0, v - 1));
      })
    );
  }

  /**
   * Obtiene lista de notas con filtros y retry
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

    this.isSyncing.set(true);
    this.syncError.set(null);

    return this.http.get<NotesResponse>(this.apiUrl, { params: httpParams }).pipe(
      retry({ count: 3, delay: 1000 }),
      tap((response) => {
        if (response.success) {
          // Copia profunda de las notas
          const notes = response.data.map(note => ({ ...note }));
          this.notesSubject.next(notes);
          this.lastSyncTime.set(new Date());
          console.log('[NotesService] Notas cargadas:', notes.length);
        }
      }),
      catchError((error) => {
        console.error('[NotesService] Error cargando notas:', error);
        this.syncError.set('Error al cargar notas. Por favor recarga la página.');
        // Retornar respuesta vacía en lugar de propagar el error
        return of({ success: false, data: [], count: 0, total: 0, page: 1, pages: 1, pagination: {} } as NotesResponse);
      }),
      finalize(() => {
        this.isSyncing.set(false);
      })
    );
  }

  /**
   * Obtiene una nota específica por ID
   */
  getNoteById(id: string): Observable<NoteResponse> {
    return this.http.get<NoteResponse>(`${this.apiUrl}/${id}`).pipe(
      retry({ count: 2, delay: 500 })
    );
  }

  /**
   * Actualiza una nota con optimistic update y rollback
   */
  updateNote(id: string, dto: UpdateNoteDto): Observable<NoteResponse> {
    this.saveBackup();
    this.isSyncing.set(true);
    this.syncError.set(null);
    this.pendingOperations.update(v => v + 1);

    // Optimistic update: actualizar UI inmediatamente
    const currentNotes = [...this.notesSubject.value];
    const index = currentNotes.findIndex((n) => n._id === id);
    if (index !== -1) {
      currentNotes[index] = { ...currentNotes[index], ...dto };
      this.notesSubject.next(currentNotes);
    }

    return this.http.put<NoteResponse>(`${this.apiUrl}/${id}`, dto).pipe(
      retry({ count: 2, delay: 1000 }),
      tap((response) => {
        if (response.success) {
          // Confirmar actualización con datos del servidor
          const notes = [...this.notesSubject.value];
          const idx = notes.findIndex((n) => n._id === id);
          if (idx !== -1) {
            notes[idx] = { ...response.data };
            this.notesSubject.next(notes);
          }
          this.lastSyncTime.set(new Date());
          console.log('[NotesService] Nota actualizada:', id);
        }
      }),
      catchError((error) => {
        console.error('[NotesService] Error actualizando nota:', error);
        this.syncError.set('Error al actualizar. Restaurando...');
        this.restoreBackup(); // Rollback al estado anterior
        throw error;
      }),
      finalize(() => {
        this.isSyncing.set(false);
        this.pendingOperations.update(v => Math.max(0, v - 1));
      })
    );
  }

  /**
   * Elimina una nota con optimistic update
   */
  deleteNote(id: string): Observable<{ success: boolean; message: string }> {
    this.saveBackup();
    this.isSyncing.set(true);
    this.syncError.set(null);
    this.pendingOperations.update(v => v + 1);

    // Optimistic update: eliminar de UI inmediatamente
    const currentNotes = this.notesSubject.value.filter((n) => n._id !== id);
    this.notesSubject.next(currentNotes);

    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      retry({ count: 2, delay: 1000 }),
      tap((response) => {
        if (response.success) {
          this.lastSyncTime.set(new Date());
          console.log('[NotesService] Nota eliminada:', id);
        }
      }),
      catchError((error) => {
        console.error('[NotesService] Error eliminando nota:', error);
        this.syncError.set('Error al eliminar. Restaurando...');
        this.restoreBackup(); // Rollback
        throw error;
      }),
      finalize(() => {
        this.isSyncing.set(false);
        this.pendingOperations.update(v => Math.max(0, v - 1));
      })
    );
  }

  /**
   * Elimina todas las notas de un documento
   */
  deleteNotesByDocument(documentId: string): Observable<{ success: boolean; message: string; data?: any }> {
    this.saveBackup();
    this.isSyncing.set(true);
    this.pendingOperations.update(v => v + 1);

    return this.http.delete<{ success: boolean; message: string; data?: any }>(`${this.apiUrl}/document/${documentId}`).pipe(
      retry({ count: 2, delay: 1000 }),
      tap((response) => {
        if (response.success) {
          // Eliminar notas del documento del estado local
          const currentNotes = this.notesSubject.value.filter((n) => n.documentId !== documentId);
          this.notesSubject.next(currentNotes);
          this.lastSyncTime.set(new Date());
        }
      }),
      catchError((error) => {
        console.error('[NotesService] Error eliminando notas del documento:', error);
        this.restoreBackup();
        throw error;
      }),
      finalize(() => {
        this.isSyncing.set(false);
        this.pendingOperations.update(v => Math.max(0, v - 1));
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

    return this.http.get<NotesResponse>(`${this.apiUrl}/favorites`, { params: httpParams }).pipe(
      retry({ count: 2, delay: 500 })
    );
  }

  /**
   * Busca notas por texto
   */
  searchNotesByText(documentId: string, query: string): Observable<NotesResponse> {
    const httpParams = new HttpParams().set('query', query);
    return this.http.get<NotesResponse>(`${this.apiUrl}/search/${documentId}`, { params: httpParams }).pipe(
      retry({ count: 2, delay: 500 })
    );
  }

  /**
   * Obtiene estadísticas de notas por documento
   */
  getNoteStats(documentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/${documentId}`).pipe(
      retry({ count: 2, delay: 500 })
    );
  }

  /**
   * Filtra notas localmente por texto (sin modificar el estado principal)
   */
  filterNotesByText(searchTerm: string): Note[] {
    const allNotes = this.notesSubject.value;
    if (!searchTerm.trim()) {
      return allNotes;
    }

    return allNotes.filter((note) =>
      note.text?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Limpia el estado de notas
   */
  clearNotes(): void {
    this.notesSubject.next([]);
    this.notesBackup = [];
    this.syncError.set(null);
  }

  /**
   * Fuerza recarga de notas desde el servidor
   */
  refreshNotes(filters?: NoteFilters): Observable<NotesResponse> {
    console.log('[NotesService] Forzando recarga de notas...');
    return this.getAllNotes(filters);
  }

  /**
   * Verifica si hay operaciones pendientes
   */
  hasPendingOperations(): boolean {
    return this.pendingOperations() > 0;
  }
}
