/**
 * Controlador de Notas
 * Maneja la lógica de negocio para operaciones CRUD de notas
 */

const Note = require('../models/note.model');
const Document = require('../models/document.model');
const { AppError, asyncHandler } = require('../middleware/error-handler');

/**
 * @desc    Crear nueva nota
 * @route   POST /api/notes
 * @access  Public
 */
const createNote = asyncHandler(async (req, res, next) => {
  const { documentId, pageIndex, anchors, text, tags, color, mode, ink } = req.body;

  // Validar que el documento existe
  const documentExists = await Document.findById(documentId);
  if (!documentExists) {
    return next(new AppError('El documento especificado no existe', 404));
  }

  // Validar que el pageIndex es válido (solo si el documento tiene páginas definidas)
  if (documentExists.pages > 0 && pageIndex >= documentExists.pages) {
    return next(
      new AppError(
        `El índice de página ${pageIndex} excede el número de páginas del documento (${documentExists.pages})`,
        400
      )
    );
  }

  // Crear la nota
  const note = await Note.create({
    documentId,
    pageIndex,
    mode: mode || 'text',
    anchors: anchors || [],
    text,
    ink,
    tags: tags || [],
    color: color || '#ffd700'
  });

  // Poblar información del documento
  await note.populate('documentId', 'title originalName');

  res.status(201).json({
    success: true,
    message: 'Nota creada exitosamente',
    data: note
  });
});

/**
 * @desc    Obtener todas las notas (con filtros opcionales)
 * @route   GET /api/notes
 * @access  Public
 */
const getAllNotes = asyncHandler(async (req, res, next) => {
  const { documentId, pageIndex, tags, search } = req.query;

  // Construir filtro dinámico
  const filter = {};

  if (documentId) {
    filter.documentId = documentId;
  }

  if (pageIndex !== undefined) {
    filter.pageIndex = parseInt(pageIndex, 10);
  }

  if (tags) {
    // Permitir búsqueda por múltiples tags separados por coma
    const tagArray = tags.split(',').map(tag => tag.trim());
    filter.tags = { $in: tagArray };
  }

  // Búsqueda de texto en el contenido de la nota
  if (search) {
    filter.text = { $regex: search, $options: 'i' };
  }

  // Opciones de paginación
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  // Ejecutar consulta
  const notes = await Note.find(filter)
    .populate('documentId', 'title originalName')
    .sort({ pageIndex: 1, createdAt: 1 })
    .skip(skip)
    .limit(limit);

  const total = await Note.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: notes.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: notes
  });
});

/**
 * @desc    Obtener nota por ID
 * @route   GET /api/notes/:id
 * @access  Public
 */
const getNoteById = asyncHandler(async (req, res, next) => {
  const note = await Note.findById(req.params.id).populate(
    'documentId',
    'title originalName'
  );

  if (!note) {
    return next(new AppError('Nota no encontrada', 404));
  }

  res.status(200).json({
    success: true,
    data: note
  });
});

/**
 * @desc    Actualizar nota
 * @route   PUT /api/notes/:id
 * @access  Public
 */
const updateNote = asyncHandler(async (req, res, next) => {
  // Campos permitidos para actualización
  const allowedFields = ['text', 'anchors', 'tags', 'color', 'isFavorite', 'pageIndex', 'mode', 'ink'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const note = await Note.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  }).populate('documentId', 'title originalName');

  if (!note) {
    return next(new AppError('Nota no encontrada', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Nota actualizada exitosamente',
    data: note
  });
});

/**
 * @desc    Eliminar nota
 * @route   DELETE /api/notes/:id
 * @access  Public
 */
const deleteNote = asyncHandler(async (req, res, next) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return next(new AppError('Nota no encontrada', 404));
  }

  await note.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Nota eliminada exitosamente',
    data: {}
  });
});

/**
 * @desc    Eliminar todas las notas de un documento
 * @route   DELETE /api/notes/document/:documentId
 * @access  Public
 */
const deleteNotesByDocument = asyncHandler(async (req, res, next) => {
  const { documentId } = req.params;

  // Verificar que el documento existe
  const documentExists = await Document.findById(documentId);
  if (!documentExists) {
    return next(new AppError('El documento especificado no existe', 404));
  }

  const result = await Note.deleteMany({ documentId });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} notas eliminadas exitosamente`,
    data: { deletedCount: result.deletedCount }
  });
});

/**
 * @desc    Obtener notas favoritas
 * @route   GET /api/notes/favorites
 * @access  Public
 */
const getFavoriteNotes = asyncHandler(async (req, res, next) => {
  const { documentId } = req.query;

  const filter = { isFavorite: true };
  if (documentId) {
    filter.documentId = documentId;
  }

  const notes = await Note.find(filter)
    .populate('documentId', 'title originalName')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes
  });
});

/**
 * @desc    Búsqueda avanzada de notas por texto
 * @route   GET /api/notes/search/:documentId
 * @access  Public
 */
const searchNotesByText = asyncHandler(async (req, res, next) => {
  const { documentId } = req.params;
  const { query } = req.query;

  if (!query) {
    return next(new AppError('Se requiere un término de búsqueda', 400));
  }

  const notes = await Note.searchText(documentId, query);

  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes
  });
});

/**
 * @desc    Obtener estadísticas de notas por documento
 * @route   GET /api/notes/stats/:documentId
 * @access  Public
 */
const getNoteStats = asyncHandler(async (req, res, next) => {
  const { documentId } = req.params;

  const stats = await Note.aggregate([
    { $match: { documentId: require('mongoose').Types.ObjectId(documentId) } },
    {
      $group: {
        _id: '$pageIndex',
        count: { $sum: 1 },
        favorites: {
          $sum: { $cond: ['$isFavorite', 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const totalNotes = await Note.countDocuments({ documentId });

  res.status(200).json({
    success: true,
    data: {
      total: totalNotes,
      byPage: stats
    }
  });
});

module.exports = {
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  deleteNotesByDocument,
  getFavoriteNotes,
  searchNotesByText,
  getNoteStats
};
