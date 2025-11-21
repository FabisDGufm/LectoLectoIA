/**
 * Configuración de la Aplicación Angular
 * Proveedores globales y configuración de módulos
 */

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Optimización de detección de cambios
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router para navegación
    provideRouter(routes),

    // HttpClient para peticiones HTTP
    // withFetch: Usa Fetch API en lugar de XMLHttpRequest
    // withInterceptorsFromDi: Permite usar interceptores con DI
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    )
  ]
};
