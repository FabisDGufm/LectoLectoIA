import { Component, inject, computed, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { GreetingService } from '../../../core/services/greeting.service';
import { DocumentsService } from '../../services/documents.service';
import { NotebookService } from '../../services/notebook.service';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {
  private readonly themeService = inject(ThemeService);
  private readonly greetingService = inject(GreetingService);
  private readonly documentsService = inject(DocumentsService);
  private readonly notebookService = inject(NotebookService);
  readonly authService = inject(AuthService);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  isUploading = signal(false);
  uploadProgress = signal(0);

  isDarkMode = computed(() => this.themeService.theme() === 'dark');
  // Usar saludo del AuthService que incluye el nombre del usuario
  greeting = computed(() => this.authService.getGreeting());

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  getThemeLabel(): string {
    return this.isDarkMode() ? 'Modo claro' : 'Modo oscuro';
  }

  openFileSelector(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecciona un archivo PDF válido');
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. Tamaño máximo: 50MB');
      return;
    }

    this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    this.isUploading.set(true);
    this.uploadProgress.set(0);

    const dto = {
      file,
      title: file.name.replace('.pdf', '')
    };

    this.documentsService.uploadDocument(dto).subscribe({
      next: (response) => {
        console.log('Documento subido exitosamente:', response.data);
        this.isUploading.set(false);
        this.uploadProgress.set(100);

        this.notebookService.loadActiveNotebook().subscribe({
          error: (err) => console.error('Error recargando notebook:', err)
        });

        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      },
      error: (error) => {
        console.error('Error al subir documento:', error);
        this.isUploading.set(false);
        this.uploadProgress.set(0);

        const errorMessage = error.error?.message || 'Error al subir el archivo';
        alert(`Error: ${errorMessage}`);

        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      }
    });
  }
}
