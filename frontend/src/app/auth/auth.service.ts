/**
 * Servicio de Autenticación Simple
 * Maneja login/logout con persistencia en localStorage
 */

import { Injectable, signal, computed } from '@angular/core';

export interface User {
  username: string;
  displayName: string;
  loginTime: Date;
}

const STORAGE_KEY = 'lectolecto_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = signal<User | null>(null);

  // Computed públicos
  readonly currentUser = computed(() => this._currentUser());
  readonly isLoggedIn = computed(() => this._currentUser() !== null);
  readonly displayName = computed(() => this._currentUser()?.displayName || '');

  constructor() {
    // Restaurar sesión al iniciar
    this.restoreSession();
  }

  /**
   * Restaura la sesión desde localStorage
   */
  private restoreSession(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored) as User;
        user.loginTime = new Date(user.loginTime);
        this._currentUser.set(user);
        console.log('[Auth] Sesión restaurada:', user.displayName);
      }
    } catch (error) {
      console.error('[Auth] Error restaurando sesión:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Inicia sesión con nombre de usuario
   */
  login(username: string, displayName?: string): boolean {
    if (!username.trim()) {
      return false;
    }

    const user: User = {
      username: username.trim().toLowerCase(),
      displayName: displayName?.trim() || username.trim(),
      loginTime: new Date()
    };

    this._currentUser.set(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    console.log('[Auth] Usuario logueado:', user.displayName);
    return true;
  }

  /**
   * Cierra sesión
   */
  logout(): void {
    this._currentUser.set(null);
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Auth] Sesión cerrada');
  }

  /**
   * Obtiene el saludo según la hora del día
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    const name = this.displayName();

    if (hour < 12) {
      return `Buenos días, ${name}`;
    } else if (hour < 19) {
      return `Buenas tardes, ${name}`;
    } else {
      return `Buenas noches, ${name}`;
    }
  }
}
