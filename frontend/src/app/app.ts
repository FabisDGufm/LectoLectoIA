/**
 * Componente Principal de la Aplicación
 * LectoLectoIA - Sistema Integral de Lectura y Anotación Digital
 */

import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from './documents/components/toolbar/toolbar.component';
import { SplitViewLayoutComponent } from './documents/components/split-view-layout/split-view-layout.component';
import { CurrentDocumentService } from './documents/services/current-document.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToolbarComponent, SplitViewLayoutComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly currentDocumentService = inject(CurrentDocumentService);

  protected readonly title = signal('LectoLectoIA');

  ngOnInit(): void {
    // Cargar documentos existentes al iniciar la app
    this.currentDocumentService.loadDocuments();
  }
}
