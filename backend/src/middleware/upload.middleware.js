/**
 * Middleware de upload de archivos usando Multer
 * Maneja la subida de PDFs y EPUBs con validación
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { AppError } = require('./error-handler');

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    try {
      // Crear directorio si no existe
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp-random-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_') // Sanitizar nombre
      .substring(0, 50); // Limitar longitud

    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// Filtro de archivos: solo PDF y EPUB
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'application/epub+zip'];
  const allowedExts = ['.pdf', '.epub'];

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedMimes.includes(mimeType) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Tipo de archivo no permitido. Solo se aceptan archivos PDF y EPUB',
        400
      ),
      false
    );
  }
};

// Configuración de Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50MB por defecto
    files: 1 // Solo un archivo a la vez
  }
});

/**
 * Middleware para validar que el archivo fue subido correctamente
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No se ha subido ningún archivo', 400));
  }
  next();
};

/**
 * Función auxiliar para eliminar archivo del sistema de archivos
 * @param {string} filePath - Ruta del archivo a eliminar
 */
const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`🗑️  Archivo eliminado: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error al eliminar archivo ${filePath}:`, error.message);
    // No lanzar error, solo logear
  }
};

module.exports = {
  upload,
  validateFileUpload,
  deleteFile
};
