const Notebook = require('../models/notebook.model');
const Document = require('../models/document.model');
const { AppError, asyncHandler } = require('../middleware/error-handler');

const getActiveNotebook = asyncHandler(async (req, res, next) => {
  let notebook = await Notebook.findOne({ isActive: true })
    .populate('pages.documentId', 'title originalName');

  if (!notebook) {
    notebook = await Notebook.create({
      name: 'Mi Cuaderno',
      pages: [],
      isActive: true
    });
  }

  res.status(200).json({
    success: true,
    data: notebook
  });
});

const createNotebook = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  await Notebook.updateMany({}, { isActive: false });

  const notebook = await Notebook.create({
    name: name || 'Nuevo Cuaderno',
    pages: [],
    isActive: true
  });

  res.status(201).json({
    success: true,
    message: 'Cuaderno creado exitosamente',
    data: notebook
  });
});

const addPagesToNotebook = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { documentId } = req.body;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  const document = await Document.findById(documentId);
  if (!document) {
    return next(new AppError('Documento no encontrado', 404));
  }

  const currentMaxOrder = notebook.pages.length > 0
    ? Math.max(...notebook.pages.map(p => p.order))
    : -1;

  const pdfPageCount = document.pages || 1;

  for (let i = 1; i <= pdfPageCount; i++) {
    notebook.pages.push({
      type: 'pdf',
      documentId: document._id,
      pageNumber: i,
      order: currentMaxOrder + i,
      visible: true
    });
  }

  await notebook.save();

  const populatedNotebook = await Notebook.findById(id)
    .populate('pages.documentId', 'title originalName');

  res.status(200).json({
    success: true,
    message: 'Páginas agregadas exitosamente',
    data: populatedNotebook
  });
});

const addBlankPage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { afterOrder } = req.body;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  const insertOrder = afterOrder !== undefined ? afterOrder + 1 : notebook.pages.length;

  notebook.pages.forEach(page => {
    if (page.order >= insertOrder) {
      page.order += 1;
    }
  });

  notebook.pages.push({
    type: 'blank',
    order: insertOrder,
    visible: true
  });

  notebook.pages.sort((a, b) => a.order - b.order);

  await notebook.save();

  res.status(200).json({
    success: true,
    message: 'Página en blanco agregada',
    data: notebook
  });
});

const reorderPages = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { pageOrders } = req.body;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  pageOrders.forEach(({ pageId, newOrder }) => {
    const page = notebook.pages.id(pageId);
    if (page) {
      page.order = newOrder;
    }
  });

  notebook.pages.sort((a, b) => a.order - b.order);

  await notebook.save();

  const populatedNotebook = await Notebook.findById(id)
    .populate('pages.documentId', 'title originalName');

  res.status(200).json({
    success: true,
    message: 'Páginas reordenadas exitosamente',
    data: populatedNotebook
  });
});

const deletePage = asyncHandler(async (req, res, next) => {
  const { id, pageId } = req.params;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  const page = notebook.pages.id(pageId);
  if (!page) {
    return next(new AppError('Página no encontrada', 404));
  }

  const deletedOrder = page.order;
  page.deleteOne();

  notebook.pages.forEach(p => {
    if (p.order > deletedOrder) {
      p.order -= 1;
    }
  });

  await notebook.save();

  const populatedNotebook = await Notebook.findById(id)
    .populate('pages.documentId', 'title originalName');

  res.status(200).json({
    success: true,
    message: 'Página eliminada exitosamente',
    data: populatedNotebook
  });
});

const toggleBookMode = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  notebook.bookModeEnabled = !notebook.bookModeEnabled;
  await notebook.save();

  res.status(200).json({
    success: true,
    message: `Modo libro ${notebook.bookModeEnabled ? 'activado' : 'desactivado'}`,
    data: notebook
  });
});

const movePage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { pageId, direction } = req.body;

  const notebook = await Notebook.findById(id);
  if (!notebook) {
    return next(new AppError('Cuaderno no encontrado', 404));
  }

  const sortedPages = [...notebook.pages].sort((a, b) => a.order - b.order);
  const pageIndex = sortedPages.findIndex(p => p._id.toString() === pageId);

  if (pageIndex === -1) {
    return next(new AppError('Página no encontrada', 404));
  }

  const newIndex = direction === 'up' ? pageIndex - 1 : pageIndex + 1;

  if (newIndex < 0 || newIndex >= sortedPages.length) {
    return next(new AppError('No se puede mover en esa dirección', 400));
  }

  const currentPage = notebook.pages.id(pageId);
  const swapPage = notebook.pages.id(sortedPages[newIndex]._id);

  const tempOrder = currentPage.order;
  currentPage.order = swapPage.order;
  swapPage.order = tempOrder;

  await notebook.save();

  const populatedNotebook = await Notebook.findById(id)
    .populate('pages.documentId', 'title originalName');

  res.status(200).json({
    success: true,
    message: 'Página movida exitosamente',
    data: populatedNotebook
  });
});

module.exports = {
  getActiveNotebook,
  createNotebook,
  addPagesToNotebook,
  addBlankPage,
  reorderPages,
  deletePage,
  toggleBookMode,
  movePage
};
