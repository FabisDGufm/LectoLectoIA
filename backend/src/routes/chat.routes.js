/**
 * Rutas para el módulo de Chat con IA
 * Define los endpoints REST para el chat con Gemini
 */

const express = require('express');
const router = express.Router();
const { sendMessage, checkStatus } = require('../controllers/chat.controller');

/**
 * @route   GET /api/chat/status
 * @desc    Verificar estado de la API de Gemini
 * @access  Public
 */
router.get('/status', checkStatus);

/**
 * @route   POST /api/chat
 * @desc    Enviar mensaje al chat
 * @access  Public
 */
router.post('/', sendMessage);

module.exports = router;
