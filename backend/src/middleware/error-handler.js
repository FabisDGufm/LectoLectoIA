/**
 * Middleware centralizado de manejo de errores
 * Procesa todos los errores de la aplicación y retorna respuestas estandarizadas
 */

/**
 * Clase de error personalizada para errores de la aplicación
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Errores operacionales vs errores de programación

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware para manejar rutas no encontradas
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Middleware principal de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log del error en servidor
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', {
      message: error.message,
      stack: err.stack,
      statusCode: error.statusCode
    });
  } else {
    // En producción, solo logear errores no operacionales
    if (!err.isOperational) {
      console.error('❌ Error no operacional:', err);
    }
  }

  // Errores de Mongoose - ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error.message = `Error de validación: ${messages.join(', ')}`;
    error.statusCode = 400;
  }

  // Errores de Mongoose - CastError (ID inválido)
  if (err.name === 'CastError') {
    error.message = `Recurso no encontrado. ID inválido: ${err.value}`;
    error.statusCode = 404;
  }

  // Errores de duplicado de MongoDB (código 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `El campo '${field}' ya existe. Por favor use otro valor.`;
    error.statusCode = 400;
  }

  // Errores de Multer (upload de archivos)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error.message = 'El archivo excede el tamaño máximo permitido (50MB)';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error.message = 'Tipo de archivo no permitido';
    } else {
      error.message = `Error al subir archivo: ${err.message}`;
    }
    error.statusCode = 400;
  }

  // Respuesta al cliente
  res.status(error.statusCode).json({
    success: false,
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Wrapper para funciones asíncronas
 * Evita el uso repetitivo de try-catch
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  notFound,
  errorHandler,
  asyncHandler
};
