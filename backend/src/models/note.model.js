/**
 * Modelo de Nota
 * Representa anotaciones del usuario sobre documentos
 */

const mongoose = require('mongoose');

// Subesquema para anclas (puntos de referencia en el documento)
const anchorSchema = new mongoose.Schema({
  x: {
    type: Number,
    required: true,
    min: 0
  },
  y: {
    type: Number,
    required: true,
    min: 0
  },
  width: {
    type: Number,
    default: 0,
    min: 0
  },
  height: {
    type: Number,
    default: 0,
    min: 0
  },
  pageIndex: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false }); // No generar _id para subdocumentos

// Subesquema para trazos de tinta (modo "a mano")
const strokeSchema = new mongoose.Schema({
  points: {
    type: [{
      x: Number,
      y: Number,
      t: Number // timestamp opcional para análisis de velocidad
    }],
    required: true
  },
  width: {
    type: Number,
    default: 2,
    min: 0.5,
    max: 20
  },
  color: {
    type: String,
    default: '#000000',
    match: [/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un código hexadecimal válido']
  }
}, { _id: false });

// Subesquema para datos de tinta
const inkSchema = new mongoose.Schema({
  svgPath: {
    type: String, // Path SVG escalable (preferible para calidad)
    default: null
  },
  strokes: {
    type: [strokeSchema], // Trazos crudos para edición
    default: []
  },
  pngPath: {
    type: String, // Opcional: rasterizado para export rápido
    default: null
  }
}, { _id: false });

const noteSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'La referencia al documento es obligatoria'],
      index: true
    },
    pageIndex: {
      type: Number,
      required: [true, 'El índice de página es obligatorio'],
      min: [0, 'El índice de página debe ser mayor o igual a 0']
    },
    // Modo de la nota: 'text' (escritura) o 'ink' (a mano)
    mode: {
      type: String,
      enum: ['text', 'ink'],
      default: 'text',
      required: true
    },
    // Anclas de posición en el documento (pueden ser múltiples para texto seleccionado)
    anchors: {
      type: [anchorSchema],
      default: []
    },
    // Contenido de texto (para mode === 'text')
    text: {
      type: String,
      trim: true,
      maxlength: [10000, 'La nota no puede exceder 10000 caracteres']
    },
    // Contenido de tinta (para mode === 'ink')
    ink: {
      type: inkSchema,
      default: null
    },
    // Etiquetas para organización (preparado para futuras fases)
    tags: {
      type: [String],
      default: []
    },
    // Color de la nota (preparado para personalización)
    color: {
      type: String,
      default: '#ffd700', // Amarillo por defecto
      match: [/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un código hexadecimal válido']
    },
    // Indicador de favorito
    isFavorite: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Validación personalizada: asegurar que text o ink estén presentes según el mode
noteSchema.pre('validate', function(next) {
  if (this.mode === 'text') {
    if (!this.text || this.text.trim().length === 0) {
      return next(new Error('El texto es obligatorio para notas en modo texto'));
    }
  } else if (this.mode === 'ink') {
    if (!this.ink || (!this.ink.svgPath && (!this.ink.strokes || this.ink.strokes.length === 0))) {
      return next(new Error('Los trazos son obligatorios para notas en modo tinta'));
    }
  }
  next();
});

// Índices compuestos para optimizar consultas
noteSchema.index({ documentId: 1, pageIndex: 1 });
noteSchema.index({ documentId: 1, createdAt: -1 });
noteSchema.index({ documentId: 1, mode: 1 });
noteSchema.index({ tags: 1 });

// Método virtual para obtener un resumen de la nota
noteSchema.virtual('preview').get(function() {
  if (this.mode === 'text') {
    const maxLength = 100;
    if (this.text.length <= maxLength) {
      return this.text;
    }
    return this.text.substring(0, maxLength) + '...';
  } else if (this.mode === 'ink') {
    const strokeCount = this.ink?.strokes?.length || 0;
    return `[Dibujo a mano: ${strokeCount} trazo${strokeCount !== 1 ? 's' : ''}]`;
  }
  return '[Nota vacía]';
});

// Método estático para obtener notas por documento
noteSchema.statics.findByDocument = function(documentId, options = {}) {
  const query = this.find({ documentId });

  // Ordenar por página y fecha de creación
  if (options.sortBy) {
    query.sort(options.sortBy);
  } else {
    query.sort({ pageIndex: 1, createdAt: 1 });
  }

  // Paginación
  if (options.limit) {
    query.limit(options.limit);
  }
  if (options.skip) {
    query.skip(options.skip);
  }

  return query;
};

// Método estático para búsqueda de texto
noteSchema.statics.searchText = function(documentId, searchTerm) {
  return this.find({
    documentId,
    text: { $regex: searchTerm, $options: 'i' } // Búsqueda case-insensitive
  }).sort({ createdAt: -1 });
};

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
