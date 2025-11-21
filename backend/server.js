/**
 * Punto de entrada del servidor
 * Inicializa la aplicación Express y establece conexión con MongoDB
 */

require('dotenv').config(); // Cargar variables de entorno

const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/config/database');

// Puerto del servidor
const PORT = process.env.PORT || 4000;

// Variable para almacenar la instancia del servidor
let server;

/**
 * Función para iniciar el servidor
 */
const startServer = async () => {
  try {
    // 1. Conectar a MongoDB
    await connectDB();

    // 2. Iniciar servidor Express
    server = app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('  🚀 SERVIDOR LECTOLECTO INICIADO');
      console.log('='.repeat(60));
      console.log(`  📍 Puerto:        ${PORT}`);
      console.log(`  🌍 Entorno:       ${process.env.NODE_ENV || 'development'}`);
      console.log(`  📡 API Base:      http://localhost:${PORT}/api`);
      console.log(`  ❤️  Health Check: http://localhost:${PORT}/health`);
      console.log('='.repeat(60));
      console.log('');
    });

    // 3. Configurar timeout para peticiones largas (procesamiento de PDFs)
    server.timeout = 600000; // 10 minutos

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

/**
 * Función para cerrar el servidor de forma elegante
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  Señal ${signal} recibida. Cerrando servidor...`);

  if (server) {
    server.close(async () => {
      console.log('🔌 Servidor HTTP cerrado');

      // Cerrar conexión a MongoDB
      await disconnectDB();

      console.log('👋 Apagado completo. ¡Hasta luego!');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos si no se completa
    setTimeout(() => {
      console.error('⚠️  Forzando cierre después de timeout');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

/**
 * Manejo de señales de terminación
 * SIGTERM: señal de terminación estándar
 * SIGINT: Ctrl+C en terminal
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Manejo de errores no capturados
 */
process.on('unhandledRejection', (err) => {
  console.error('❌ ERROR NO MANEJADO (Promise Rejection):');
  console.error(err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (err) => {
  console.error('❌ ERROR NO CAPTURADO (Exception):');
  console.error(err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Iniciar el servidor
startServer();
