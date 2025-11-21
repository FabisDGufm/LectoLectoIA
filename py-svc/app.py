"""
Servicio Python Flask para Procesamiento de Documentos
LectoLectoIA - Sistema Integral de Lectura y Anotación Digital

Este microservicio maneja:
- Extracción de texto de PDFs
- OCR para documentos escaneados
- Generación de embeddings
- Consultas RAG (Retrieval Augmented Generation)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from dotenv import load_dotenv
import pdfplumber

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Cargar variables de entorno
load_dotenv()

# Crear aplicación Flask
app = Flask(__name__)

# Configurar CORS
CORS(app, resources={
    r"/api/*": {
        "origins": os.getenv('CORS_ORIGIN', 'http://localhost:4200'),
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configuración
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
PORT = int(os.getenv('PORT', 5000))
DEBUG = os.getenv('FLASK_ENV', 'development') == 'development'

# ============================================
# RUTAS DE SALUD Y INFO
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    Verifica que el servicio esté funcionando
    """
    return jsonify({
        'success': True,
        'message': 'Servicio Python funcionando correctamente',
        'status': 'healthy',
        'version': '1.0.0'
    }), 200


@app.route('/', methods=['GET'])
def index():
    """
    Ruta raíz con información del servicio
    """
    return jsonify({
        'success': True,
        'message': 'Servicio Python - LectoLectoIA',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'extract': '/api/extract',
            'ocr': '/api/ocr',
            'embeddings': '/api/embeddings',
            'query': '/api/query'
        }
    }), 200


# ============================================
# RUTAS API - PROCESAMIENTO DE DOCUMENTOS
# ============================================

@app.route('/api/extract', methods=['POST'])
def extract_text():
    """
    Extrae texto de un documento PDF usando pdfplumber

    Request Body:
    {
        "documentId": "string",
        "filePath": "string"
    }

    Response:
    {
        "success": true,
        "text": "string",
        "pages": [...]
    }
    """
    try:
        data = request.get_json()

        if not data or 'filePath' not in data:
            return jsonify({
                'success': False,
                'error': 'Se requiere el campo filePath'
            }), 400

        file_path = data['filePath']
        document_id = data.get('documentId')

        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': f'Archivo no encontrado: {file_path}'
            }), 404

        # Extraer texto con pdfplumber
        pages_data = []
        full_text = []

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ''
                pages_data.append({
                    'pageNumber': i + 1,
                    'text': page_text
                })
                full_text.append(f"--- Página {i + 1} ---\n{page_text}")

        combined_text = '\n\n'.join(full_text)

        result = {
            'success': True,
            'message': 'Texto extraído exitosamente',
            'documentId': document_id,
            'text': combined_text,
            'pages': pages_data,
            'totalPages': len(pages_data)
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error al extraer texto: {str(e)}'
        }), 500


@app.route('/api/ocr', methods=['POST'])
def apply_ocr():
    """
    Aplica OCR a un documento escaneado

    Request Body:
    {
        "documentId": "string",
        "filePath": "string",
        "language": "spa"
    }

    Response:
    {
        "success": true,
        "text": "string",
        "confidence": 0.95
    }
    """
    try:
        data = request.get_json()

        if not data or 'filePath' not in data:
            return jsonify({
                'success': False,
                'error': 'Se requiere el campo filePath'
            }), 400

        file_path = data['filePath']
        language = data.get('language', 'spa')
        document_id = data.get('documentId')

        # TODO: Implementar OCR real con Tesseract
        # from services.ocr_service import apply_tesseract_ocr
        # result = apply_tesseract_ocr(file_path, language)

        # Placeholder
        result = {
            'success': True,
            'message': 'OCR aplicado exitosamente',
            'documentId': document_id,
            'text': f'Texto extraído con OCR del archivo: {file_path}',
            'confidence': 0.92,
            'language': language
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error al aplicar OCR: {str(e)}'
        }), 500


@app.route('/api/embeddings', methods=['POST'])
def generate_embeddings():
    """
    Genera embeddings para búsqueda semántica

    Request Body:
    {
        "documentId": "string",
        "filePath": "string",
        "chunkSize": 1000,
        "chunkOverlap": 200
    }

    Response:
    {
        "success": true,
        "chunksProcessed": 50,
        "embeddingsCount": 50
    }
    """
    try:
        data = request.get_json()

        if not data or 'filePath' not in data:
            return jsonify({
                'success': False,
                'error': 'Se requiere el campo filePath'
            }), 400

        file_path = data['filePath']
        document_id = data.get('documentId')
        chunk_size = data.get('chunkSize', 1000)
        chunk_overlap = data.get('chunkOverlap', 200)

        # TODO: Implementar generación de embeddings con LangChain + ChromaDB
        # from services.embedding_service import generate_document_embeddings
        # result = generate_document_embeddings(file_path, document_id, chunk_size, chunk_overlap)

        # Placeholder
        result = {
            'success': True,
            'message': 'Embeddings generados exitosamente',
            'documentId': document_id,
            'chunksProcessed': 45,
            'embeddingsCount': 45,
            'chunkSize': chunk_size,
            'chunkOverlap': chunk_overlap
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error al generar embeddings: {str(e)}'
        }), 500


@app.route('/api/query', methods=['POST'])
def query_document():
    """
    Consulta al documento usando RAG

    Request Body:
    {
        "documentId": "string",
        "question": "string",
        "topK": 5
    }

    Response:
    {
        "success": true,
        "answer": "string",
        "sources": [...]
    }
    """
    try:
        data = request.get_json()

        if not data or 'question' not in data:
            return jsonify({
                'success': False,
                'error': 'Se requiere el campo question'
            }), 400

        question = data['question']
        document_id = data.get('documentId')
        top_k = data.get('topK', 5)

        # TODO: Implementar RAG con LangChain + Ollama
        # from services.llm_service import query_with_rag
        # result = query_with_rag(document_id, question, top_k)

        # Placeholder
        result = {
            'success': True,
            'question': question,
            'answer': f'Respuesta generada para: "{question}". En futuras fases, esto será procesado por IA local (Ollama).',
            'sources': [
                {'page': 1, 'relevance': 0.95, 'snippet': 'Fragmento relevante 1...'},
                {'page': 3, 'relevance': 0.87, 'snippet': 'Fragmento relevante 2...'}
            ]
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error al consultar documento: {str(e)}'
        }), 500


# ============================================
# MANEJO DE ERRORES
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Ruta no encontrada'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Error interno del servidor'
    }), 500


# ============================================
# PUNTO DE ENTRADA
# ============================================

if __name__ == '__main__':
    print('=' * 60)
    print('  🐍 SERVICIO PYTHON FLASK - LECTOLECTO')
    print('=' * 60)
    print(f'  📍 Puerto:        {PORT}')
    print(f'  🌍 Entorno:       {os.getenv("FLASK_ENV", "development")}')
    print(f'  📡 API Base:      http://localhost:{PORT}/api')
    print(f'  ❤️  Health Check: http://localhost:{PORT}/health')
    print('=' * 60)
    print()

    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
