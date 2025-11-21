/**
 * Configuración de conexión a MongoDB
 * Utiliza Mongoose para ODM (Object Document Mapping)
 */

const mongoose = require('mongoose');

/**
 * Establece conexión con MongoDB
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Opciones recomendadas para Mongoose 6+
      // useNewUrlParser y useUnifiedTopology ya no son necesarias
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`📦 Base de datos: ${conn.connection.name}`);

    // Manejo de eventos de conexión
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err);
    });

  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error.message);
    process.exit(1); // Salir si no se puede conectar a la BD
  }
};

/**
 * Cierra la conexión a MongoDB de forma elegante
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 Conexión con MongoDB cerrada');
  } catch (error) {
    console.error('❌ Error al cerrar conexión:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB, disconnectDB };
