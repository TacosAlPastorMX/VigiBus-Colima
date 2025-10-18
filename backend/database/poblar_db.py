import sqlite3
from pathlib import Path

# --- Datos de prueba ---
incidentes_prueba = [
    ('Ruta 5', 'Desvío por obras en Av. Tecnológico. Tomar precauciones.', 'https://noticia.com/nota1'),
    ('Ruta 19', 'Unidad fuera de servicio por falla mecánica cerca del centro.', 'https://otranoticia.com/nota2'),
    ('Ruta 1', 'Retraso de 20 minutos por tráfico pesado en el Tercer Anillo.', 'https://reporte.com/nota3'),
    ('Ruta 5', 'Servicio reestablecido después de desvío temporal.', 'https://noticia.com/nota4'),
    ('Ruta 21A', 'No se reportan incidentes, operación normal.', 'https://informe.com/nota5')
]

try:
    # ---  CONSTRUYE LA RUTA CORRECTA A LA BASE DE DATOS ---
    # La base de datos está en la misma carpeta que este script
    DB_PATH = Path(__file__).parent / 'vigibus.db'

    # Conexión a la base de datos usando la ruta inteligente
    conn = sqlite3.connect(DB_PATH) # <--  USA LA RUTA INTELIGENTE
    cursor = conn.cursor()
    print("Conexión exitosa a la base de datos.")

    # Asegurarse de que la tabla exista antes de insertar
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidentes (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            ruta_afectada           TEXT NOT NULL, -- <-- ¡TYPO CORREGIDO AQUÍ!
            descripcion_incidente   TEXT NOT NULL,
            fuente_url              TEXT,
            fecha_extraccion        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("Tabla 'incidentes' verificada/creada exitosamente.")

    # Insertar los datos de prueba
    cursor.executemany('''
        INSERT INTO incidentes (ruta_afectada, descripcion_incidente, fuente_url)
        VALUES (?, ?, ?)
    ''', incidentes_prueba)

    conn.commit()
    print(f"¡Éxito! Se han insertado {cursor.rowcount} registros de prueba en la tabla 'incidentes'.")

except sqlite3.Error as e:
    print(f"Error al interactuar con la base de datos: {e}")

finally:
    if conn:
        conn.close()
        print("Conexión a la base de datos cerrada.")