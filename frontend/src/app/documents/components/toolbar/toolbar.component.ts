/**
 * Componente Toolbar
 * Barra de herramientas superior con controles principales
 */

import { Component, inject, computed, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { GreetingService } from '../../../core/services/greeting.service';
import { DocumentsService } from '../../services/documents.service';

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

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  // Estado del componente
  isUploading = signal(false);
  uploadProgress = signal(0);

  // Computed properties para reactividad
  isDarkMode = computed(() => this.themeService.theme() === 'dark');
  greeting = computed(() => this.greetingService.greeting());

  /**
   * Alterna entre modo claro y oscuro
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Obtiene el texto del botón de tema
   */
  getThemeLabel(): string {
    return this.isDarkMode() ? 'Modo claro' : 'Modo oscuro';
  }

  /**
   * Abre el selector de archivos
   */
  openFileSelector(): void {
    this.fileInput?.nativeElement.click();
  }

  /**
   * Maneja la selección de archivos
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validar tipo de archivo
    if (file.type !== 'application/pdf') {
      alert('Por favor, selecciona un archivo PDF válido');
      return;
    }

    // Validar tamaño (50MB máximo)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. Tamaño máximo: 50MB');
      return;
    }

    this.uploadFile(file);
  }

  /**
   * Sube el archivo al servidor
   */
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

        // Mostrar mensaje de éxito
        alert(`¡PDF "${response.data.title}" subido exitosamente!`);

        // Limpiar el input
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }

        // Recargar la página o actualizar la vista
        window.location.reload();
      },
      error: (error) => {
        console.error('Error al subir documento:', error);
        this.isUploading.set(false);
        this.uploadProgress.set(0);

        const errorMessage = error.error?.message || 'Error al subir el archivo';
        alert(`Error: ${errorMessage}`);

        // Limpiar el input
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      }
    });
  }
}
