/**
 * Componente Principal de la Aplicación
 * LectoLectoIA - Sistema Integral de Lectura y Anotación Digital
 */

import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from './documents/components/toolbar/toolbar.component';
import { SplitViewLayoutComponent } from './documents/components/split-view-layout/split-view-layout.component';
import { CurrentDocumentService } from './documents/services/current-document.service';
import { AuthService } from './auth/auth.service';
import { LoginComponent } from './auth/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToolbarComponent, SplitViewLayoutComponent, LoginComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly currentDocumentService = inject(CurrentDocumentService);
  readonly authService = inject(AuthService);

  protected readonly title = signal('LectoLectoIA');

  ngOnInit(): void {
    // Solo cargar documentos si el usuario está logueado
    if (this.authService.isLoggedIn()) {
      this.currentDocumentService.loadDocuments();
    }
  }

  onLoginSuccess(): void {
    // Cargar documentos después del login
    this.currentDocumentService.loadDocuments();
  }
}
