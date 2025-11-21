/**
 * Rutas para el módulo de Procesamiento
 * Define los endpoints REST para operaciones de procesamiento con servicio Python
 */

const express = require('express');
const router = express.Router();
const {
  extractText,
  applyOCR,
  generateEmbeddings,
  queryDocument,
  checkPythonServiceHealth
} = require('../controllers/process.controller');

/**
 * @route   GET /api/process/health
 * @desc    Verificar estado del servicio Python
 * @access  Public
 */
router.get('/health', checkPythonServiceHealth);

/**
 * @route   POST /api/process/:id/extract
 * @desc    Extraer texto de un documento PDF
 * @access  Public
 */
router.post('/:id/extract', extractText);

/**
 * @route   POST /api/process/:id/ocr
 * @desc    Aplicar OCR a documento escaneado
 * @access  Public
 */
router.post('/:id/ocr', applyOCR);

/**
 * @route   POST /api/process/:id/embeddings
 * @desc    Generar embeddings para búsqueda semántica
 * @access  Public
 */
router.post('/:id/embeddings', generateEmbeddings);

/**
 * @route   POST /api/process/:id/query
 * @desc    Consultar documento usando RAG
 * @access  Public
 */
router.post('/:id/query', queryDocument);

module.exports = router;
