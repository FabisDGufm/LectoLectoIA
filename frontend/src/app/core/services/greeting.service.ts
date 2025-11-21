/**
 * Servicio de Saludo Dinámico
 * Genera saludos según la hora del día
 */

import { Injectable, signal, effect } from '@angular/core';

export interface GreetingInfo {
  message: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

@Injectable({
  providedIn: 'root'
})
export class GreetingService {
  // Estado reactivo del saludo
  private readonly greetingSignal = signal<GreetingInfo>(this.generateGreeting());

  // Propiedad pública readonly
  public readonly greeting = this.greetingSignal.asReadonly();

  constructor() {
    // Actualizar saludo cada hora
    setInterval(() => {
      this.updateGreeting();
    }, 3600000); // 1 hora en milisegundos

    // También actualizar al enfocar la ventana
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.updateGreeting();
      });
    }
  }

  /**
   * Actualiza el saludo manualmente
   */
  updateGreeting(): void {
    this.greetingSignal.set(this.generateGreeting());
  }

  /**
   * Obtiene el saludo actual
   */
  getCurrentGreeting(): GreetingInfo {
    return this.greetingSignal();
  }

  /**
   * Genera el saludo según la hora actual
   */
  private generateGreeting(): GreetingInfo {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return {
        message: 'Buenos días',
        timeOfDay: 'morning'
      };
    } else if (hour >= 12 && hour < 18) {
      return {
        message: 'Buenas tardes',
        timeOfDay: 'afternoon'
      };
    } else if (hour >= 18 && hour < 22) {
      return {
        message: 'Buenas noches',
        timeOfDay: 'evening'
      };
    } else {
      return {
        message: 'Buenas noches',
        timeOfDay: 'night'
      };
    }
  }

  /**
   * Obtiene un mensaje de bienvenida personalizado
   */
  getWelcomeMessage(userName?: string): string {
    const greeting = this.greetingSignal();
    if (userName) {
      return `${greeting.message}, ${userName}`;
    }
    return greeting.message;
  }

  /**
   * Obtiene recomendaciones basadas en la hora del día
   */
  getTimeBasedRecommendation(): string {
    const { timeOfDay } = this.greetingSignal();

    switch (timeOfDay) {
      case 'morning':
        return 'Perfecto momento para comenzar con tus lecturas';
      case 'afternoon':
        return 'Continúa con tus anotaciones y estudios';
      case 'evening':
        return 'Buen momento para revisar tus notas del día';
      case 'night':
        return 'Recuerda descansar adecuadamente';
      default:
        return 'Disfruta de tu lectura';
    }
  }
}
