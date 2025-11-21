/**
 * Servicio de Chat con IA
 * Maneja la comunicación con el backend para el chat con Gemini
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  success: boolean;
  data?: {
    message: string;
    timestamp: string;
  };
  error?: string;
}

export interface ChatStatusResponse {
  success: boolean;
  data: {
    configured: boolean;
    model: string;
    provider: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/chat`;

  // Estado del chat
  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  isConfigured = signal(false);

  constructor() {
    this.checkStatus();
  }

  /**
   * Verificar si Gemini está configurado
   */
  checkStatus(): void {
    this.http.get<ChatStatusResponse>(`${this.apiUrl}/status`).subscribe({
      next: (response) => {
        this.isConfigured.set(response.data?.configured || false);
      },
      error: () => {
        this.isConfigured.set(false);
      }
    });
  }

  /**
   * Enviar mensaje al chat
   */
  sendMessage(message: string, context?: string): Observable<ChatResponse> {
    // Agregar mensaje del usuario al historial
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMessage]);

    // Preparar historial para el backend
    const history = this.messages().slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));

    this.isLoading.set(true);

    return this.http.post<ChatResponse>(this.apiUrl, {
      message,
      context,
      history
    });
  }

  /**
   * Agregar respuesta del asistente
   */
  addAssistantMessage(content: string): void {
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, assistantMessage]);
    this.isLoading.set(false);
  }

  /**
   * Limpiar historial de chat
   */
  clearMessages(): void {
    this.messages.set([]);
  }

  /**
   * Marcar como no cargando (en caso de error)
   */
  setNotLoading(): void {
    this.isLoading.set(false);
  }
}
