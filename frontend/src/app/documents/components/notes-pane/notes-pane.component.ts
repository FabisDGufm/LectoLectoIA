/**
 * Componente Notes Pane
 * Panel lateral para visualizar y gestionar notas
 */

import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotesService } from '../../services/notes.service';
import { Note, CreateNoteDto, UpdateNoteDto } from '../../models/note.model';

@Component({
  selector: 'app-notes-pane',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes-pane.component.html',
  styleUrls: ['./notes-pane.component.scss']
})
export class NotesPaneComponent implements OnInit {
  @Input() documentId?: string;

  private readonly notesService = inject(NotesService);

  // Estado del componente
  notes = signal<Note[]>([]);
  isLoading = signal(false);
  searchTerm = signal('');
  selectedNote = signal<Note | null>(null);
  editingNote = signal<string | null>(null); // ID de la nota en edición
  newNoteText = signal('');
  editNoteText = signal('');

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
}
