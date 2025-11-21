/**
 * Componente PDF Viewer Pane
 * Visualización de documentos PDF usando PDF.js
 */

import { Component, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pdf-viewer-pane',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-viewer-pane.component.html',
  styleUrls: ['./pdf-viewer-pane.component.scss']
})
export class PdfViewerPaneComponent implements OnInit, OnDestroy {
  @Input() documentId?: string;
  @Input() pdfUrl?: string;

  // Estado del componente
  currentPage = signal(1);
  totalPages = signal(0);
  scale = signal(1.0);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // Referencia a PDF.js (se cargará dinámicamente)
  private pdfDoc: any = null;
  private pageRendering = false;
  private pageNumPending: number | null = null;

  ngOnInit(): void {
    if (this.pdfUrl) {
      this.loadPdf(this.pdfUrl);
    }
  }

  ngOnDestroy(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
    }
  }

  /**
   * Carga el documento PDF usando PDF.js
   * NOTA: En una implementación completa, se usaría @types/pdfjs-dist
   */
  async loadPdf(url: string): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Placeholder: En implementación real se usaría:
      // const pdfjsLib = await import('pdfjs-dist');
      // pdfjsLib.GlobalWorkerOptions.workerSrc = ...
      // const loadingTask = pdfjsLib.getDocument(url);
      // this.pdfDoc = await loadingTask.promise;

      // Por ahora, simular carga
      console.log('Cargando PDF desde:', url);

      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 500));

      this.totalPages.set(10); // Placeholder
      this.isLoading.set(false);
      this.renderPage(1);

    } catch (err) {
      console.error('Error cargando PDF:', err);
      this.error.set('Error al cargar el documento PDF');
      this.isLoading.set(false);
    }
  }

  /**
   * Renderiza una página específica del PDF
   */
  private async renderPage(pageNum: number): Promise<void> {
    // Implementación placeholder
    console.log(`Renderizando página ${pageNum}`);
    this.currentPage.set(pageNum);
  }

  /**
   * Navega a la página anterior
   */
  previousPage(): void {
    if (this.currentPage() > 1) {
      this.renderPage(this.currentPage() - 1);
    }
  }

  /**
   * Navega a la página siguiente
   */
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.renderPage(this.currentPage() + 1);
    }
  }

  /**
   * Aumenta el zoom
   */
  zoomIn(): void {
    if (this.scale() < 3.0) {
      this.scale.update(s => s + 0.25);
      this.renderPage(this.currentPage());
    }
  }

  /**
   * Reduce el zoom
   */
  zoomOut(): void {
    if (this.scale() > 0.5) {
      this.scale.update(s => s - 0.25);
      this.renderPage(this.currentPage());
    }
  }

  /**
   * Resetea el zoom al 100%
   */
  resetZoom(): void {
    this.scale.set(1.0);
    this.renderPage(this.currentPage());
  }

  /**
   * Obtiene el porcentaje de zoom actual
   */
  getZoomPercentage(): number {
    return Math.round(this.scale() * 100);
  }
}
