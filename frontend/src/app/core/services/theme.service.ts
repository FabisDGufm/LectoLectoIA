/**
 * Servicio de Tema
 * Maneja el modo oscuro y preferencias de tema del usuario
 * Implementación lista para personalización futura
 */

import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Estado reactivo del tema usando signals
  private readonly themeSignal = signal<Theme>(this.getStoredTheme() || 'light');

  // Propiedad pública readonly para acceder al theme
  public readonly theme = this.themeSignal.asReadonly();

  // Clave para localStorage
  private readonly STORAGE_KEY = 'lectolecto-theme';

  constructor() {
    // Efecto que se ejecuta cuando cambia el theme
    effect(() => {
      this.applyTheme(this.themeSignal());
    });

    // Aplicar tema inicial
    this.applyTheme(this.themeSignal());

    // Escuchar cambios de preferencia del sistema
    this.detectSystemPreference();
  }

  /**
   * Alterna entre modo claro y oscuro
   */
  toggleTheme(): void {
    const newTheme: Theme = this.themeSignal() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Establece un tema específico
   */
  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
    this.storeTheme(theme);
  }

  /**
   * Obtiene el tema actual
   */
  getCurrentTheme(): Theme {
    return this.themeSignal();
  }

  /**
   * Verifica si el modo oscuro está activo
   */
  isDarkMode(): boolean {
    return this.themeSignal() === 'dark';
  }

  /**
   * Aplica el tema al documento
   */
  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark-mode');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark-mode');
    }
  }

  /**
   * Almacena el tema en localStorage
   */
  private storeTheme(theme: Theme): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.warn('No se pudo guardar la preferencia de tema:', error);
    }
  }

  /**
   * Obtiene el tema almacenado en localStorage
   */
  private getStoredTheme(): Theme | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored === 'dark' || stored === 'light' ? stored : null;
    } catch (error) {
      console.warn('No se pudo leer la preferencia de tema:', error);
      return null;
    }
  }

  /**
   * Detecta preferencia de tema del sistema operativo
   */
  private detectSystemPreference(): void {
    if (!this.getStoredTheme()) {
      // Solo aplicar preferencia del sistema si no hay preferencia guardada
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

      if (prefersDark.matches) {
        this.setTheme('dark');
      }

      // Escuchar cambios en la preferencia del sistema
      prefersDark.addEventListener('change', (e) => {
        if (!this.getStoredTheme()) {
          // Solo actualizar si el usuario no ha elegido manualmente
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * PREPARADO PARA FASE 2: Personalización avanzada de colores
   *
   * Métodos que se implementarán en futuras fases:
   * - setCustomColors(colors: ThemeColors): void
   * - resetToDefaultColors(): void
   * - exportThemeConfig(): string
   * - importThemeConfig(config: string): void
   */

  // TODO: Implementar en Fase 2
  // setCustomColors(colors: ThemeColors): void {
  //   // Permitir al usuario personalizar colores desde la UI
  // }
}

/**
 * PREPARADO PARA FASE 2: Interfaz de colores personalizables
 */
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
}
