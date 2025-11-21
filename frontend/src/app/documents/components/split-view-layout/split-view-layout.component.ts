/**
 * Componente Split View Layout
 * Layout principal que divide la pantalla entre PDF y Notas
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfViewerPaneComponent } from '../pdf-viewer-pane/pdf-viewer-pane.component';
import { NotesPaneComponent } from '../notes-pane/notes-pane.component';

@Component({
  selector: 'app-split-view-layout',
  standalone: true,
  imports: [CommonModule, PdfViewerPaneComponent, NotesPaneComponent],
  templateUrl: './split-view-layout.component.html',
  styleUrls: ['./split-view-layout.component.scss']
})
export class SplitViewLayoutComponent {
  @Input() documentId?: string;
  @Input() pdfUrl?: string;

  // Control de visibilidad de paneles en móvil
  showPdfPanel = true;
  showNotesPanel = true;

  /**
   * Alterna la visibilidad del panel de PDF (móvil)
   */
  togglePdfPanel(): void {
    this.showPdfPanel = !this.showPdfPanel;
    if (this.showPdfPanel) {
      this.showNotesPanel = false;
    }
  }

  /**
   * Alterna la visibilidad del panel de notas (móvil)
   */
  toggleNotesPanel(): void {
    this.showNotesPanel = !this.showNotesPanel;
    if (this.showNotesPanel) {
      this.showPdfPanel = false;
    }
  }
}
