/**
 * Controlador de Procesamiento
 * Maneja las solicitudes de procesamiento de documentos con el servicio Python
 */

const Document = require('../models/document.model');
const { AppError, asyncHandler } = require('../middleware/error-handler');
const axios = require('axios');

// URL del servicio Python (desde variable de entorno)
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

/**
 * @desc    Extraer texto de un documento PDF
 * @route   POST /api/process/:id/extract
 * @access  Public
 */
const extractText = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  // Actualizar estado a 'extracting'
  document.processingStatus = 'extracting';
  await document.save();

  try {
    // Llamar al servicio Python para extracción de texto
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/extract`,
      {
        documentId: document._id.toString(),
        filePath: document.storagePath
      },
      {
        timeout: 300000 // 5 minutos timeout para documentos grandes
      }
    );

    // Actualizar estado a 'completed'
    document.processingStatus = 'completed';
    await document.save();

    res.status(200).json({
      success: true,
      message: 'Texto extraído exitosamente',
      data: {
        documentId: document._id,
        extractedText: response.data.text,
        pages: response.data.pages || []
      }
    });
  } catch (error) {
    // Actualizar estado a 'failed' en caso de error
    document.processingStatus = 'failed';
    await document.save();

    console.error('Error al extraer texto:', error.message);

    return next(
      new AppError(
        `Error al procesar el documento: ${error.response?.data?.error || error.message}`,
        500
      )
    );
  }
});

/**
 * @desc    Aplicar OCR a un documento escaneado
 * @route   POST /api/process/:id/ocr
 * @access  Public
 */
const applyOCR = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  // Actualizar estado
  document.processingStatus = 'extracting';
  await document.save();

  try {
    // Llamar al servicio Python para OCR
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/ocr`,
      {
        documentId: document._id.toString(),
        filePath: document.storagePath,
        language: req.body.language || 'spa' // Español por defecto
      },
      {
        timeout: 600000 // 10 minutos para OCR (puede ser lento)
      }
    );

    document.processingStatus = 'completed';
    await document.save();

    res.status(200).json({
      success: true,
      message: 'OCR aplicado exitosamente',
      data: {
        documentId: document._id,
        extractedText: response.data.text,
        confidence: response.data.confidence
      }
    });
  } catch (error) {
    document.processingStatus = 'failed';
    await document.save();

    console.error('Error al aplicar OCR:', error.message);

    return next(
      new AppError(
        `Error al aplicar OCR: ${error.response?.data?.error || error.message}`,
        500
      )
    );
  }
});

/**
 * @desc    Generar embeddings para un documento
 * @route   POST /api/process/:id/embeddings
 * @access  Public
 */
const generateEmbeddings = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  try {
    // Llamar al servicio Python para generar embeddings
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/embeddings`,
      {
        documentId: document._id.toString(),
        filePath: document.storagePath,
        chunkSize: req.body.chunkSize || 1000,
        chunkOverlap: req.body.chunkOverlap || 200
      },
      {
        timeout: 600000 // 10 minutos
      }
    );

    res.status(200).json({
      success: true,
      message: 'Embeddings generados exitosamente',
      data: {
        documentId: document._id,
        chunksProcessed: response.data.chunksProcessed,
        embeddingsCount: response.data.embeddingsCount
      }
    });
  } catch (error) {
    console.error('Error al generar embeddings:', error.message);

    return next(
      new AppError(
        `Error al generar embeddings: ${error.response?.data?.error || error.message}`,
        500
      )
    );
  }
});

/**
 * @desc    Consultar al documento usando RAG (Retrieval Augmented Generation)
 * @route   POST /api/process/:id/query
 * @access  Public
 */
const queryDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  const { question } = req.body;

  if (!question) {
    return next(new AppError('Se requiere una pregunta', 400));
  }

  try {
    // Llamar al servicio Python para RAG query
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/query`,
      {
        documentId: document._id.toString(),
        question,
        topK: req.body.topK || 5
      },
      {
        timeout: 120000 // 2 minutos
      }
    );

    res.status(200).json({
      success: true,
      data: {
        question,
        answer: response.data.answer,
        sources: response.data.sources || []
      }
    });
  } catch (error) {
    console.error('Error al consultar documento:', error.message);

    return next(
      new AppError(
        `Error al consultar documento: ${error.response?.data?.error || error.message}`,
        500
      )
    );
  }
});

/**
 * @desc    Verificar estado del servicio Python
 * @route   GET /api/process/health
 * @access  Public
 */
const checkPythonServiceHealth = asyncHandler(async (req, res, next) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000
    });

    res.status(200).json({
      success: true,
      message: 'Servicio Python activo',
      data: response.data
    });
  } catch (error) {
    return next(
      new AppError(
        'Servicio Python no disponible. Asegúrese de que esté ejecutándose.',
        503
      )
    );
  }
});

module.exports = {
  extractText,
  applyOCR,
  generateEmbeddings,
  queryDocument,
  checkPythonServiceHealth
};
