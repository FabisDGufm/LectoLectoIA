/**
 * Rutas de Exportación
 * Endpoints para exportar documentos y notas en varios formatos
 */

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');

// @route   GET /api/export/:id/pdf
// @desc    Exporta PDF con anotaciones overlay
// @access  Public
router.get('/:id/pdf', exportController.exportAnnotatedPdf);

// @route   GET /api/export/:id/notes.json
// @desc    Exporta notas en formato JSON
// @access  Public
router.get('/:id/notes.json', exportController.exportNotesJson);

// @route   GET /api/export/:id/notes.md
// @desc    Exporta notas en formato Markdown
// @access  Public
router.get('/:id/notes.md', exportController.exportNotesMarkdown);

// @route   GET /api/export/:id/zip
// @desc    Exporta ZIP completo (PDF original + notas + PDF anotado)
// @access  Public
router.get('/:id/zip', exportController.exportZip);

// @route   GET /api/export/:id/original
// @desc    Descarga el PDF original sin anotaciones
// @access  Public
router.get('/:id/original', exportController.downloadOriginal);

module.exports = router;
