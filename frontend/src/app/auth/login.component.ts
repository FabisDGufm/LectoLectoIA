/**
 * Componente de Login
 * Pantalla simple de inicio de sesión
 */

import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>LectoLectoIA</h1>
          <p>Sistema de Lectura y Anotación Digital</p>
        </div>

        <form (ngSubmit)="onLogin()" class="login-form">
          <div class="form-group">
            <label for="username">Nombre de usuario</label>
            <input
              type="text"
              id="username"
              class="form-control"
              [(ngModel)]="username"
              name="username"
              placeholder="Ingresa tu nombre"
              required
              autofocus>
          </div>

          @if (error()) {
            <div class="alert alert-danger">{{ error() }}</div>
          }

          <button
            type="submit"
            class="btn btn-primary btn-login"
            [disabled]="!username.trim()">
            Iniciar Sesión
          </button>
        </form>

        <p class="login-footer">
          Tu sesión se mantendrá activa hasta que cierres sesión
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f5f5;
      padding: 1rem;
    }

    .login-card {
      background: white;
      border: 1px solid #e8e0e0;
      border-radius: 0;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(139, 69, 96, 0.1);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 0.5rem;
    }

    .login-header p {
      color: #666;
      font-size: 0.9rem;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 500;
      color: #444;
    }

    .form-control {
      padding: 0.75rem 1rem;
      border: 1px solid #d4c4c4;
      border-radius: 0;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      outline: none;
      border-color: #8B4560;
    }

    .btn-login {
      padding: 0.875rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0;
      background: linear-gradient(135deg, #8B4560 0%, #6B3A4D 100%);
      border: none;
      color: white;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .btn-login:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(139, 69, 96, 0.3);
    }

    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .alert-danger {
      background: #fee;
      color: #c00;
      padding: 0.75rem;
      border-radius: 0;
      font-size: 0.875rem;
    }

    .login-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: #888;
    }
  `]
})
export class LoginComponent {
  private readonly authService = inject(AuthService);

  username = '';
  error = signal('');

  loginSuccess = output<void>();

  onLogin(): void {
    if (!this.username.trim()) {
      this.error.set('Por favor ingresa tu nombre');
      return;
    }

    const success = this.authService.login(this.username);
    if (success) {
      this.loginSuccess.emit();
    } else {
      this.error.set('Error al iniciar sesión');
    }
  }
}
