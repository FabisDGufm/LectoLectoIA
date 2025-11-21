/**
 * Servicio de Exportación de PDFs Anotados
 * Usa pdf-lib para agregar overlays de texto y trazos ink sobre el PDF original
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const Note = require('../../models/note.model');
const Document = require('../../models/document.model');

class ExportService {
  /**
   * Exporta PDF con anotaciones overlay
   * @param {string} documentId - ID del documento
   * @returns {Promise<Buffer>} PDF anotado
   */
  async exportAnnotatedPdf(documentId) {
    try {
      // 1. Obtener documento y notas
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Documento no encontrado');
      }

      const notes = await Note.find({ documentId }).sort({ pageIndex: 1 });

      // 2. Cargar PDF original
      const originalPdfPath = path.join(process.cwd(), document.storagePath);
      const originalPdfBytes = await fs.readFile(originalPdfPath);
      const pdfDoc = await PDFDocument.load(originalPdfBytes);

      // 3. Preparar fuente
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 4. Agregar anotaciones por página
      const pages = pdfDoc.getPages();

      for (const note of notes) {
        const pageIndex = note.pageIndex;

        // Validar que la página existe
        if (pageIndex >= pages.length) {
          console.warn(`Nota ${note._id} referencia página ${pageIndex} que no existe`);
          continue;
        }

        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        if (note.mode === 'text' && note.text) {
          // Anotación de texto
          await this._addTextAnnotation(page, note, font, boldFont, pageWidth, pageHeight);
        } else if (note.mode === 'ink' && note.ink) {
          // Anotación de tinta (trazos a mano)
          await this._addInkAnnotation(page, note, pageWidth, pageHeight);
        }
      }

      // 5. Serializar y retornar
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);

    } catch (error) {
      console.error('Error al exportar PDF anotado:', error);
      throw new Error(`Error al exportar PDF anotado: ${error.message}`);
    }
  }

  /**
   * Agrega anotación de texto al PDF
   * @private
   */
  async _addTextAnnotation(page, note, font, boldFont, pageWidth, pageHeight) {
    const { anchors, text, color } = note;

    // Si no hay anchors, colocar en la esquina superior derecha
    let x = pageWidth - 200;
    let y = pageHeight - 50;
    let maxWidth = 180;

    // Si hay anchors, usar el primero para posicionar
    if (anchors && anchors.length > 0) {
      const anchor = anchors[0];
      // Convertir coordenadas (PDF usa origen inferior izquierdo)
      x = anchor.x;
      y = pageHeight - anchor.y - anchor.height;
      maxWidth = Math.min(anchor.width || 180, 400);
    }

    // Color de la nota (por defecto amarillo)
    const noteColor = this._hexToRgb(color || '#ffd700');

    // Dibujar fondo semi-transparente (caja amarilla)
    const textLines = this._wrapText(text, maxWidth, 10);
    const boxHeight = (textLines.length * 14) + 16;
    const boxWidth = maxWidth;

    page.drawRectangle({
      x: x - 4,
      y: y - boxHeight + 10,
      width: boxWidth,
      height: boxHeight,
      color: noteColor,
      opacity: 0.3,
      borderColor: rgb(noteColor.red * 0.7, noteColor.green * 0.7, noteColor.blue * 0.7),
      borderWidth: 1
    });

    // Dibujar texto
    let currentY = y;
    for (const line of textLines) {
      page.drawText(line, {
        x: x,
        y: currentY,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
        maxWidth: maxWidth
      });
      currentY -= 14;
    }
  }

  /**
   * Agrega anotación de tinta (trazos a mano) al PDF
   * @private
   */
  async _addInkAnnotation(page, note, pageWidth, pageHeight) {
    const { ink, anchors } = note;

    // Calcular offset si hay anchor
    let offsetX = 0;
    let offsetY = 0;

    if (anchors && anchors.length > 0) {
      const anchor = anchors[0];
      offsetX = anchor.x;
      offsetY = pageHeight - anchor.y; // Invertir Y para PDF
    }

    // Dibujar cada trazo
    if (ink.strokes && ink.strokes.length > 0) {
      for (const stroke of ink.strokes) {
        const { points, width = 2, color = '#000000' } = stroke;

        if (points.length < 2) continue;

        const strokeColor = this._hexToRgb(color);

        // Dibujar líneas entre puntos consecutivos
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          // Convertir coordenadas (invertir Y para PDF)
          const x1 = offsetX + p1.x;
          const y1 = offsetY - p1.y;
          const x2 = offsetX + p2.x;
          const y2 = offsetY - p2.y;

          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: width,
            color: strokeColor,
            opacity: 0.8
          });
        }
      }
    }
  }

  /**
   * Exporta notas a JSON
   * @param {string} documentId - ID del documento
   * @returns {Promise<string>} JSON string
   */
  async exportNotesJson(documentId) {
    const notes = await Note.find({ documentId }).sort({ pageIndex: 1, createdAt: 1 }).lean();
    return JSON.stringify(notes, null, 2);
  }

  /**
   * Exporta notas a Markdown
   * @param {string} documentId - ID del documento
   * @returns {Promise<string>} Markdown string
   */
  async exportNotesMarkdown(documentId) {
    const document = await Document.findById(documentId);
    const notes = await Note.find({ documentId }).sort({ pageIndex: 1, createdAt: 1 });

    let markdown = `# Notas: ${document?.title || 'Documento'}\n\n`;
    markdown += `**Fecha de exportación:** ${new Date().toLocaleString('es-ES')}\n\n`;
    markdown += `**Total de notas:** ${notes.length}\n\n`;
    markdown += `---\n\n`;

    let currentPage = -1;

    for (const note of notes) {
      // Encabezado de página si cambia
      if (note.pageIndex !== currentPage) {
        currentPage = note.pageIndex;
        markdown += `## Página ${currentPage + 1}\n\n`;
      }

      // Nota
      if (note.mode === 'text') {
        markdown += `### Nota (Texto)\n\n`;
        markdown += `${note.text}\n\n`;
      } else if (note.mode === 'ink') {
        const strokeCount = note.ink?.strokes?.length || 0;
        markdown += `### Nota (Dibujo a mano)\n\n`;
        markdown += `*[Dibujo con ${strokeCount} trazo${strokeCount !== 1 ? 's' : ''}]*\n\n`;
      }

      // Metadatos
      if (note.tags && note.tags.length > 0) {
        markdown += `**Etiquetas:** ${note.tags.join(', ')}\n\n`;
      }

      if (note.isFavorite) {
        markdown += `⭐ **Marcado como favorito**\n\n`;
      }

      markdown += `*Creado: ${new Date(note.createdAt).toLocaleString('es-ES')}*\n\n`;
      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Crea archivo ZIP con todo: PDF original, notas JSON/MD, y PDF anotado
   * @param {string} documentId - ID del documento
   * @param {WritableStream} outputStream - Stream de salida
   * @returns {Promise<void>}
   */
  async exportZip(documentId, outputStream) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Documento no encontrado');
      }

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(outputStream);

      // 1. PDF original
      const originalPdfPath = path.join(process.cwd(), document.storagePath);
      archive.file(originalPdfPath, { name: `original_${document.originalName}` });

      // 2. Notas JSON
      const notesJson = await this.exportNotesJson(documentId);
      archive.append(notesJson, { name: 'notas.json' });

      // 3. Notas Markdown
      const notesMd = await this.exportNotesMarkdown(documentId);
      archive.append(notesMd, { name: 'notas.md' });

      // 4. PDF anotado
      const annotatedPdf = await this.exportAnnotatedPdf(documentId);
      archive.append(annotatedPdf, { name: `anotado_${document.originalName}` });

      // Finalizar
      await archive.finalize();

    } catch (error) {
      console.error('Error al crear ZIP:', error);
      throw new Error(`Error al crear ZIP: ${error.message}`);
    }
  }

  /**
   * Convierte color hex a objeto RGB para pdf-lib
   * @private
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? rgb(
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255
        )
      : rgb(1, 1, 0); // Amarillo por defecto
  }

  /**
   * Divide texto en líneas según ancho máximo
   * @private
   */
  _wrapText(text, maxWidth, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    const charWidthApprox = fontSize * 0.5; // Aproximación
    const maxCharsPerLine = Math.floor(maxWidth / charWidthApprox);

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}

module.exports = new ExportService();
