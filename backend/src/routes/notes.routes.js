/**
 * Rutas para el módulo de Notas
 * Define los endpoints REST para operaciones con notas
 */

const express = require('express');
const router = express.Router();
const {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  deleteNotesByDocument,
  getFavoriteNotes,
  searchNotesByText,
  getNoteStats
} = require('../controllers/notes.controller');

/**
 * @route   GET /api/notes/favorites
 * @desc    Obtener notas favoritas
 * @access  Public
 */
router.get('/favorites', getFavoriteNotes);

/**
 * @route   GET /api/notes/search/:documentId
 * @desc    Búsqueda de texto en notas de un documento
 * @access  Public
 */
router.get('/search/:documentId', searchNotesByText);

/**
 * @route   GET /api/notes/stats/:documentId
 * @desc    Obtener estadísticas de notas por documento
 * @access  Public
 */
router.get('/stats/:documentId', getNoteStats);

/**
 * @route   DELETE /api/notes/document/:documentId
 * @desc    Eliminar todas las notas de un documento
 * @access  Public
 */
router.delete('/document/:documentId', deleteNotesByDocument);

/**
 * @route   POST /api/notes
 * @desc    Crear nueva nota
 * @access  Public
 */
router.post('/', createNote);

/**
 * @route   GET /api/notes
 * @desc    Obtener lista de notas con filtros
 * @access  Public
 */
router.get('/', getAllNotes);

/**
 * @route   GET /api/notes/:id
 * @desc    Obtener nota específica por ID
 * @access  Public
 */
router.get('/:id', getNoteById);

/**
 * @route   PUT /api/notes/:id
 * @desc    Actualizar nota
 * @access  Public
 */
router.put('/:id', updateNote);

/**
 * @route   DELETE /api/notes/:id
 * @desc    Eliminar nota
 * @access  Public
 */
router.delete('/:id', deleteNote);

module.exports = router;
