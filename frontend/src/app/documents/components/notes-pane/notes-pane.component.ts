/**
 * Componente Notes Pane
 * Panel lateral para visualizar y gestionar notas
 */

import { Component, Input, OnInit, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
export class NotesPaneComponent implements OnInit, AfterViewChecked {
  @Input() documentId?: string;
  @ViewChild('chatMessages') chatMessagesRef!: ElementRef<HTMLDivElement>;

  private readonly notesService = inject(NotesService);
  readonly chatService = inject(ChatService);
  readonly currentDocumentService = inject(CurrentDocumentService);
  private readonly documentsService = inject(DocumentsService);

  // Estado del componente
  notes = signal<Note[]>([]);
  isLoading = signal(false);
  searchTerm = signal('');
  selectedNote = signal<Note | null>(null);
  editingNote = signal<string | null>(null); // ID de la nota en edición
  newNoteText = signal('');
  editNoteText = signal('');

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

  ngOnInit(): void {
    if (this.documentId) {
      this.loadNotes();
    }

    // Suscribirse a cambios en notas
    this.notesService.notes$.subscribe(notes => {
      this.notes.set(notes);
    });
  }

  /**
   * Carga las notas del documento
   */
  loadNotes(): void {
    if (!this.documentId) return;

    this.isLoading.set(true);
    this.notesService.getAllNotes({ documentId: this.documentId })
      .subscribe({
        next: (response) => {
          this.notes.set(response.data);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error cargando notas:', error);
          this.isLoading.set(false);
        }
      });
  }

  /**
   * Crea una nueva nota
   */
  createNote(): void {
    const text = this.newNoteText().trim();
    if (!text || !this.documentId) return;

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
        console.log('Nota creada:', response.data);
        this.newNoteText.set('');
      },
      error: (error) => {
        console.error('Error creando nota:', error);
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

    const dto: UpdateNoteDto = { text };

    this.notesService.updateNote(noteId, dto).subscribe({
      next: (response) => {
        console.log('Nota actualizada:', response.data);
        this.cancelEditing();
      },
      error: (error) => {
        console.error('Error actualizando nota:', error);
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

    // 1. Agregar texto extraído del documento (OCR)
    const currentDoc = this.currentDocumentService.currentDocument();
    if (currentDoc?.extractedText) {
      // Limitar el texto a ~8000 caracteres para no exceder límites de tokens
      const maxLength = 8000;
      let docText = currentDoc.extractedText;
      if (docText.length > maxLength) {
        docText = docText.substring(0, maxLength) + '\n... [texto truncado por longitud]';
      }
      contextParts.push(`CONTENIDO DEL DOCUMENTO "${currentDoc.title}":\n${docText}`);
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
   * Scroll al final del chat
   */
  private scrollChatToBottom(): void {
    if (this.chatMessagesRef?.nativeElement) {
      const el = this.chatMessagesRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
