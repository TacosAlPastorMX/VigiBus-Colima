Documentación Técnica del Proyecto VigiBus Colima

Este documento proporciona una descripción detallada de la arquitectura, componentes y lógica interna del proyecto VigiBus Colima. Está dirigido a desarrolladores que deseen entender, mantener o extender la funcionalidad de la aplicación.

1. Arquitectura General

El sistema sigue una arquitectura Cliente-Servidor desacoplada:

Servidor (Backend): Una API RESTful desarrollada en Python con el framework Flask. Es responsable de toda la lógica de negocio: interactuar con la base de datos, procesar datos y exponerlos a través de endpoints JSON.

Cliente (Frontend): Una Single Page Application (SPA), aunque sencilla, construida con HTML, CSS y JavaScript (Vanilla JS). Se encarga exclusivamente de la presentación: consume los datos de la API y los renderiza en una interfaz de usuario interactiva.

La comunicación entre ambos se realiza a través de peticiones HTTP estándar.

2. Componentes del Backend

El backend está ubicado en la carpeta /backend y se subdivide en tres módulos principales.

2.1. Base de Datos (/database)

Tecnología: SQLite 3. Se eligió por su simplicidad y portabilidad, ya que no requiere un servidor de base de datos separado y se almacena en un único archivo (vigibus.db).

Archivo Principal: vigibus.db.

Esquema de la Tabla incidentes:

id (INTEGER, PK, AUTOINCREMENT): Identificador único del registro.

ruta_afectada (TEXT): Nombre de la ruta (Ej: "Ruta 5").

descripcion_incidente (TEXT): Descripción del problema reportado.

fuente_url (TEXT): URL opcional de la fuente de la noticia.

fecha_extraccion (TIMESTAMP): Fecha y hora en que se registró el incidente.

estado (TEXT): Controla la visibilidad del reporte ('pendiente', 'aprobado', 'rechazado'). Esencial para el flujo de validación.

2.2. API (/api/app.py)

Este es el cerebro del backend. Proporciona los siguientes endpoints:

GET /incidentes

Propósito: Devuelve una lista de todos los incidentes cuyo estado sea 'aprobado'.

Parámetros (Query Params):

ruta (string, opcional): Filtra los resultados por el nombre de una ruta.

limit (int, opcional): Limita el número de resultados. Default: 50.

offset (int, opcional): Permite la paginación de resultados.

Respuesta: Un objeto JSON con una clave data que contiene la lista de incidentes.

POST /reportes

Propósito: Recibe un nuevo reporte ciudadano desde el formulario del frontend.

Cuerpo de la Petición (Request Body): Un JSON con ruta_afectada y descripcion_incidente.

Lógica Clave: Todo reporte recibido a través de este endpoint se inserta en la base de datos con el estado predeterminado de 'pendiente'.

Respuesta: Un mensaje de confirmación.

GET /estadisticas/rutas

Propósito: Devuelve datos agregados para la sección de estadísticas.

Lógica: Realiza una consulta GROUP BY ruta_afectada para contar el número de incidentes por ruta.

Respuesta: Una lista de objetos, donde cada objeto contiene la ruta_afectada y el total_incidentes.

2.3. Scraper (/scraping/scraper.py)

Propósito: (Actualmente un prototipo) Diseñado para recolectar datos de fuentes web.

Lógica: Utiliza requests para descargar el HTML de una URL y BeautifulSoup4 para parsearlo y extraer la información relevante (títulos, descripciones).

Flujo Futuro: Este script sería ejecutado periódicamente (por ejemplo, con un Cron Job) y sus resultados se insertarían en la base de datos a través de la API o directamente.

3. Componentes del Frontend

El frontend está ubicado en la carpeta /frontend y se compone de la estructura (index.html) y la lógica (js/main.js).

3.1. Estructura (index.html)

Utiliza Bootstrap 5 para un diseño responsivo y componentes pre-estilizados.

Define los contenedores principales donde JavaScript inyectará el contenido dinámico:

#incidentes-container: Para las tarjetas de incidentes.

#stats-container: Para las filas de la tabla de estadísticas.

Incluye los "modales" (ventanas emergentes) para el formulario de reporte y el mapa.

3.2. Lógica (js/main.js)

Este archivo contiene la clase principal VigiBusApp, que orquesta toda la interactividad de la página.

init(): Método principal que se ejecuta al cargar la página. Verifica si la API está activa y, si lo está, llama a las funciones para cargar los datos iniciales.

async cargarIncidentes():

Usa la función fetch para hacer una petición GET al endpoint /incidentes de la API.

Una vez que recibe el JSON, limpia el contenedor #incidentes-container.

Itera sobre la lista de incidentes y llama a crearCardIncidente() por cada uno, construyendo el HTML dinámicamente.

async cargarEstadisticas():

Funciona de manera similar, pero llama al endpoint /estadisticas/rutas.

Construye las filas <tr> para la tabla de estadísticas.

async enviarReporte():

Se activa al hacer clic en el botón del formulario de reporte.

Recolecta los datos de los campos del formulario.

Realiza una petición POST al endpoint /reportes, enviando los datos en el cuerpo de la petición en formato JSON.

Muestra un mensaje de éxito o error al usuario.

Navegación: Controla la visibilidad de las secciones #seccion-incidentes y #seccion-estadisticas para simular una navegación sin recargar la página.