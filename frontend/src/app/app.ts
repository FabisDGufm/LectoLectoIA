/**
 * Componente Principal de la Aplicación
 * LectoLectoIA - Sistema Integral de Lectura y Anotación Digital
 */

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from './documents/components/toolbar/toolbar.component';
import { SplitViewLayoutComponent } from './documents/components/split-view-layout/split-view-layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToolbarComponent, SplitViewLayoutComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('LectoLectoIA');

  // Ejemplo de documento para demostración
  // En producción, esto vendría de la ruta/router
  demoDocumentId = '123456789';
  demoPdfUrl = 'assets/sample.pdf'; // Ruta de ejemplo
}
