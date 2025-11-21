/**
 * Controlador de Exportación
 * Maneja endpoints para exportar documentos y notas en diversos formatos
 */

const exportService = require('../services/pdf/export.service');
const Document = require('../models/document.model');

/**
 * @route   GET /api/export/:id/pdf
 * @desc    Exporta PDF con anotaciones overlay
 * @access  Public
 */
exports.exportAnnotatedPdf = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Generar PDF anotado
    const pdfBuffer = await exportService.exportAnnotatedPdf(id);

    // Configurar headers para descarga
    const filename = `anotado_${document.originalName}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Enviar PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en exportAnnotatedPdf:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar PDF anotado',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/export/:id/notes.json
 * @desc    Exporta notas en formato JSON
 * @access  Public
 */
exports.exportNotesJson = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Generar JSON
    const jsonString = await exportService.exportNotesJson(id);

    // Configurar headers
    const filename = `notas_${document.originalName.replace('.pdf', '')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Enviar JSON
    res.send(jsonString);

  } catch (error) {
    console.error('Error en exportNotesJson:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar notas JSON',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/export/:id/notes.md
 * @desc    Exporta notas en formato Markdown
 * @access  Public
 */
exports.exportNotesMarkdown = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Generar Markdown
    const markdown = await exportService.exportNotesMarkdown(id);

    // Configurar headers
    const filename = `notas_${document.originalName.replace('.pdf', '')}.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Enviar Markdown
    res.send(markdown);

  } catch (error) {
    console.error('Error en exportNotesMarkdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar notas Markdown',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/export/:id/zip
 * @desc    Exporta ZIP con PDF original, notas JSON/MD, y PDF anotado
 * @access  Public
 */
exports.exportZip = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Configurar headers para ZIP
    const filename = `export_${document.originalName.replace('.pdf', '')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Generar y enviar ZIP (stream directo a response)
    await exportService.exportZip(id, res);

  } catch (error) {
    console.error('Error en exportZip:', error);
    // No podemos enviar JSON si ya empezamos a enviar el ZIP
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error al exportar ZIP',
        error: error.message
      });
    }
  }
};

/**
 * @route   GET /api/export/:id/original
 * @desc    Descarga el PDF original sin anotaciones
 * @access  Public
 */
exports.downloadOriginal = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Redirigir al endpoint existente de descarga
    res.redirect(`/api/documents/${id}/file`);

  } catch (error) {
    console.error('Error en downloadOriginal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar PDF original',
      error: error.message
    });
  }
};
