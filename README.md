VigiBus Colima - Dashboard de Inteligencia Ciudadana

VigiBus Colima es un prototipo de aplicación web full-stack diseñado para monitorear y reportar incidentes del transporte público en la zona de Colima y Villa de Álvarez, México. A diferencia de las aplicaciones de seguimiento en tiempo real, VigiBus se enfoca en recopilar, centralizar y presentar información de contexto que afecta el servicio, como retrasos, desvíos o unidades fuera de servicio, utilizando datos obtenidos de fuentes públicas.

El proyecto también incluye una funcionalidad de reporte ciudadano, permitiendo a los usuarios enviar sus propios informes, los cuales son validados antes de ser mostrados públicamente.

🚀 Características Principales

Dashboard de Incidentes: Visualización en tiempo real de los incidentes aprobados, presentados en tarjetas claras y concisas.

Sección de Estadísticas: Gráficos y métricas sobre las rutas con más problemas, tendencias de incidentes por día y más.

Reporte Ciudadano: Un formulario intuitivo para que los usuarios envíen sus propios reportes, los cuales quedan en estado "pendiente" para validación.

Scraper de Datos: Un script en Python que (en una versión futura) recolectará datos de fuentes públicas para alimentar el sistema.

API RESTful: Un backend robusto que sirve los datos al frontend de manera eficiente.

🛠️ Tecnologías Utilizadas

Este es un proyecto full-stack que demuestra la integración de diversas tecnologías:

Backend:

Lenguaje: Python 3

API Framework: Flask

Base de Datos: SQLite 3

Web Scraping: Requests y BeautifulSoup4 (en el script scraper.py).

Frontend:

Lenguajes: HTML5, CSS3, JavaScript (ES6+)

Framework CSS: Bootstrap 5

Librería de Mapas: Leaflet.js

Librería de Gráficos: Chart.js

Entorno:

Gestor de Paquetes Python: pip

⚙️ Instalación y Puesta en Marcha Local

Para ejecutar este proyecto en tu propia máquina, sigue estos pasos:

Prerrequisitos

Tener Python 3.x instalado.

Tener pip (el gestor de paquetes de Python) instalado.

Pasos de Instalación

Clona el repositorio (o descarga los archivos):

git clone proximamente
cd vigibus-colima


Navega a la carpeta del backend e instala las dependencias:

cd backend
pip install -r requirements.txt


(Asegúrate de haber creado el archivo requirements.txt con pip freeze > requirements.txt)

Poblar la base de datos con datos iniciales (opcional):
Si es la primera vez que lo ejecutas, puedes poblar la base de datos con datos de prueba.

cd database
python poblar_db.py


Inicia el servidor del Backend (API):
Desde la carpeta backend/api/, ejecuta:

python app.py


El servidor comenzará a funcionar en http://127.0.0.1:5000. Deja esta terminal abierta.

Abre el Frontend:

Abre una nueva terminal o explorador de archivos.

Navega a la carpeta frontend/.

Abre el archivo index.html en tu navegador web. Se recomienda usar una extensión como Live Server en Visual Studio Code para una mejor experiencia.

¡Y listo! La aplicación debería estar funcionando localmente.

🏛️ Arquitectura del Proyecto

El proyecto está organizado en dos componentes principales, backend y frontend, para una clara separación de responsabilidades.

/VIGIBUS COLIMA - PROYECTO
|
├── backend/
|   ├── api/          # Contiene la API de Flask (app.py)
|   ├── database/     # Almacena la base de datos (vigibus.db) y scripts relacionados
|   └── scraping/     # Contiene el script del scraper
|
└── frontend/
    ├── css/          # Estilos CSS
    ├── js/           # Lógica JavaScript (main.js)
    └── index.html    # Estructura principal de la página


🤝 Contribuciones

Este es un proyecto académico, pero las sugerencias y mejoras son siempre bienvenidas. Si encuentras un bug o tienes una idea, por favor abre un "Issue" en el repositorio.
Creado y diseñado por TECNICO PROGRAMADOR JUANPABLO ENMANUEL GOMEZ DOMINGUEZ