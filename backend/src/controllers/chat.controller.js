/**
 * Controlador de Chat con Gemini
 * Maneja la comunicación con Google AI Studio (Gemini API)
 */

const { GoogleGenAI } = require('@google/genai');
const { asyncHandler } = require('../middleware/error-handler');

// Inicializar cliente de Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * @desc    Enviar mensaje al chat de Gemini
 * @route   POST /api/chat
 * @access  Public
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { message, context, history } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un mensaje'
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'API Key de Gemini no configurada'
    });
  }

  try {
    // Construir el prompt con contexto del documento si existe
    let systemPrompt = `Eres un asistente de estudio inteligente llamado "LectoIA".
Tu rol es ayudar a los estudiantes a comprender mejor sus documentos PDF y tomar notas efectivas.
Responde de forma concisa, clara y en español.
Si el usuario pregunta sobre el contenido del documento, usa el contexto proporcionado.
Puedes ayudar a:
- Resumir secciones del documento
- Explicar conceptos difíciles
- Generar preguntas de estudio
- Crear flashcards
- Sugerir técnicas de estudio`;

    if (context) {
      systemPrompt += `\n\nContexto del documento actual:\n${context}`;
    }

    // Construir historial de conversación
    const contents = [];

    // Agregar historial previo si existe
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });
    }

    // Agregar mensaje actual
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Llamar a Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      contents: contents
    });

    const reply = response.text;

    res.status(200).json({
      success: true,
      data: {
        message: reply,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en Gemini API:', error);
    res.status(500).json({
      success: false,
      error: 'Error al comunicarse con Gemini: ' + (error.message || 'Error desconocido')
    });
  }
});

/**
 * @desc    Verificar estado de la API de Gemini
 * @route   GET /api/chat/status
 * @access  Public
 */
const checkStatus = asyncHandler(async (req, res) => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  res.status(200).json({
    success: true,
    data: {
      configured: hasApiKey,
      model: 'gemini-2.0-flash',
      provider: 'Google AI Studio'
    }
  });
});

module.exports = {
  sendMessage,
  checkStatus
};
