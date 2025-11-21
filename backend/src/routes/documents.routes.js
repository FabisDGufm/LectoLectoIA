/**
 * Rutas para el módulo de Documentos
 * Define los endpoints REST para operaciones con documentos
 */

const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  getDocumentFile,
  updateDocument,
  deleteDocument,
  getDocumentStats
} = require('../controllers/documents.controller');
const { upload, validateFileUpload } = require('../middleware/upload.middleware');

/**
 * @route   GET /api/documents/stats/summary
 * @desc    Obtener estadísticas de documentos
 * @access  Public
 */
router.get('/stats/summary', getDocumentStats);

/**
 * @route   POST /api/documents
 * @desc    Subir nuevo documento PDF/EPUB
 * @access  Public
 */
router.post('/', upload.single('file'), validateFileUpload, uploadDocument);

/**
 * @route   GET /api/documents
 * @desc    Obtener lista de documentos con paginación y filtros
 * @access  Public
 */
router.get('/', getAllDocuments);

/**
 * @route   GET /api/documents/:id
 * @desc    Obtener metadatos de un documento específico
 * @access  Public
 */
router.get('/:id', getDocumentById);

/**
 * @route   GET /api/documents/:id/file
 * @desc    Obtener archivo del documento (stream)
 * @access  Public
 */
router.get('/:id/file', getDocumentFile);

/**
 * @route   PUT /api/documents/:id
 * @desc    Actualizar metadatos del documento
 * @access  Public
 */
router.put('/:id', updateDocument);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Eliminar documento y sus notas asociadas
 * @access  Public
 */
router.delete('/:id', deleteDocument);

module.exports = router;
