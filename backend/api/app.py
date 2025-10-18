from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime
import logging
from flask_cors import CORS
from pathlib import Path

# ---  CONSTRUYE LA RUTA CORRECTA A LA BASE DE DATOS ---
# Esto sube dos niveles desde app.py (api -> backend) y luego entra a la carpeta 'database'
DB_PATH = Path(__file__).parent.parent / 'database' / 'vigibus.db'

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def get_db_connection():
    """Establece conexión con la base de datos SQLite"""
    conn = sqlite3.connect(DB_PATH) # <-- 3. USA LA RUTA INTELIGENTE
    conn.row_factory = sqlite3.Row  # Permite acceso a columnas por nombre
    return conn

def create_incident_table():
    """Crea la tabla de incidentes si no existe"""
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS incidentes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ruta_afectada TEXT NOT NULL,
                descripcion_incidente TEXT NOT NULL,
                fuente_url TEXT,
                fecha_extraccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        logger.info("Tabla 'incidentes' verificada/creada exitosamente")
    except Exception as e:
        logger.error(f"Error creando tabla: {e}")
    finally:
        conn.close()

# REEMPLAZA TODA TU FUNCIÓN get_incidentes CON ESTA VERSIÓN CORREGIDA

@app.route('/incidentes', methods=['GET'])
def get_incidentes():
    """
    Obtiene todos los incidentes APROBADOS con opciones de filtrado y paginación
    """
    try:
        ruta_filter = request.args.get('ruta')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        conn = get_db_connection()
        
        if ruta_filter:
            incidentes = conn.execute(
                'SELECT * FROM incidentes WHERE ruta_afectada LIKE ? AND estado = ? ORDER BY fecha_extraccion DESC LIMIT ? OFFSET ?',
                (f'%{ruta_filter}%', 'aprobado', limit, offset)
            ).fetchall()
        else:
            incidentes = conn.execute(
                'SELECT * FROM incidentes WHERE estado = ? ORDER BY fecha_extraccion DESC LIMIT ? OFFSET ?',
                ('aprobado', limit, offset)
            ).fetchall()
        
        incidentes_list = [dict(ix) for ix in incidentes]
        
        if ruta_filter:
            total_count = conn.execute(
                'SELECT COUNT(*) FROM incidentes WHERE ruta_afectada LIKE ? AND estado = ?',
                (f'%{ruta_filter}%', 'aprobado')
            ).fetchone()[0]
        else:
            total_count = conn.execute('SELECT COUNT(*) FROM incidentes WHERE estado = ?', ('aprobado',)).fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': incidentes_list,
            'metadata': {
                'total': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': (offset + len(incidentes_list)) < total_count
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo incidentes: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

# --- Endpoint para recibir reportes ciudadanos (YA CREADO) ---
@app.route('/reportes', methods=['POST'])
def recibir_reporte():
    try:
        data = request.get_json()
        ruta = data['ruta_afectada']
        descripcion = data['descripcion_incidente']

        if not ruta or not descripcion:
            return jsonify({'success': False, 'error': 'Faltan datos'}), 400

        conn = get_db_connection()
        conn.execute(
            'INSERT INTO incidentes (ruta_afectada, descripcion_incidente, estado) VALUES (?, ?, ?)',
            (ruta, descripcion, 'pendiente')
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Reporte recibido. Será revisado.'}), 201

    except Exception as e:
        logger.error(f"Error recibiendo reporte: {e}")
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@app.route('/incidentes/<int:incidente_id>', methods=['GET'])
def get_incidente(incidente_id):
    """Obtiene un incidente específico por ID"""
    try:
        conn = get_db_connection()
        incidente = conn.execute(
            'SELECT * FROM incidentes WHERE id = ?', 
            (incidente_id,)
        ).fetchone()
        conn.close()
        
        if incidente is None:
            return jsonify({
                'success': False,
                'error': 'Incidente no encontrado'
            }), 404
        
        return jsonify({
            'success': True,
            'data': dict(incidente)
        }), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo incidente {incidente_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

@app.route('/incidentes', methods=['POST'])
def create_incidente():
    """Crea un nuevo incidente"""
    try:
        data = request.get_json()
        
        # Validación de campos requeridos
        required_fields = ['ruta_afectada', 'descripcion_incidente']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'error': f'Campo requerido faltante: {field}'
                }), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO incidentes (ruta_afectada, descripcion_incidente, fuente_url, fecha_extraccion)
            VALUES (?, ?, ?, ?)
        ''', (
            data['ruta_afectada'],
            data['descripcion_incidente'],
            data.get('fuente_url'),
            data.get('fecha_extraccion', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        ))
        
        incidente_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Nuevo incidente creado con ID: {incidente_id}")
        
        return jsonify({
            'success': True,
            'message': 'Incidente creado exitosamente',
            'id': incidente_id
        }), 201
        
    except Exception as e:
        logger.error(f"Error creando incidente: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

@app.route('/incidentes/<int:incidente_id>', methods=['PUT'])
def update_incidente(incidente_id):
    """Actualiza un incidente existente"""
    try:
        data = request.get_json()
        
        conn = get_db_connection()
        
        # Verificar que el incidente existe
        existing = conn.execute(
            'SELECT id FROM incidentes WHERE id = ?', 
            (incidente_id,)
        ).fetchone()
        
        if existing is None:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Incidente no encontrado'
            }), 404
        
        # Construir query dinámica basada en los campos proporcionados
        update_fields = []
        values = []
        
        if 'ruta_afectada' in data:
            update_fields.append('ruta_afectada = ?')
            values.append(data['ruta_afectada'])
        
        if 'descripcion_incidente' in data:
            update_fields.append('descripcion_incidente = ?')
            values.append(data['descripcion_incidente'])
        
        if 'fuente_url' in data:
            update_fields.append('fuente_url = ?')
            values.append(data['fuente_url'])
        
        if not update_fields:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'No se proporcionaron campos para actualizar'
            }), 400
        
        values.append(incidente_id)
        
        query = f'UPDATE incidentes SET {", ".join(update_fields)} WHERE id = ?'
        conn.execute(query, values)
        conn.commit()
        conn.close()
        
        logger.info(f"Incidente {incidente_id} actualizado exitosamente")
        
        return jsonify({
            'success': True,
            'message': 'Incidente actualizado exitosamente'
        }), 200
        
    except Exception as e:
        logger.error(f"Error actualizando incidente {incidente_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

@app.route('/incidentes/<int:incidente_id>', methods=['DELETE'])
def delete_incidente(incidente_id):
    """Elimina un incidente"""
    try:
        conn = get_db_connection()
        
        # Verificar que el incidente existe
        existing = conn.execute(
            'SELECT id FROM incidentes WHERE id = ?', 
            (incidente_id,)
        ).fetchone()
        
        if existing is None:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Incidente no encontrado'
            }), 404
        
        conn.execute('DELETE FROM incidentes WHERE id = ?', (incidente_id,))
        conn.commit()
        conn.close()
        
        logger.info(f"Incidente {incidente_id} eliminado exitosamente")
        
        return jsonify({
            'success': True,
            'message': 'Incidente eliminado exitosamente'
        }), 200
        
    except Exception as e:
        logger.error(f"Error eliminando incidente {incidente_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

@app.route('/estadisticas/rutas', methods=['GET'])
def get_estadisticas_rutas():
    """Obtiene estadísticas de incidentes por ruta"""
    try:
        conn = get_db_connection()
        
        stats = conn.execute('''
            SELECT 
                ruta_afectada,
                COUNT(*) as total_incidentes,
                MAX(fecha_extraccion) as ultimo_incidente
            FROM incidentes 
            GROUP BY ruta_afectada 
            ORDER BY total_incidentes DESC
        ''').fetchall()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': [dict(row) for row in stats]
        }), 200
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {e}")
        return jsonify({
            'success': False,
            'error': 'Error interno del servidor'
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Manejador para endpoints no encontrados"""
    return jsonify({
        'success': False,
        'error': 'Endpoint no encontrado'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """Manejador para métodos no permitidos"""
    return jsonify({
        'success': False,
        'error': 'Método no permitido'
    }), 405

# Inicialización de la aplicación
if __name__ == '__main__':
    create_incident_table()
    app.run(debug=True, host='0.0.0.0', port=5000)