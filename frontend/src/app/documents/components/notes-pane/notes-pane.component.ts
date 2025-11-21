/**
 * Componente Notes Pane
 * Panel lateral para visualizar y gestionar notas
 */

import { Component, Input, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NotesService } from '../../services/notes.service';
import { ChatService } from '../../services/chat.service';
import { CurrentDocumentService } from '../../services/current-document.service';
import { DocumentsService } from '../../services/documents.service';
import { Note, CreateNoteDto, UpdateNoteDto } from '../../models/note.model';

@Component({
  selector: 'app-notes-pane',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes-pane.component.html',
  styleUrls: ['./notes-pane.component.scss']
})
export class NotesPaneComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Input() documentId?: string;
  @ViewChild('chatMessages') chatMessagesRef!: ElementRef<HTMLDivElement>;

  readonly notesService = inject(NotesService);
  readonly chatService = inject(ChatService);
  readonly currentDocumentService = inject(CurrentDocumentService);
  private readonly documentsService = inject(DocumentsService);

  // Suscripciones
  private subscriptions: Subscription[] = [];

  // Estado del componente
  notes = signal<Note[]>([]);
  isLoading = signal(false);
  loadError = signal<string | null>(null);
  searchTerm = signal('');
  selectedNote = signal<Note | null>(null);
  editingNote = signal<string | null>(null); // ID de la nota en edición
  newNoteText = signal('');
  editNoteText = signal('');
  isSaving = signal(false);

  // Estado del chat
  activeTab = signal<'notes' | 'chat'>('notes');
  chatInput = signal('');
  isExtracting = signal(false);
  private shouldScrollChat = false;

  // Notas filtradas
  filteredNotes = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    if (!search) {
      return this.notes();
    }
    return this.notes().filter(note =>
      note.text?.toLowerCase().includes(search)
    );
  });

  // Usar directamente el primer documento del servicio como computed reactivo
  currentDoc = computed(() => {
    const doc = this.currentDocumentService.currentDocument();
    console.log('[NotesPaneChat] currentDoc computed:', doc?.title, 'hasExtractedText:', !!doc?.extractedText);
    return doc;
  });

  ngOnInit(): void {
    // Suscribirse a cambios en notas (antes de cargar)
    const notesSub = this.notesService.notes$.subscribe(notes => {
      this.notes.set(notes);
    });
    this.subscriptions.push(notesSub);

    // Cargar notas (todas si no hay documentId específico)
    this.loadNotes();
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga las notas (del documento específico o todas)
   */
  loadNotes(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    // Si hay documentId específico, cargar solo esas notas; sino cargar todas
    const params = this.documentId ? { documentId: this.documentId } : { limit: 100 };

    this.notesService.getAllNotes(params)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notes.set(response.data);
            console.log('[NotesPaneComponent] Notas cargadas:', response.data.length);
          } else {
            this.loadError.set('Error al cargar notas');
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('[NotesPaneComponent] Error cargando notas:', error);
          this.loadError.set('Error de conexión. Intenta recargar.');
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Recarga las notas forzadamente
   */
  refreshNotes(): void {
    console.log('[NotesPaneComponent] Recargando notas...');
    this.loadNotes();
  }

  /**
   * Crea una nueva nota
   */
  createNote(): void {
    const text = this.newNoteText().trim();
    if (!text || !this.documentId) return;

    this.isSaving.set(true);

    const dto: CreateNoteDto = {
      documentId: this.documentId,
      pageIndex: 0, // Por defecto, página 0
      mode: 'text',
      text,
      tags: [],
      color: '#ffd700'
    };

    this.notesService.createNote(dto).subscribe({
      next: (response) => {
        console.log('[NotesPaneComponent] Nota creada:', response.data._id);
        this.newNoteText.set('');
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('[NotesPaneComponent] Error creando nota:', error);
        this.isSaving.set(false);
        // No limpiar el texto para que el usuario pueda reintentar
      }
    });
  }

  /**
   * Inicia la edición de una nota
   */
  startEditing(note: Note): void {
    this.editingNote.set(note._id);
    this.editNoteText.set(note.text || '');
  }

  /**
   * Cancela la edición
   */
  cancelEditing(): void {
    this.editingNote.set(null);
    this.editNoteText.set('');
  }

  /**
   * Guarda los cambios de una nota
   */
  saveNote(noteId: string): void {
    const text = this.editNoteText().trim();
    if (!text) return;

    this.isSaving.set(true);
    const dto: UpdateNoteDto = { text };

    this.notesService.updateNote(noteId, dto).subscribe({
      next: (response) => {
        console.log('[NotesPaneComponent] Nota actualizada:', response.data._id);
        this.cancelEditing();
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('[NotesPaneComponent] Error actualizando nota:', error);
        this.isSaving.set(false);
        // No cancelar edición para que el usuario pueda reintentar
      }
    });
  }

  /**
   * Elimina una nota
   */
  deleteNote(noteId: string): void {
    if (!confirm('¿Estás seguro de eliminar esta nota?')) return;

    this.notesService.deleteNote(noteId).subscribe({
      next: () => {
        console.log('Nota eliminada');
      },
      error: (error) => {
        console.error('Error eliminando nota:', error);
      }
    });
  }

  /**
   * Alterna el estado de favorito de una nota
   */
  toggleFavorite(note: Note): void {
    const dto: UpdateNoteDto = {
      isFavorite: !note.isFavorite
    };

    this.notesService.updateNote(note._id, dto).subscribe({
      error: (error) => {
        console.error('Error actualizando favorito:', error);
      }
    });
  }

  /**
   * Verifica si una nota está en edición
   */
  isEditing(noteId: string): boolean {
    return this.editingNote() === noteId;
  }

  /**
   * Formatea la fecha de creación
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Obtiene el resumen de una nota (primeras 100 caracteres)
   */
  getPreview(text: string): string {
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  }

  // ============================================
  // MÉTODOS DEL CHAT
  // ============================================

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat) {
      this.scrollChatToBottom();
      this.shouldScrollChat = false;
    }
  }

  /**
   * Cambia la pestaña activa
   */
  setActiveTab(tab: 'notes' | 'chat'): void {
    this.activeTab.set(tab);
    if (tab === 'chat') {
      this.shouldScrollChat = true;
    }
  }

  /**
   * Construye el contexto del documento (texto extraído + notas)
   */
  private buildDocumentContext(): string {
    const contextParts: string[] = [];

    // 1. Agregar texto extraído del documento
    const doc = this.currentDoc();
    console.log('[NotesPaneChat] buildDocumentContext - doc:', doc?.title, 'extractedText length:', doc?.extractedText?.length || 0);

    if (doc?.extractedText) {
      // Limitar el texto a ~8000 caracteres para no exceder límites de tokens
      const maxLength = 8000;
      let docText = doc.extractedText;
      if (docText.length > maxLength) {
        docText = docText.substring(0, maxLength) + '\n... [texto truncado por longitud]';
      }
      contextParts.push(`CONTENIDO DEL DOCUMENTO "${doc.title}":\n${docText}`);
    }

    // 2. Agregar notas del usuario
    const allNotes = this.notes();
    if (allNotes.length > 0) {
      const sortedNotes = [...allNotes].sort((a, b) => a.pageIndex - b.pageIndex);
      const notesContext = sortedNotes
        .filter(note => note.text && note.text.trim())
        .map(note => `[Página ${note.pageIndex + 1}]: ${note.text}`)
        .join('\n');

      if (notesContext) {
        contextParts.push(`NOTAS DEL USUARIO:\n${notesContext}`);
      }
    }

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Envía un mensaje al chat
   */
  sendChatMessage(): void {
    const message = this.chatInput().trim();
    if (!message || this.chatService.isLoading()) return;

    this.chatInput.set('');
    this.shouldScrollChat = true;

    // Construir contexto de las notas para dar al chat
    const context = this.buildDocumentContext();
    console.log('[NotesPaneChat] Enviando mensaje con contexto:', context ? `${context.length} caracteres` : 'SIN CONTEXTO');
    console.log('[NotesPaneChat] Primeros 200 chars del contexto:', context?.substring(0, 200));

    this.chatService.sendMessage(message, context).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.chatService.addAssistantMessage(response.data.message);
          this.shouldScrollChat = true;
        } else {
          this.chatService.addAssistantMessage('Lo siento, hubo un error al procesar tu mensaje.');
        }
      },
      error: (err) => {
        console.error('Error en chat:', err);
        this.chatService.setNotLoading();
        this.chatService.addAssistantMessage('Error de conexión. Verifica que el servidor esté funcionando.');
      }
    });
  }

  /**
   * Maneja tecla Enter en el input del chat
   */
  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  /**
   * Limpia el historial del chat
   */
  clearChat(): void {
    this.chatService.clearMessages();
  }

  /**
   * Extrae texto del documento actual
   */
  extractDocumentText(): void {
    const doc = this.currentDoc();
    if (!doc || this.isExtracting()) return;

    this.isExtracting.set(true);
    console.log('[NotesPaneChat] Iniciando extracción de texto para:', doc.title, 'ID:', doc._id);

    this.documentsService.extractText(doc._id).subscribe({
      next: (response) => {
        console.log('[NotesPaneChat] Respuesta de extracción:', response);
        if (response.success && response.data) {
          console.log('[NotesPaneChat] Texto extraído exitosamente:', response.data.totalPages, 'páginas, longitud:', response.data.extractedText?.length);

          // Actualizar el documento local con el texto extraído
          const updatedDoc = {
            ...doc,
            extractedText: response.data.extractedText,
            extractedPages: response.data.pages,
            processingStatus: 'completed' as const
          };
          this.currentDocumentService.updateDocument(updatedDoc);

          // Recargar documentos para asegurar sincronización
          this.currentDocumentService.loadDocuments();
        }
        this.isExtracting.set(false);
      },
      error: (err) => {
        console.error('[NotesPaneChat] Error extrayendo texto:', err);
        alert('Error al extraer texto. Verifica que el servicio Python esté corriendo en puerto 5000.');
        this.isExtracting.set(false);
      }
    });
  }

  /**
   * Scroll al final del chat
   */
  private scrollChatToBottom(): void {
    if (this.chatMessagesRef?.nativeElement) {
      const el = this.chatMessagesRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
