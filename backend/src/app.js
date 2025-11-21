/**
 * Configuración principal de la aplicación Express
 * Define middlewares, rutas y configuración de seguridad
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

// Importar middlewares personalizados
const { notFound, errorHandler } = require('./middleware/error-handler');

// Importar rutas
const documentsRoutes = require('./routes/documents.routes');
const notesRoutes = require('./routes/notes.routes');
const processRoutes = require('./routes/process.routes');
const exportRoutes = require('./routes/export.routes');
const notebookRoutes = require('./routes/notebook.routes');
const chatRoutes = require('./routes/chat.routes');

// Crear aplicación Express
const app = express();

// ============================================
// MIDDLEWARES GLOBALES
// ============================================

/**
 * Seguridad: Helmet configura headers HTTP seguros
 */
app.use(helmet());

/**
 * CORS: Permitir peticiones desde el frontend
 * En producción, especificar el dominio exacto
 */
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/**
 * Compresión Gzip para respuestas
 */
app.use(compression());

/**
 * Logger HTTP: Morgan
 * 'dev' para desarrollo, 'combined' para producción
 */
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

/**
 * Parseo de JSON y URL-encoded bodies
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Servir archivos estáticos (uploads) - solo en desarrollo
 * En producción, usar un CDN o servicio de archivos
 */
if (process.env.NODE_ENV === 'development') {
  const uploadsPath = path.join(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploadsPath));
}

// ============================================
// RUTAS
// ============================================

/**
 * Ruta de salud del servidor (health check)
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Ruta raíz con información de la API
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API de LectoLectoIA - Sistema Integral de Lectura y Anotación Digital',
    version: '1.0.0',
    endpoints: {
      documents: '/api/documents',
      notes: '/api/notes',
      process: '/api/process',
      export: '/api/export',
      health: '/health'
    },
    documentation: 'Ver README.md para documentación completa'
  });
});

/**
 * Rutas de la API
 */
app.use('/api/documents', documentsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/process', processRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/chat', chatRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

/**
 * Middleware para rutas no encontradas (404)
 * Debe ir DESPUÉS de todas las rutas definidas
 */
app.use(notFound);

/**
 * Middleware de manejo centralizado de errores
 * Debe ir al FINAL de todos los middlewares
 */
app.use(errorHandler);

module.exports = app;
