/**
 * Controlador de Documentos
 * Maneja la lógica de negocio para operaciones CRUD de documentos
 */

const Document = require('../models/document.model');
const Notebook = require('../models/notebook.model');
const { AppError, asyncHandler } = require('../middleware/error-handler');
const { deleteFile } = require('../middleware/upload.middleware');
const path = require('path');
const fs = require('fs').promises;
const { PDFDocument } = require('pdf-lib');

/**
 * @desc    Subir nuevo documento
 * @route   POST /api/documents
 * @access  Public (por ahora, en fase base)
 */
const uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No se ha proporcionado ningún archivo', 400));
  }

  const { title } = req.body;

  let pageCount = 1;
  try {
    const pdfBuffer = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pageCount = pdfDoc.getPageCount();
    console.log('Páginas detectadas:', pageCount);
  } catch (err) {
    console.log('No se pudo contar páginas del PDF:', err.message);
  }

  const document = await Document.create({
    title: title || req.file.originalname,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath: req.file.path,
    pages: pageCount,
    processingStatus: 'completed'
  });

  let notebook = await Notebook.findOne({ isActive: true });
  if (!notebook) {
    notebook = await Notebook.create({
      name: 'Mi Cuaderno',
      pages: [],
      isActive: true
    });
  }

  const currentMaxOrder = notebook.pages.length > 0
    ? Math.max(...notebook.pages.map(p => p.order))
    : -1;

  for (let i = 1; i <= pageCount; i++) {
    notebook.pages.push({
      type: 'pdf',
      documentId: document._id,
      pageNumber: i,
      order: currentMaxOrder + i,
      visible: true
    });
  }

  await notebook.save();

  res.status(201).json({
    success: true,
    message: 'Documento subido exitosamente',
    data: document
  });
});

/**
 * @desc    Obtener todos los documentos
 * @route   GET /api/documents
 * @access  Public
 */
const getAllDocuments = asyncHandler(async (req, res, next) => {
  // Opciones de paginación y filtrado
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Filtros opcionales
  const filter = {};
  if (req.query.mimeType) {
    filter.mimeType = req.query.mimeType;
  }
  if (req.query.processingStatus) {
    filter.processingStatus = req.query.processingStatus;
  }

  // Búsqueda por texto en el título
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  // Ejecutar consulta con paginación
  const documents = await Document.find(filter)
    .sort({ createdAt: -1 }) // Más recientes primero
    .skip(skip)
    .limit(limit)
    .select('-__v'); // Excluir campo de versión

  // Contar total de documentos para paginación
  const total = await Document.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: documents.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: documents
  });
});

/**
 * @desc    Obtener documento por ID
 * @route   GET /api/documents/:id
 * @access  Public
 */
const getDocumentById = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  res.status(200).json({
    success: true,
    data: document
  });
});

/**
 * @desc    Obtener archivo del documento (stream)
 * @route   GET /api/documents/:id/file
 * @access  Public
 */
const getDocumentFile = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  // Verificar que el archivo existe
  try {
    await fs.access(document.storagePath);
  } catch (error) {
    return next(new AppError('Archivo no encontrado en el sistema', 404));
  }

  // Configurar headers para streaming
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
  res.setHeader('Content-Length', document.size);

  // Stream del archivo
  const fileStream = require('fs').createReadStream(document.storagePath);

  fileStream.on('error', (error) => {
    console.error('Error al leer archivo:', error);
    return next(new AppError('Error al leer el archivo', 500));
  });

  fileStream.pipe(res);
});

/**
 * @desc    Actualizar metadatos del documento
 * @route   PUT /api/documents/:id
 * @access  Public
 */
const updateDocument = asyncHandler(async (req, res, next) => {
  // Campos permitidos para actualización
  const allowedFields = ['title', 'pages', 'processingStatus', 'metadata'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const document = await Document.findByIdAndUpdate(
    req.params.id,
    updates,
    {
      new: true, // Retornar documento actualizado
      runValidators: true // Ejecutar validaciones del schema
    }
  );

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Documento actualizado exitosamente',
    data: document
  });
});

/**
 * @desc    Eliminar documento
 * @route   DELETE /api/documents/:id
 * @access  Public
 */
const deleteDocument = asyncHandler(async (req, res, next) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  // Eliminar archivo físico
  await deleteFile(document.storagePath);

  // Eliminar documento de la BD (el middleware pre-remove eliminará las notas asociadas)
  await document.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Documento eliminado exitosamente',
    data: {}
  });
});

/**
 * @desc    Obtener estadísticas de documentos
 * @route   GET /api/documents/stats/summary
 * @access  Public
 */
const getDocumentStats = asyncHandler(async (req, res, next) => {
  const stats = await Document.aggregate([
    {
      $group: {
        _id: '$processingStatus',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]);

  const totalDocuments = await Document.countDocuments();

  res.status(200).json({
    success: true,
    data: {
      total: totalDocuments,
      byStatus: stats
    }
  });
});

module.exports = {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  getDocumentFile,
  updateDocument,
  deleteDocument,
  getDocumentStats
};
