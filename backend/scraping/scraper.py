import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

def scraper_vigibus_colima():
    """
    Función principal que realiza el scraping de noticias sobre incidentes del transporte público
    en Colima y devuelve una lista estructurada de incidentes.
    
    Returns:
        list: Lista de diccionarios con información de incidentes del transporte público
    """
    # Configuración inicial
    url = "https://noticiasdecolima.com/transporte"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # Realizar la petición HTTP con manejo de errores
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # Lanza excepción para códigos de error HTTP
        
    except requests.exceptions.RequestException as e:
        print(f"Error al conectar con la página: {e}")
        return []  # Retorna lista vacía en caso de error
    
    # Parsear el contenido HTML
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Buscar todos los artículos de noticias
    articulos_noticias = soup.find_all('article', class_='noticia')
    incidentes = []
    
    # Extraer información de cada artículo
    for articulo in articulos_noticias:
        # Extraer ruta afectada usando expresión regular para buscar patrones de "Ruta X"
        titulo_elemento = articulo.find('h2').find('a') if articulo.find('h2') else None
        if not titulo_elemento:
            continue
            
        titulo_texto = titulo_elemento.get_text(strip=True)
        # Buscar patrones como "Ruta X", "Ruta XX", "Ruta N"
        patron_ruta = re.search(r'Ruta\s+(\d+|[A-Za-z0-9]+)', titulo_texto)
        ruta_afectada = patron_ruta.group(0) if patron_ruta else "No especificada"
        
        # Extraer descripción del incidente
        descripcion_elemento = articulo.find('p')
        descripcion_incidente = descripcion_elemento.get_text(strip=True) if descripcion_elemento else "Descripción no disponible"
        
        # Construir URL completa del artículo
        enlace_relativo = titulo_elemento.get('href')
        fuente_url = f"https://noticiasdecolima.com{enlace_relativo}" if enlace_relativo else url
        
        # Crear diccionario con la información del incidente
        incidente = {
            'ruta_afectada': ruta_afectada,
            'descripcion_incidente': descripcion_incidente,
            'fuente_url': fuente_url,
            'fecha_extraccion': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        incidentes.append(incidente)
    
    return incidentes

# Ejemplo de uso y prueba del script
if __name__ == "__main__":
    resultados = scraper_vigibus_colima()
    
    # Mostrar resultados
    print(f"Se encontraron {len(resultados)} incidentes:")
    for i, incidente in enumerate(resultados, 1):
        print(f"\n--- Incidente {i} ---")
        print(f"Ruta afectada: {incidente['ruta_afectada']}")
        print(f"Descripción: {incidente['descripcion_incidente']}")
        print(f"Fuente: {incidente['fuente_url']}")
        print(f"Fecha extracción: {incidente['fecha_extraccion']}")

"""
-------------------------------------------------
*** Notas para Mantenimiento y Escalabilidad ***
-------------------------------------------------

1.  **Selectores CSS Frágiles:**
    - El selector principal es `soup.find_all('article', class_='noticia')`. Si el sitio web cambia el nombre de la clase de 'noticia' a 'articulo-transporte', por ejemplo, el scraper dejará de funcionar.
    - La búsqueda del título (`articulo.find('h2')`) y la descripción (`articulo.find('p')`) también dependen de que se mantengan esas etiquetas HTML.

2.  **Patrón de Expresiones Regulares:**
    - La expresión `r'Ruta\s+(\d+|[A-Za-z0-9]+)'` es bastante robusta. Sin embargo, si los reportes empiezan a usar formatos como "R-5" o "Ruta número 5", habría que ajustar este patrón para incluirlos.

3.  **Estructura de la URL:**
    - El script asume que los enlaces a las noticias son relativos y los concatena con "https://noticiasdecolima.com". Si la web cambia a usar URLs absolutas, la línea que construye la `fuente_url` necesitaría una lógica condicional.
"""