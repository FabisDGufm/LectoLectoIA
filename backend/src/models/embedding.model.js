/**
 * Modelo de Embedding
 * Almacena vectores de embeddings para búsqueda semántica
 * NOTA: Preparado para Fase 2 - IA y búsqueda semántica
 */

const mongoose = require('mongoose');

const embeddingSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'La referencia al documento es obligatoria'],
      index: true
    },
    chunkId: {
      type: String,
      required: [true, 'El ID del chunk es obligatorio'],
      index: true
    },
    // Texto del fragmento
    text: {
      type: String,
      required: [true, 'El texto es obligatorio'],
      trim: true
    },
    // Vector de embedding (dimensión depende del modelo usado)
    vector: {
      type: [Number],
      required: [true, 'El vector de embedding es obligatorio'],
      validate: {
        validator: function(v) {
          // Validar que todos los elementos sean números
          return Array.isArray(v) && v.length > 0 && v.every(num => typeof num === 'number');
        },
        message: 'El vector debe ser un array de números'
      }
    },
    // Metadatos adicionales
    metadata: {
      pageIndex: Number,
      startChar: Number,
      endChar: Number,
      model: String, // Modelo usado para generar el embedding (ej: 'text-embedding-ada-002')
      chunkSize: Number,
      overlap: Number
    }
  },
  {
    timestamps: true
  }
);

// Índices para optimizar búsqueda
embeddingSchema.index({ documentId: 1, chunkId: 1 }, { unique: true });
embeddingSchema.index({ 'metadata.pageIndex': 1 });

// Método estático para búsqueda por similitud (placeholder para futuro)
embeddingSchema.statics.findSimilar = async function(queryVector, documentId = null, limit = 10) {
  // NOTA: MongoDB Atlas soporta búsqueda vectorial con $vectorSearch
  // Para implementación local, se usará ChromaDB en el microservicio Python
  console.warn('⚠️  Método findSimilar() es un placeholder. Implementar en Fase 2 con ChromaDB.');

  const query = documentId ? { documentId } : {};
  return this.find(query).limit(limit);
};

// Método estático para eliminar embeddings de un documento
embeddingSchema.statics.deleteByDocument = function(documentId) {
  return this.deleteMany({ documentId });
};

const Embedding = mongoose.model('Embedding', embeddingSchema);

module.exports = Embedding;
