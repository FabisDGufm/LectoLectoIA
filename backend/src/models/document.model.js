/**
 * Modelo de Documento
 * Representa archivos PDF subidos al sistema
 */

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true,
      maxlength: [255, 'El título no puede exceder 255 caracteres']
    },
    originalName: {
      type: String,
      required: [true, 'El nombre original del archivo es obligatorio'],
      trim: true
    },
    mimeType: {
      type: String,
      required: [true, 'El tipo MIME es obligatorio'],
      enum: {
        values: ['application/pdf', 'application/epub+zip'],
        message: 'Solo se permiten archivos PDF y EPUB'
      }
    },
    size: {
      type: Number,
      required: [true, 'El tamaño del archivo es obligatorio'],
      min: [0, 'El tamaño no puede ser negativo']
    },
    storagePath: {
      type: String,
      required: [true, 'La ruta de almacenamiento es obligatoria'],
      unique: true
    },
    pages: {
      type: Number,
      default: 0,
      min: [0, 'El número de páginas no puede ser negativo']
    },
    // Estado de procesamiento
    processingStatus: {
      type: String,
      enum: ['pending', 'extracting', 'completed', 'failed'],
      default: 'pending'
    },
    // Texto extraído del documento (OCR/extracción)
    extractedText: {
      type: String,
      default: ''
    },
    // Texto por página (para contexto más preciso)
    extractedPages: [{
      pageNumber: Number,
      text: String
    }],
    // Metadatos adicionales
    metadata: {
      author: String,
      subject: String,
      keywords: [String],
      creator: String,
      producer: String,
      creationDate: Date
    }
  },
  {
    timestamps: true, // Añade createdAt y updatedAt automáticamente
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual para obtener el tamaño formateado
documentSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
});

// Índices para mejorar el rendimiento de consultas
documentSchema.index({ createdAt: -1 });
documentSchema.index({ title: 'text' }); // Búsqueda de texto completo

// Middleware pre-remove para limpiar notas asociadas
documentSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    // Eliminar todas las notas asociadas a este documento
    await mongoose.model('Note').deleteMany({ documentId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
