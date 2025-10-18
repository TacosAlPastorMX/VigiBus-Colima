class VigiBusApp {
    constructor() {
        this.API_BASE_URL = 'http://127.0.0.1:5000';
        this.incidentes = [];
        this.estadisticas = {
            rutas: [],
            totalIncidentes: 0,
            rutasUnicas: 0,
            incidentesHoy: 0,
            rutaCritica: '-',
            insights: {},
            tendencias: []
        };
        this.filtroRuta = '';
        this.charts = {};
        this.isAPIActive = false;
        this.mapaManager = null; // Inicializar como null
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando VigiBus App...');
        this.isAPIActive = await this.verificarEstadoAPI();
        
        if (this.isAPIActive) {
            console.log('✅ API conectada, inicializando componentes...');
            this.bindEvents();
            await this.cargarDatosIniciales();
            this.actualizarHora();
            
            // Configurar actualización automática cada 5 minutos
            setInterval(async () => {
                if (this.isAPIActive) {
                    await this.cargarDatosIniciales();
                }
            }, 300000);
        } else {
            console.error('❌ API no disponible');
            this.mostrarErrorAPI();
        }
    }

    // Método para inicializar el mapa cuando sea necesario
    inicializarMapa() {
        try {
            // Verificar que el modal del mapa esté en el DOM
            const mapaModal = document.getElementById('mapaModal');
            if (!mapaModal) {
                console.warn('⚠️ Modal del mapa no encontrado en el DOM');
                return false;
            }

            // Verificar que el contenedor del mapa existe dentro del modal
            const mapaContainer = document.getElementById('mapa-container');
            if (!mapaContainer) {
                console.warn('⚠️ Contenedor del mapa no encontrado, intentando más tarde...');
                return false;
            }

            // Verificar si Leaflet está disponible
            if (typeof L === 'undefined') {
                console.error('❌ Leaflet no está cargado');
                return false;
            }

            // Crear instancia del mapa manager si no existe
            if (!this.mapaManager) {
                this.mapaManager = new MapaManager();
            }

            // Inicializar el mapa si no está inicializado
            if (!this.mapaManager.inicializado) {
                const exito = this.mapaManager.init();
                if (exito) {
                    console.log('✅ Mapa inicializado correctamente');
                    return true;
                } else {
                    console.error('❌ Falló la inicialización del mapa');
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Error inicializando el mapa:', error);
            return false;
        }
    }

    configurarAccesibilidadModales() {
        // Configurar eventos para los modales
        const reporteModal = document.getElementById('reporteModal');
        const mapaModal = document.getElementById('mapaModal');
        
        if (reporteModal) {
            reporteModal.addEventListener('show.bs.modal', () => {
                this.actualizarAccesibilidadModal(reporteModal, true);
            });
            
            reporteModal.addEventListener('hide.bs.modal', () => {
                this.actualizarAccesibilidadModal(reporteModal, false);
            });
        }
        
        if (mapaModal) {
            mapaModal.addEventListener('show.bs.modal', () => {
                this.actualizarAccesibilidadModal(mapaModal, true);
                // Re-inicializar el mapa cuando se abre el modal
                setTimeout(() => {
                    if (this.mapaManager && this.mapaManager.mapa) {
                        this.mapaManager.mapa.invalidateSize();
                    }
                }, 100);
            });
            
            mapaModal.addEventListener('hide.bs.modal', () => {
                this.actualizarAccesibilidadModal(mapaModal, false);
            });
        }
    }

    actualizarAccesibilidadModal(modal, isOpen) {
        if (isOpen) {
            modal.removeAttribute('aria-hidden');
            modal.setAttribute('aria-modal', 'true');
            // Enfocar el primer elemento interactivo cuando se abre el modal
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select, textarea, button');
                if (firstInput && firstInput.tabIndex !== -1) {
                    firstInput.focus();
                }
            }, 100);
        } else {
            modal.setAttribute('aria-hidden', 'true');
            modal.removeAttribute('aria-modal');
        }
    }

    async verificarEstadoAPI() {
        console.log('🔍 Verificando estado de la API...');
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
            
            const response = await fetch(`${this.API_BASE_URL}/incidentes`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('📡 Estado de la API:', response.status, response.statusText);
            
            if (response.ok) {
                console.log('✅ API conectada correctamente');
                return true;
            } else {
                console.error('❌ Error en la API:', response.status);
                return false;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('🚨 Timeout: La API no respondió en 5 segundos');
            } else {
                console.error('🚨 Error de conexión con la API:', error.message);
            }
            return false;
        }
    }

    async cargarDatosIniciales() {
        console.log('📥 Cargando datos iniciales...');
        await Promise.all([
            this.cargarIncidentes(),
            this.cargarEstadisticas()
        ]);
    }

    bindEvents() {
        console.log('🔗 Configurando eventos...');
        
        // Filtro de ruta
        const filtroInput = document.getElementById('filtro-ruta');
        if (filtroInput) {
            filtroInput.addEventListener('input', (e) => {
                this.filtroRuta = e.target.value;
                this.filtrarYMostrarIncidentes();
                this.configurarAccesibilidadModales();
            });
        }

        // Botón limpiar filtro
        const btnLimpiar = document.getElementById('btn-limpiar-filtro');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                if (filtroInput) {
                    filtroInput.value = '';
                    this.filtroRuta = '';
                    this.filtrarYMostrarIncidentes();
                }
            });
        }

        // Botón actualizar
        const btnActualizar = document.getElementById('btn-actualizar');
        if (btnActualizar) {
            btnActualizar.addEventListener('click', async () => {
                if (this.isAPIActive) {
                    await this.cargarDatosIniciales();
                } else {
                    this.mostrarError('La API no está disponible. Verifica que el servidor esté ejecutándose.');
                }
            });
        }

        // Botón detectar ubicación
        const btnDetectarUbicacion = document.getElementById('btn-detect-ubicacion');
        if (btnDetectarUbicacion) {
            btnDetectarUbicacion.addEventListener('click', () => {
                this.detectarUbicacion();
            });
        }

        // Manejar clics en sugerencias de ubicación (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('sugerencia-ubicacion')) {
                const ubicacion = e.target.getAttribute('data-ubicacion');
                const input = document.getElementById('reporte-ubicacion');
                const feedback = document.getElementById('reporte-feedback');
                
                if (input) {
                    input.value = ubicacion;
                }
                
                if (feedback) {
                    this.mostrarFeedback(feedback, 
                        `📍 Ubicación seleccionada: ${ubicacion}`, 
                        'success');
                }
                
                e.preventDefault();
            }
        });

        // Botón enviar reporte
        const btnEnviarReporte = document.getElementById('btn-enviar-reporte');
        if (btnEnviarReporte) {
            btnEnviarReporte.addEventListener('click', () => {
                this.enviarReporte();
            });
        }

        // Navegación suave
        document.querySelectorAll('a[href="#estadisticas"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.getElementById('estadisticas');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
        // Eventos del mapa - CORREGIDOS
        const btnActualizarMapa = document.getElementById('btn-actualizar-mapa');
        const btnCentrarMapa = document.getElementById('btn-centrar-mapa');
        const mapaModal = document.getElementById('mapaModal');

        if (btnActualizarMapa) {
            btnActualizarMapa.addEventListener('click', () => {
                console.log('🔄 Solicitando actualización del mapa...');
                if (this.mapaManager && this.mapaManager.inicializado) {
                    this.mapaManager.actualizarMapa();
                    // Actualizar marcadores con datos actuales
                    this.mapaManager.actualizarMarcadores(this.incidentes);
                } else {
                    console.warn('⚠️ Mapa no inicializado');
                    this.mostrarError('El mapa no está inicializado. Intenta abrir el mapa primero.');
                }
            });
        }

        if (btnCentrarMapa) {
            btnCentrarMapa.addEventListener('click', () => {
                console.log('🎯 Solicitando centrar mapa en Colima...');
                if (this.mapaManager && this.mapaManager.inicializado) {
                    this.mapaManager.centrarEnColima();
                } else {
                    console.warn('⚠️ Mapa no inicializado');
                }
            });
        }

        if (mapaModal) {
            // CORREGIDO: Usar 'shown.bs.modal' en lugar de 'show.bs.modal'
            mapaModal.addEventListener('shown.bs.modal', () => {
                console.log('🗺️ Modal del mapa completamente visible...');
                
                // Pequeño delay para asegurar que el DOM esté listo
                setTimeout(() => {
                    const mapaInicializado = this.inicializarMapa();
                    
                    if (mapaInicializado) {
                        // Actualizar marcadores con los incidentes actuales
                        setTimeout(() => {
                            if (this.mapaManager.inicializado) {
                                this.mapaManager.actualizarMarcadores(this.incidentes);
                                console.log('✅ Marcadores actualizados en el mapa');
                            }
                        }, 300);
                    } else {
                        console.error('❌ No se pudo inicializar el mapa');
                        this.mostrarErrorMapa();
                    }
                }, 100);
            });

            // Actualizar el tamaño del mapa cuando se redimensione
            mapaModal.addEventListener('resize', () => {
                setTimeout(() => {
                    if (this.mapaManager && this.mapaManager.mapa) {
                        this.mapaManager.mapa.invalidateSize();
                    }
                }, 100);
            });
        }

        console.log('✅ Eventos configurados correctamente');
    }

    mostrarErrorMapa() {
        const modalBody = document.querySelector('#mapaModal .modal-body');
        if (modalBody) {
            const errorHTML = `
                <div class="alert alert-danger m-3">
                    <h5>❌ Error al cargar el mapa</h5>
                    <p>No se pudo inicializar el mapa. Por favor:</p>
                    <ul>
                        <li>Verifica tu conexión a internet</li>
                        <li>Recarga la página</li>
                        <li>Intenta abrir el mapa nuevamente</li>
                    </ul>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.vigiBusApp.reintentarMapa()">
                        Reintentar
                    </button>
                </div>
            `;
            modalBody.insertAdjacentHTML('afterbegin', errorHTML);
        }
    }

    reintentarMapa() {
        const errorAlert = document.querySelector('#mapaModal .alert-danger');
        if (errorAlert) {
            errorAlert.remove();
        }
        this.inicializarMapa();
        console.log('✅ Eventos configurados correctamente');
    }

    async cargarIncidentes() {
        if (!this.isAPIActive) {
            console.warn('⚠️ API no activa, omitiendo carga de incidentes');
            return;
        }

        this.mostrarLoading(true);
        this.ocultarError();

        try {
            const url = this.filtroRuta 
                ? `${this.API_BASE_URL}/incidentes?ruta=${encodeURIComponent(this.filtroRuta)}`
                : `${this.API_BASE_URL}/incidentes`;

            console.log('📥 Cargando incidentes desde:', url);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
            
            const response = await fetch(url, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📊 Datos de incidentes recibidos:', data);

            if (data.success) {
                this.incidentes = data.data || [];
                console.log(`✅ ${this.incidentes.length} incidentes cargados`);
                this.mostrarIncidentes();
                this.actualizarEstadisticasBasicas();
                this.actualizarHora();
                
                // Actualizar mapa si está inicializado
                if (this.mapaManager && document.getElementById('mapaModal').classList.contains('show')) {
                    this.mapaManager.actualizarMarcadores(this.incidentes);
                }
            } else {
                throw new Error(data.error || 'Error en la estructura de la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando incidentes:', error);
            let mensajeError = `Error al cargar incidentes: ${error.message}`;
            
            if (error.name === 'AbortError') {
                mensajeError = 'La solicitud tardó demasiado tiempo. Verifica la conexión con el servidor.';
            }
            
            this.mostrarError(mensajeError);
        } finally {
            this.mostrarLoading(false);
        }
    }

    filtrarYMostrarIncidentes() {
        console.log('🔍 Filtrando incidentes...');
        this.mostrarIncidentes();
    }

    filtrarIncidentes() {
        if (!this.filtroRuta) {
            return this.incidentes;
        }
        
        const filtro = this.filtroRuta.toLowerCase();
        return this.incidentes.filter(incidente => 
            incidente.ruta_afectada.toLowerCase().includes(filtro)
        );
    }

    // Método actualizarFiltrosMapa
    actualizarFiltrosMapa() {
        try {
            const selectElement = document.getElementById('filtro-mapa-ruta');
            if (!selectElement) {
                console.warn('⚠️ Elemento filtro-mapa-ruta no encontrado');
                return;
            }

            // Guardar la selección actual
            const seleccionActual = selectElement.value;

            // Limpiar opciones excepto la primera
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }

            // Agregar rutas únicas
            const rutasUnicas = [...new Set(this.estadisticas.rutas.map(r => r.ruta_afectada))];
            rutasUnicas.forEach(ruta => {
                const option = document.createElement('option');
                option.value = ruta;
                option.textContent = ruta;
                selectElement.appendChild(option);
            });

            // Restaurar la selección anterior si existe
            if (seleccionActual && rutasUnicas.includes(seleccionActual)) {
                selectElement.value = seleccionActual;
            }

            console.log(`✅ Filtros actualizados: ${rutasUnicas.length} rutas disponibles`);
        } catch (error) {
            console.error('❌ Error actualizando filtros del mapa:', error);
        }
    }

    async cargarEstadisticas() {
        if (!this.isAPIActive) {
            console.warn('⚠️ API no activa, omitiendo carga de estadísticas');
            return;
        }

        try {
            console.log('📊 Cargando estadísticas...');
            const response = await fetch(`${this.API_BASE_URL}/estadisticas/rutas`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('📈 Datos de estadísticas recibidos:', data);

            if (data.success) {
                this.procesarEstadisticas(data.data || []);
                this.actualizarUIEstadisticas();
                this.actualizarTiempoEstadisticas();
                this.actualizarGraficos();
                this.actualizarFiltrosMapa(); // CORREGIDO: Ahora usa el método corregido
            } else {
                throw new Error(data.error || 'Error en la estructura de la respuesta');
            }

        } catch (error) {
            console.error('❌ Error cargando estadísticas:', error);
        }
    }

    async detectarUbicacion() {
        const input = document.getElementById('reporte-ubicacion');
        const feedback = document.getElementById('reporte-feedback');
        
        if (!input || !feedback) {
            console.error('❌ Elementos del formulario de ubicación no encontrados');
            return;
        }

        // Verificar si la geolocalización está disponible
        if (!navigator.geolocation) {
            this.mostrarFeedback(feedback, 
                'La geolocalización no es soportada por este navegador. Por favor, ingresa la ubicación manualmente.', 
                'warning');
            return;
        }

        this.mostrarFeedback(feedback, '📍 Detectando tu ubicación...', 'info');

        try {
            const position = await new Promise((resolve, reject) => {
                // Opciones mejoradas para geolocalización
                const options = {
                    enableHighAccuracy: true,  // Usar GPS si está disponible
                    timeout: 15000,           // 15 segundos de timeout
                    maximumAge: 60000         // Cache de 1 minuto
                };

                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });

            const { latitude, longitude } = position.coords;
            console.log('📍 Coordenadas obtenidas:', latitude, longitude);
            
            // Obtener nombre de la ubicación usando geocoding inverso mejorado
            const ubicacionDetectada = await this.obtenerNombreUbicacion(latitude, longitude);
            
            if (input) {
                input.value = ubicacionDetectada;
            }
            
            this.mostrarFeedback(feedback, 
                `📍 Ubicación detectada: ${ubicacionDetectada}`, 
                'success');

        } catch (error) {
            console.error('❌ Error obteniendo ubicación:', error);
            await this.manejarErrorGeolocalizacion(error, feedback, input);         
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        mensaje = 'Permiso de ubicación denegado.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        mensaje = 'Información de ubicación no disponible.';
                        break;
                    case error.TIMEOUT:
                        mensaje = 'La solicitud de ubicación tardó demasiado tiempo.';
                        break;
                }
                
                this.mostrarFeedback(feedback, mensaje, 'warning');
            }
        }

    async obtenerNombreUbicacion(lat, lng) {
        try {
            // Primero intentar con la API de geocoding de OpenStreetMap (gratuita)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.address) {
                    // Extraer el nombre más significativo de la ubicación
                    const address = data.address;
                    
                    // Priorizar nombres específicos en este orden
                    if (address.road && address.suburb) {
                        return `${address.road}, ${address.suburb}`;
                    } else if (address.quarter) {
                        return address.quarter;
                    } else if (address.suburb) {
                        return address.suburb;
                    } else if (address.city_district) {
                        return address.city_district;
                    } else if (address.city) {
                        return address.city;
                    } else if (address.town) {
                        return address.town;
                    }
                }
            }
        } catch (apiError) {
            console.warn('⚠️ Error con API de geocoding, usando ubicaciones predefinidas:', apiError);
        }

        // Fallback a ubicaciones predefinidas de Colima
        return this.obtenerUbicacionCercanaPredefinida(lat, lng);
    }

    obtenerUbicacionCercanaPredefinida(lat, lng) {
        const ubicacionesColima = [
            { nombre: "Centro Histórico", lat: 19.2433, lng: -103.725 },
            { nombre: "Jardín Núñez", lat: 19.2480, lng: -103.727 },
            { nombre: "Universidad de Colima", lat: 19.2567, lng: -103.724 },
            { nombre: "Plaza San Fernando", lat: 19.2389, lng: -103.721 },
            { nombre: "Mercado Constitución", lat: 19.2400, lng: -103.730 },
            { nombre: "Central Camionera Rojos", lat: 19.2485, lng: -103.7231 },
            { nombre: "Palacio de Gobierno", lat: 19.2430, lng: -103.7245 },
            { nombre: "Hospital Regional", lat: 19.2389, lng: -103.7215 },
            { nombre: "Colonia Las Víboras", lat: 19.2520, lng: -103.7150 },
            { nombre: "Colonia Mirador", lat: 19.2350, lng: -103.7300 }
        ];

        let ubicacionMasCercana = ubicacionesColima[0];
        let distanciaMinima = this.calcularDistancia(lat, lng, ubicacionMasCercana.lat, ubicacionMasCercana.lng);

        ubicacionesColima.forEach(ubicacion => {
            const distancia = this.calcularDistancia(lat, lng, ubicacion.lat, ubicacion.lng);
            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                ubicacionMasCercana = ubicacion;
            }
        });

        console.log(`📍 Ubicación cercana detectada: ${ubicacionMasCercana.nombre} (distancia: ${distanciaMinima.toFixed(2)} km)`);
        return ubicacionMasCercana.nombre;
    }

    async manejarErrorGeolocalizacion(error, feedback, input) {
        let mensaje = 'No se pudo detectar la ubicación automáticamente. ';
        let tipo = 'warning';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                mensaje += 'Permiso de ubicación denegado. ';
                mensaje += 'Por favor, habilita los permisos de ubicación en tu navegador o ingresa la ubicación manualmente.';
                break;
                
            case error.POSITION_UNAVAILABLE:
                mensaje += 'La información de ubicación no está disponible. ';
                mensaje += 'Verifica que tu dispositivo tenga GPS habilitado o ingresa la ubicación manualmente.';
                break;
                
            case error.TIMEOUT:
                mensaje += 'La solicitud de ubicación tardó demasiado tiempo. ';
                mensaje += 'Intenta nuevamente o ingresa la ubicación manualmente.';
                break;
                
            default:
                mensaje += 'Error desconocido al obtener la ubicación. ';
                mensaje += 'Por favor, ingresa la ubicación manualmente.';
                break;
        }

        // Mostrar sugerencias de ubicaciones comunes
        mensaje += this.obtenerSugerenciasUbicaciones();

        this.mostrarFeedback(feedback, mensaje, tipo);
        
        // Opcional: Autocompletar con ubicación por defecto
        if (input && input.value === '') {
            input.placeholder = 'Ej: Centro Histórico, Jardín Núñez...';
        }
    }

    obtenerSugerenciasUbicaciones() {
        return `
            <br><br>
            <strong>Ubicaciones comunes en Colima:</strong>
            <div class="mt-2">
                <button type="button" class="btn btn-sm btn-outline-primary me-1 mb-1 sugerencia-ubicacion" data-ubicacion="Centro Histórico">
                    Centro Histórico
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary me-1 mb-1 sugerencia-ubicacion" data-ubicacion="Jardín Núñez">
                    Jardín Núñez
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary me-1 mb-1 sugerencia-ubicacion" data-ubicacion="Universidad de Colima">
                    Universidad
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary me-1 mb-1 sugerencia-ubicacion" data-ubicacion="Plaza San Fernando">
                    Plaza San Fernando
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary me-1 mb-1 sugerencia-ubicacion" data-ubicacion="Central Camionera">
                    Central Camionera
                </button>
            </div>
        `;
    }

    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    procesarEstadisticas(datosRutas) {
        this.estadisticas.rutas = datosRutas;
        this.estadisticas.rutasUnicas = datosRutas.length;
        
        // Calcular ruta crítica
        if (datosRutas.length > 0) {
            const rutaCritica = datosRutas.reduce((prev, current) => 
                (prev.total_incidentes > current.total_incidentes) ? prev : current
            );
            this.estadisticas.rutaCritica = rutaCritica.ruta_afectada;
        } else {
            this.estadisticas.rutaCritica = '-';
        }

        // Calcular incidentes de hoy
        const hoy = new Date().toDateString();
        this.estadisticas.incidentesHoy = this.incidentes.filter(incidente => {
            try {
                return new Date(incidente.fecha_extraccion).toDateString() === hoy;
            } catch (e) {
                return false;
            }
        }).length;

        // Generar datos de tendencias
        this.generarDatosTendencias();
        this.generarInsights();
    }

    generarDatosTendencias() {
        const ultimos7Dias = [];
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            ultimos7Dias.push(fecha.toISOString().split('T')[0]);
        }

        this.estadisticas.tendencias = ultimos7Dias.map(fecha => {
            const incidentesDelDia = this.incidentes.filter(incidente => {
                try {
                    return incidente.fecha_extraccion && 
                           incidente.fecha_extraccion.startsWith(fecha);
                } catch (e) {
                    return false;
                }
            }).length;
            
            return {
                fecha: this.formatearFechaCorta(fecha),
                cantidad: incidentesDelDia
            };
        });
    }

    formatearFechaCorta(fechaString) {
        try {
            const fecha = new Date(fechaString);
            return fecha.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short'
            });
        } catch (e) {
            return 'Fecha inválida';
        }
    }

    generarInsights() {
        const horarios = this.incidentes.map(incidente => {
            try {
                const fecha = new Date(incidente.fecha_extraccion);
                return fecha.getHours();
            } catch (e) {
                return null;
            }
        }).filter(h => h !== null);

        const horarioPico = this.calcularModa(horarios);
        const totalIncidentes = this.incidentes.length;

        this.estadisticas.insights = {
            horarioPico: horarioPico !== null ? `${horarioPico}:00 hrs` : 'No disponible',
            patron: totalIncidentes > 10 ? 'Alta frecuencia' : 
                   totalIncidentes > 5 ? 'Frecuencia moderada' : 'Baja frecuencia',
            tendencia: this.analizarTendencia(),
            rutasPrioritarias: this.identificarRutasPrioritarias()
        };
    }

    calcularModa(array) {
        if (array.length === 0) return null;
        const frequency = {};
        let maxCount = 0;
        let moda = array[0];

        array.forEach(item => {
            frequency[item] = (frequency[item] || 0) + 1;
            if (frequency[item] > maxCount) {
                maxCount = frequency[item];
                moda = item;
            }
        });

        return moda;
    }

    analizarTendencia() {
        if (this.estadisticas.tendencias.length < 3) return 'Datos insuficientes';

        const ultimosDias = this.estadisticas.tendencias.slice(-3);
        const sumaUltimos = ultimosDias.reduce((sum, dia) => sum + dia.cantidad, 0);
        const sumaAnteriores = this.estadisticas.tendencias.slice(-6, -3).reduce((sum, dia) => sum + dia.cantidad, 0);

        if (sumaAnteriores === 0) return 'Sin datos previos';
        if (sumaUltimos > sumaAnteriores * 1.5) return 'Tendencia al alza 📈';
        if (sumaUltimos < sumaAnteriores * 0.7) return 'Tendencia a la baja 📉';
        return 'Tendencia estable ➡️';
    }

    identificarRutasPrioritarias() {
        const rutasCriticas = this.estadisticas.rutas
            .filter(ruta => ruta.total_incidentes > 1)
            .slice(0, 3)
            .map(ruta => ruta.ruta_afectada);

        return rutasCriticas.length > 0 ? 
               rutasCriticas.join(', ') : 'No hay rutas críticas';
    }

    actualizarEstadisticasBasicas() {
        this.estadisticas.totalIncidentes = this.incidentes.length;
        
        const totalElement = document.getElementById('total-incidentes');
        if (totalElement) {
            totalElement.textContent = this.estadisticas.totalIncidentes;
        }
    }

    actualizarUIEstadisticas() {
        this.actualizarElementoTexto('stats-total-incidentes', this.estadisticas.totalIncidentes);
        this.actualizarElementoTexto('stats-rutas-unicas', this.estadisticas.rutasUnicas);
        this.actualizarElementoTexto('stats-incidentes-hoy', this.estadisticas.incidentesHoy);
        this.actualizarElementoTexto('stats-ruta-critica', this.estadisticas.rutaCritica);

        this.actualizarElementoTexto('insight-pattern', 
            `Patrón: ${this.estadisticas.insights.patron}`);
        this.actualizarElementoTexto('insight-peak', 
            `Horario pico: ${this.estadisticas.insights.horarioPico}`);
        this.actualizarElementoTexto('alert-priority', 
            `Rutas prioritarias: ${this.estadisticas.insights.rutasPrioritarias}`);
        this.actualizarElementoTexto('alert-trend', 
            `Tendencia: ${this.estadisticas.insights.tendencia}`);

        this.actualizarTopRutas();
    }

    actualizarElementoTexto(id, texto) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = texto;
        }
    }

    actualizarTopRutas() {
        const container = document.getElementById('top-rutas-list');
        if (!container) return;

        const topRutas = this.estadisticas.rutas.slice(0, 5);

        if (topRutas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-inbox display-6 text-muted"></i>
                    <p class="text-muted mt-2">No hay datos de rutas disponibles</p>
                </div>
            `;
            return;
        }

        container.innerHTML = topRutas.map((ruta, index) => `
            <div class="top-ruta-item list-group-item d-flex align-items-center py-3">
                <div class="top-ruta-rank me-3">${index + 1}</div>
                <div class="flex-grow-1">
                    <h6 class="mb-1 text-dark">${ruta.ruta_afectada}</h6>
                    <small class="text-muted">${ruta.total_incidentes} incidente${ruta.total_incidentes !== 1 ? 's' : ''}</small>
                </div>
                <div class="text-end">
                    <small class="text-success">
                        <i class="bi bi-activity"></i>
                        Último: ${this.formatearFechaRelativa(ruta.ultimo_incidente)}
                    </small>
                </div>
            </div>
        `).join('');
    }

    actualizarTiempoEstadisticas() {
        const tiempoElement = document.getElementById('stats-update-time');
        if (tiempoElement) {
            const ahora = new Date();
            tiempoElement.textContent = ahora.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    actualizarGraficos() {
        this.crearGraficoDistribucion();
        this.crearGraficoTendencias();
    }

    crearGraficoDistribucion() {
        const ctx = document.getElementById('ruta-distribution-chart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.distribucion) {
            this.charts.distribucion.destroy();
        }

        const topRutas = this.estadisticas.rutas.slice(0, 6);
        
        if (topRutas.length === 0) {
            ctx.innerHTML = `
                <div class="chart-placeholder">
                    <i class="bi bi-pie-chart display-1 text-muted"></i>
                    <p class="text-muted mt-2">No hay datos para mostrar</p>
                </div>
            `;
            return;
        }

        // Limpiar el contenedor
        ctx.innerHTML = '<canvas></canvas>';
        const canvas = ctx.querySelector('canvas');

        const data = {
            labels: topRutas.map(ruta => ruta.ruta_afectada),
            datasets: [{
                data: topRutas.map(ruta => ruta.total_incidentes),
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#f5576c', 
                    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        try {
            this.charts.distribucion = new Chart(canvas, {
                type: 'doughnut',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                usePointStyle: true,
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} incidentes (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        } catch (error) {
            console.error('Error creando gráfico de distribución:', error);
            ctx.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-exclamation-triangle text-warning display-4"></i>
                    <p class="text-muted mt-2">Error al cargar el gráfico</p>
                </div>
            `;
        }
    }

    crearGraficoTendencias() {
        const ctx = document.getElementById('temporal-trends-chart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.charts.tendencias) {
            this.charts.tendencias.destroy();
        }

        if (this.estadisticas.tendencias.length === 0) {
            ctx.innerHTML = `
                <div class="chart-placeholder">
                    <i class="bi bi-bar-chart-line display-1 text-muted"></i>
                    <p class="text-muted mt-2">No hay datos para mostrar</p>
                </div>
            `;
            return;
        }

        // Limpiar el contenedor
        ctx.innerHTML = '<canvas></canvas>';
        const canvas = ctx.querySelector('canvas');

        const data = {
            labels: this.estadisticas.tendencias.map(t => t.fecha),
            datasets: [{
                label: 'Incidentes por Día',
                data: this.estadisticas.tendencias.map(t => t.cantidad),
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderColor: '#667eea',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        };

        try {
            this.charts.tendencias = new Chart(canvas, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    }
                }
            });
        } catch (error) {
            console.error('Error creando gráfico de tendencias:', error);
            ctx.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-exclamation-triangle text-warning display-4"></i>
                    <p class="text-muted mt-2">Error al cargar el gráfico</p>
                </div>
            `;
        }
    }

    async enviarReporte() {
        const rutaInput = document.getElementById('reporte-ruta');
        const descripcionInput = document.getElementById('reporte-descripcion');
        const feedback = document.getElementById('reporte-feedback');

        if (!rutaInput || !descripcionInput) {
            this.mostrarFeedback(feedback, 'Error: No se encontraron los campos del formulario', 'danger');
            return;
        }

        const ruta = rutaInput.value.trim();
        const descripcion = descripcionInput.value.trim();

        if (!ruta || !descripcion) {
            this.mostrarFeedback(feedback, 'Por favor completa todos los campos requeridos', 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/incidentes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ruta_afectada: ruta,
                    descripcion_incidente: descripcion,
                    fuente_url: window.location.href
                })
            });

            if (response.ok) {
                this.mostrarFeedback(feedback, '✅ Reporte enviado exitosamente', 'success');
                
                // Limpiar formulario
                rutaInput.value = '';
                descripcionInput.value = '';
                const ubicacionInput = document.getElementById('reporte-ubicacion');
                if (ubicacionInput) ubicacionInput.value = '';
                
                // Recargar datos y cerrar modal después de 2 segundos
                setTimeout(async () => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('reporteModal'));
                    if (modal) modal.hide();
                    await this.cargarDatosIniciales();
                }, 2000);
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }
        } catch (error) {
            console.error('Error enviando reporte:', error);
            this.mostrarFeedback(feedback, `❌ Error al enviar el reporte: ${error.message}`, 'danger');
        }
    }

    mostrarFeedback(elemento, mensaje, tipo) {
        if (!elemento) return;
        
        elemento.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show">
                ${mensaje}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }

    mostrarErrorAPI() {
        const main = document.querySelector('main');
        if (!main) return;

        const errorHTML = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <h4 class="alert-heading">⚠️ API No Disponible</h4>
                <p>No se pudo conectar con el servidor en <strong>${this.API_BASE_URL}</strong></p>
                <hr>
                <p class="mb-0">
                    <strong>Soluciones:</strong><br>
                    1. Verifica que el servidor Flask esté ejecutándose<br>
                    2. Comprueba que el puerto 5000 esté disponible<br>
                    3. Revisa la consola del navegador para más detalles
                </p>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        main.insertAdjacentHTML('afterbegin', errorHTML);
    }

    // Métodos para mostrar incidentes
    mostrarIncidentes() {
        const container = document.getElementById('incidentes-container');
        const emptyState = document.getElementById('empty-state');
        
        if (!container || !emptyState) return;

        const incidentesFiltrados = this.filtrarIncidentes();
        
        if (incidentesFiltrados.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        const html = incidentesFiltrados.map(incidente => this.crearCardIncidente(incidente)).join('');
        container.innerHTML = html;
    }

    crearCardIncidente(incidente) {
        const fecha = this.formatearFecha(incidente.fecha_extraccion);
        const rutaClass = this.obtenerClaseRuta(incidente.ruta_afectada);
        
        return `
            <div class="col-lg-6 col-xl-4 fade-in">
                <div class="card incidente-card h-100">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span class="badge ${rutaClass} ruta-badge">
                            <i class="bi bi-bus-front me-1"></i>${incidente.ruta_afectada}
                        </span>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-primary btn-ver-mapa" 
                                    data-ruta="${incidente.ruta_afectada}"
                                    data-descripcion="${this.escapeHtml(incidente.descripcion_incidente)}">
                                <i class="bi bi-map"></i>
                            </button>
                            <small class="text-muted">${fecha}</small>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="card-text">${this.escapeHtml(incidente.descripcion_incidente)}</p>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">ID: ${incidente.id}</small>
                            ${incidente.fuente_url ? 
                                `<a href="${incidente.fuente_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                    <i class="bi bi-link-45deg"></i> Fuente
                                </a>` : 
                                '<span class="text-muted small">Sin fuente</span>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    obtenerClaseRuta(ruta) {
        const rutaNum = ruta.replace(/\D/g, '');
        const colores = [
            'bg-primary', 'bg-success', 'bg-warning', 'bg-danger', 
            'bg-info', 'bg-secondary', 'bg-dark'
        ];
        const index = parseInt(rutaNum) % colores.length || 0;
        return colores[index];
    }

    formatearFecha(fechaString) {
        try {
            const fecha = new Date(fechaString);
            const ahora = new Date();
            const diffMs = ahora - fecha;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMins < 1) {
                return 'Hace un momento';
            } else if (diffMins < 60) {
                return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
            } else if (diffHours < 24) {
                return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
            } else if (diffDays === 1) {
                return 'Ayer';
            } else if (diffDays < 7) {
                return `Hace ${diffDays} días`;
            } else {
                return fecha.toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        } catch (e) {
            return 'Fecha desconocida';
        }
    }

    formatearFechaRelativa(fechaString) {
        try {
            const fecha = new Date(fechaString);
            const ahora = new Date();
            const diffDias = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
            
            if (diffDias === 0) return 'hoy';
            if (diffDias === 1) return 'ayer';
            return `hace ${diffDias} días`;
        } catch (e) {
            return 'fecha desconocida';
        }
    }

    actualizarHora() {
        const ahora = new Date();
        const horaElement = document.getElementById('ultima-actualizacion');
        if (horaElement) {
            horaElement.textContent = ahora.toLocaleTimeString('es-MX');
        }
    }

    mostrarLoading(mostrar) {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = mostrar ? 'block' : 'none';
        }
    }

    mostrarError(mensaje) {
        const errorAlert = document.getElementById('error-alert');
        const errorMessage = document.getElementById('error-message');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = mensaje;
            errorAlert.style.display = 'block';
            
            // Auto-ocultar después de 10 segundos
            setTimeout(() => {
                this.ocultarError();
            }, 10000);
        }
    }

    ocultarError() {
        const errorAlert = document.getElementById('error-alert');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Clase MapaManager
class MapaManager {
    constructor() {
        this.mapa = null;
        this.marcadores = [];
        this.capas = {
            base: {},      // Capas base (mapa callejero, satélite)
            overlays: {}   // Capas superpuestas (marcadores, tráfico)
        };
        this.incidentesVisibles = [];
        this.filtroRutaActual = '';
        this.filtrosTipo = {
            retrasos: true,
            desvios: true,
            accidentes: true
        };
        this.inicializado = false;
        this.marcadoresLayer = null;
    }

    init() {
        console.log('🗺️ Inicializando mapa...');
        
        try {
            if (!this.crearMapa()) {
                throw new Error('No se pudo crear el mapa');
            }
            
            this.agregarControles();
            this.agregarCapasBase();
            this.configurarEventos();
            this.inicializado = true;
            
            console.log('✅ Mapa inicializado correctamente');
            return true;
            
        } catch (error) {
            console.error('❌ Error en init del mapa:', error);
            this.inicializado = false;
            return false;
        }
    }

    crearMapa() {
        try {
            // Verificar que el contenedor existe y es visible
            const mapaContainer = document.getElementById('mapa-container');
            if (!mapaContainer) {
                console.error('❌ Contenedor del mapa no encontrado en el DOM');
                return false;
            }

            // Verificar que el contenedor tenga dimensiones
            if (mapaContainer.offsetWidth === 0 || mapaContainer.offsetHeight === 0) {
                console.warn('⚠️ Contenedor del mapa sin dimensiones visibles');
                mapaContainer.style.minHeight = '500px';
                mapaContainer.style.width = '100%';
            }

            // Verificar que Leaflet está disponible
            if (typeof L === 'undefined') {
                console.error('❌ Leaflet no está cargado');
                return false;
            }

            // Coordenadas del centro de Colima
            const centroColima = [19.2433, -103.725];
            
            // Crear el mapa con opciones
            this.mapa = L.map('mapa-container', {
                center: centroColima,
                zoom: 13,
                zoomControl: false, // Lo agregaremos manualmente
                attributionControl: true
            });

            // Crear y almacenar capa base de OpenStreetMap
            this.capas.base.mapaCallejero = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                minZoom: 10
            }).addTo(this.mapa);

            // Crear capa satelital (no se agrega por defecto)
            this.capas.base.satelital = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '© Google'
            });

            // Inicializar layer group para marcadores
            this.marcadoresLayer = L.layerGroup().addTo(this.mapa);
            this.capas.overlays.incidentes = this.marcadoresLayer;

            // Agregar control de zoom
            L.control.zoom({
                position: 'topright'
            }).addTo(this.mapa);

            console.log('✅ Mapa creado exitosamente');
            return true;

        } catch (error) {
            console.error('❌ Error crítico creando el mapa:', error);
            return false;
        }
    }

    agregarControles() {
        if (!this.mapa) {
            console.error('❌ Mapa no disponible para agregar controles');
            return;
        }

        try {
            // CORREGIDO: Usar las capas definidas correctamente
            const baseMaps = {
                "Mapa Callejero": this.capas.base.mapaCallejero,
                "Satélite": this.capas.base.satelital
            };

            const overlayMaps = {
                "Incidentes": this.capas.overlays.incidentes
            };

            // Agregar control de capas
            L.control.layers(baseMaps, overlayMaps, {
                collapsed: true,
                position: 'topright'
            }).addTo(this.mapa);

            // Control de escala
            L.control.scale({ 
                imperial: false,
                position: 'bottomleft'
            }).addTo(this.mapa);

            // Leyenda personalizada
            this.agregarLeyenda();

            console.log('✅ Controles del mapa agregados correctamente');

        } catch (error) {
            console.error('❌ Error agregando controles:', error);
            // Continuar sin controles en lugar de fallar completamente
        }
    }

    agregarLeyenda() {
        if (!this.mapa) return;

        try {
            const leyenda = L.control({ position: 'bottomright' });

            leyenda.onAdd = () => {
                const div = L.DomUtil.create('div', 'mapa-legend');
                div.innerHTML = `
                    <h6><i class="bi bi-info-circle"></i> Leyenda de Incidentes</h6>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #ff6b6b;"></div>
                        <span>Reciente (hoy)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #ff9e43;"></div>
                        <span>Grave</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #4ecdc4;"></div>
                        <span>Moderado</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #45b7d1;"></div>
                        <span>Leve</span>
                    </div>
                `;
                return div;
            };

            leyenda.addTo(this.mapa);
        } catch (error) {
            console.error('❌ Error agregando leyenda:', error);
        }
    }

    agregarCapasBase() {
        this.agregarPuntosInteres();
        this.simularDatosTrafico();
    }

    agregarPuntosInteres() {
        if (!this.mapa) return;

        try {
            const puntosInteres = [
                {
                    nombre: "Central Rojos",
                    coords: [19.244053776631667, -103.74118278464614],
                    tipo: "transporte",
                    icono: "bi-bus-front",
                    descripcion: "Estación central de Rojos"
                },
                {
                    nombre: "Palacio de Gobierno",
                    coords: [19.242935367983957, -103.72819305146969],
                    tipo: "gobierno",
                    icono: "bi-building",
                    descripcion: "Sede del gobierno estatal"
                },
                {
                    nombre: "Universidad de Colima",
                    coords: [19.247734611938206, -103.69737597923219],
                    tipo: "educacion",
                    icono: "bi-mortarboard",
                    descripcion: "Campus principal universitario"
                },
                {
                    nombre: "Tec de Colima",
                    coords: [19.26197475572888, -103.72364191371048],
                    tipo: "educacion",
                    icono: "bi-mortarboard",
                    descripcion: "TecNM Campus Colima"
                },
                {
                            nombre: "Zentralia Colima",
                            coords: [19.267062323175992, -103.6980504648276],
                            tipo: "comercial",
                            icono: "bi-shop",
                            descripcion: "Centro comercial y de entretenimiento"
                        },
                        {
                            nombre: "Plaza Sendera Colima",
                            coords: [19.27638316077762, -103.71822836353489],
                            tipo: "comercial",
                            icono: "bi-shop",
                            descripcion: "Centro comercial al norte de Colima"
                        },
                        {
                            nombre: "IMSS Hospital General (HGZ 1)",
                            coords: [19.269862206329922, -103.75992104397147],
                            tipo: "salud",
                            icono: "bi-hospital",
                            descripcion: "Hospital General de Zona 1 del IMSS"
                        },
                        {
                            nombre: "Hospital Regional Universitario",
                            coords: [19.257581732835547, -103.69011012489084],
                            tipo: "salud",
                            icono: "bi-hospital",
                            descripcion: "Hospital Regional de Colima"
                        },
                        {
                            nombre: "ISSSTE Hospital Clínica",
                            coords: [19.251206844495886, -103.71322215096214],
                            tipo: "salud",
                            icono: "bi-hospital",
                            descripcion: "Clínica Hospital ISSSTE Colima"
                        },
                        {
                            nombre: "Jardín Libertad",
                            coords: [19.24335964526246, -103.72841448270087],
                            tipo: "plaza",
                            icono: "bi-tree",
                            descripcion: "Plaza principal (Zócalo) de Colima"
                        },
                        {
                            nombre: "Jardín Núñez",
                            coords: [19.239932325636914, -103.72449229700814],
                            tipo: "plaza",
                            icono: "bi-tree",
                            descripcion: "Jardín histórico en el centro"
                        },
                        {
                            nombre: "Complejo Administrativo",
                            coords: [19.25546045253885, -103.68853580695057],
                            tipo: "gobierno",
                            icono: "bi-building",
                            descripcion: "Oficinas principales del Gobierno Estatal"
                        }
            ];

            // Crear layer group para puntos de interés
            this.capas.overlays.puntosInteres = L.layerGroup();

            puntosInteres.forEach(punto => {
                const icono = L.divIcon({
                    html: `<div class="punto-interes-marker punto-${punto.tipo}">
                             <i class="bi ${punto.icono}"></i>
                           </div>`,
                    className: `punto-interes-${punto.tipo}`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker(punto.coords, { icon: icono })
                    .bindPopup(`
                        <div class="popup-punto-interes">
                            <h6>${punto.nombre}</h6>
                            <p class="text-muted">${punto.descripcion}</p>
                            <small><i class="bi bi-geo-alt"></i> ${punto.coords[0].toFixed(4)}, ${punto.coords[1].toFixed(4)}</small>
                        </div>
                    `)
                    .addTo(this.capas.overlays.puntosInteres);

                this.marcadores.push(marker);
            });

            // Agregar al mapa por defecto
            this.capas.overlays.puntosInteres.addTo(this.mapa);

        } catch (error) {
            console.error('❌ Error agregando puntos de interés:', error);
        }
    }

    simularDatosTrafico() {
        if (!this.mapa) return;

        try {
            const arteriasPrincipales = [
                { 
                    coords: [[19.26370399157554, -103.72665083856585], [19.256330365835748, -103.71699947417272]], 
                    nivel: "alto",
                    nombre: "Av. Tecnológico"
                },
                { 
                    coords: [[19.244422040476632, -103.71215238128148], [19.258589292982105, -103.6895817820731]], 
                    nivel: "medio",
                    nombre: "Blvd. Camino Real"
                }
            ];

            // Crear layer group para tráfico
            this.capas.overlays.trafico = L.layerGroup();

            arteriasPrincipales.forEach(arteria => {
                const polilinea = L.polyline(arteria.coords, {
                    color: this.obtenerColorTrafico(arteria.nivel),
                    weight: 6,
                    opacity: 0.6
                }).bindPopup(`
                    <div class="popup-trafico">
                        <h6>${arteria.nombre}</h6>
                        <p>Estado del tráfico: <strong>${arteria.nivel.toUpperCase()}</strong></p>
                    </div>
                `).addTo(this.capas.overlays.trafico);
            });

            // Agregar al mapa por defecto
            this.capas.overlays.trafico.addTo(this.mapa);

        } catch (error) {
            console.error('❌ Error simulando datos de tráfico:', error);
        }
    }

    obtenerColorTrafico(nivel) {
        const colores = {
            alto: '#ff4444',
            medio: '#ffaa00',
            bajo: '#44ff44'
        };
        return colores[nivel] || '#cccccc';
    }

    actualizarMarcadores(incidentes) {
        if (!this.inicializado || !this.marcadoresLayer) {
            console.warn('⚠️ Mapa no inicializado, no se pueden actualizar marcadores');
            return;
        }

        console.log(`🔄 Actualizando ${incidentes.length} marcadores en el mapa...`);

        try {
            // Limpiar marcadores existentes de incidentes
            this.marcadoresLayer.clearLayers();

            // Actualizar contador
            this.actualizarContadorIncidentes(incidentes.length);

            // Agregar nuevos marcadores
            incidentes.forEach(incidente => {
                this.agregarMarcadorIncidente(incidente);
            });

            this.incidentesVisibles = [...incidentes];
            
            console.log(`✅ ${incidentes.length} marcadores actualizados en el mapa`);

        } catch (error) {
            console.error('❌ Error actualizando marcadores:', error);
        }
    }

    agregarMarcadorIncidente(incidente) {
        if (!this.marcadoresLayer) return;

        try {
            const coordenadas = this.generarCoordenadasRealistas(incidente);
            const marcador = L.marker(coordenadas, {
                icon: this.crearIconoIncidente(incidente)
            });

            const popupContent = this.crearPopupIncidente(incidente);
            marcador.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'popup-incidente'
            });

            marcador.addTo(this.marcadoresLayer);

        } catch (error) {
            console.error('❌ Error agregando marcador de incidente:', error, incidente);
        }
    }

    generarCoordenadasRealistas(incidente) {
        const areasColima = [
            { centro: [19.2433, -103.725], radio: 0.02 },
            { centro: [19.2567, -103.724], radio: 0.015 },
            { centro: [19.2480, -103.727], radio: 0.01 },
            { centro: [19.2389, -103.721], radio: 0.012 }
        ];

        const areaIndex = Math.abs(this.hashString(incidente.ruta_afectada)) % areasColima.length;
        const area = areasColima[areaIndex];
        
        const lat = area.centro[0] + (Math.random() - 0.5) * area.radio;
        const lng = area.centro[1] + (Math.random() - 0.5) * area.radio;
        
        return [lat, lng];
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    crearIconoIncidente(incidente) {
        const esReciente = this.esIncidenteReciente(incidente);
        const severidad = this.determinarSeveridad(incidente);
        
        const color = esReciente ? '#ff6b6b' : 
                     severidad === 'grave' ? '#ff9e43' :
                     severidad === 'moderado' ? '#4ecdc4' : '#45b7d1';

        const icono = esReciente ? 'bi-exclamation-triangle-fill' :
                     severidad === 'grave' ? 'bi-exclamation-octagon-fill' :
                     severidad === 'moderado' ? 'bi-exclamation-diamond-fill' : 'bi-info-circle-fill';

        return L.divIcon({
            html: `
                <div class="marcador-incidente marcador-${severidad} ${esReciente ? 'reciente' : ''}" 
                     style="background: ${color};">
                    <i class="bi ${icono}"></i>
                </div>
            `,
            className: 'marcador-incidente-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
    }

    esIncidenteReciente(incidente) {
        try {
            const fechaIncidente = new Date(incidente.fecha_extraccion);
            const ahora = new Date();
            const diferenciaHoras = (ahora - fechaIncidente) / (1000 * 60 * 60);
            return diferenciaHoras < 24;
        } catch (e) {
            return false;
        }
    }

    determinarSeveridad(incidente) {
        const descripcion = incidente.descripcion_incidente.toLowerCase();
        
        if (descripcion.includes('accidente') || descripcion.includes('choque') || 
            descripcion.includes('grave') || descripcion.includes('emergencia')) {
            return 'grave';
        } else if (descripcion.includes('reten') || descripcion.includes('congestion') || 
                   descripcion.includes('desvío') || descripcion.includes('lento')) {
            return 'moderado';
        } else {
            return 'leve';
        }
    }

    crearPopupIncidente(incidente) {
        const fecha = new Date(incidente.fecha_extraccion).toLocaleString('es-MX');
        const severidad = this.determinarSeveridad(incidente);
        const esReciente = this.esIncidenteReciente(incidente);
        
        return `
            <div class="popup-incidente-content">
                <div class="popup-header">
                    <div class="popup-ruta">
                        <i class="bi bi-bus-front"></i>
                        <strong>${incidente.ruta_afectada}</strong>
                    </div>
                    <small class="text-muted">${fecha}</small>
                </div>
                <div class="popup-body">
                    <p class="popup-descripcion">${incidente.descripcion_incidente}</p>
                    <div class="popup-meta">
                        <span class="badge ${this.obtenerClaseSeveridad(severidad)}">
                            ${severidad.charAt(0).toUpperCase() + severidad.slice(1)}
                        </span>
                        ${esReciente ? '<span class="badge bg-warning">Reciente</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    obtenerClaseSeveridad(severidad) {
        const clases = {
            grave: 'bg-danger',
            moderado: 'bg-warning',
            leve: 'bg-success'
        };
        return clases[severidad] || 'bg-secondary';
    }

    actualizarContadorIncidentes(cantidad) {
        const contador = document.getElementById('mapa-total-incidentes');
        if (contador) {
            contador.textContent = cantidad;
        }
    }

    centrarEnColima() {
        if (!this.inicializado || !this.mapa) {
            console.warn('⚠️ Mapa no inicializado, no se puede centrar');
            return;
        }

        try {
            const centroColima = [19.2433, -103.725];
            this.mapa.setView(centroColima, 13);
            console.log('🎯 Mapa centrado en Colima');
        } catch (error) {
            console.error('❌ Error centrando el mapa:', error);
        }
    }

    actualizarMapa() {
        if (!this.inicializado || !this.mapa) {
            console.warn('⚠️ Mapa no inicializado, no se puede actualizar');
            return;
        }

        try {
            // Invalidar tamaño del mapa
            setTimeout(() => {
                this.mapa.invalidateSize();
            }, 100);

            console.log('🔄 Mapa actualizado');
        } catch (error) {
            console.error('❌ Error actualizando el mapa:', error);
        }
    }

    configurarEventos() {
        this.configurarEventosFiltros();
    }

    configurarEventosFiltros() {
        // Filtro de ruta
        const filtroRuta = document.getElementById('filtro-mapa-ruta');
        if (filtroRuta) {
            filtroRuta.addEventListener('change', (e) => {
                this.filtrarPorRuta(e.target.value);
            });
        }

        // Filtros de tipo
        ['retrasos', 'desvios', 'accidentes'].forEach(tipo => {
            const checkbox = document.getElementById(`filter-${tipo}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.aplicarFiltros();
                });
            }
        });
    }

    filtrarPorRuta(ruta) {
        this.filtroRutaActual = ruta;
        this.aplicarFiltros();
    }

    aplicarFiltros() {
        if (!this.marcadoresLayer) return;

        // Obtener estado de los checkboxes
        this.actualizarFiltrosTipo();

        // Filtrar incidentes
        const incidentesFiltrados = this.incidentesVisibles.filter(incidente => {
            // Filtro por ruta
            if (this.filtroRutaActual && incidente.ruta_afectada !== this.filtroRutaActual) {
                return false;
            }

            // Filtro por tipo
            const severidad = this.determinarSeveridad(incidente);
            if (severidad === 'grave' && !this.filtrosTipo.accidentes) return false;
            if (severidad === 'moderado' && !this.filtrosTipo.desvios) return false;
            if (severidad === 'leve' && !this.filtrosTipo.retrasos) return false;

            return true;
        });

        // Actualizar marcadores visibles
        this.marcadoresLayer.clearLayers();
        incidentesFiltrados.forEach(incidente => {
            this.agregarMarcadorIncidente(incidente);
        });

        this.actualizarContadorIncidentes(incidentesFiltrados.length);
        console.log('🔍 Aplicando filtros...');
    }

    actualizarFiltrosTipo() {
        this.filtrosTipo = {
            retrasos: document.getElementById('filter-retrasos')?.checked ?? true,
            desvios: document.getElementById('filter-desvios')?.checked ?? true,
            accidentes: document.getElementById('filter-accidentes')?.checked ?? true
        };
    }

    actualizarContadorIncidentes(cantidad) {
        const contador = document.getElementById('mapa-total-incidentes');
        if (contador) {
            contador.textContent = cantidad;
            contador.parentElement.classList.toggle('text-warning', cantidad > 0);
        }
    }

    centrarEnColima() {
        if (!this.inicializado) {
            console.warn('⚠️ Mapa no inicializado, no se puede centrar');
            return;
        }

        const centroColima = [19.2433, -103.725];
        this.mapa.setView(centroColima, 13);
        
        // Efecto visual de zoom
        this.mapa.flyTo(centroColima, 13, {
            duration: 1,
            easeLinearity: 0.25
        });

        console.log('🎯 Mapa centrado en Colima');
    }

    actualizarMapa() {
        if (!this.inicializado) {
            console.warn('⚠️ Mapa no inicializado, no se puede actualizar');
            return;
        }

        // Invalidar tamaño (útil si el mapa fue hidden/shown)
        setTimeout(() => {
            this.mapa.invalidateSize();
        }, 100);

        // Aplicar filtros actuales
        this.aplicarFiltros();

        console.log('🔄 Mapa actualizado');
    }

    configurarEventos() {
        // Evento cuando se abre el modal del mapa
        const mapaModal = document.getElementById('mapaModal');
        if (mapaModal) {
            mapaModal.addEventListener('shown.bs.modal', () => {
                setTimeout(() => {
                    if (this.mapa) {
                        this.mapa.invalidateSize();
                    }
                }, 100);
            });
        }

        // Configurar eventos de filtros
        this.configurarEventosFiltros();
    }

    configurarEventosFiltros() {
        // Filtro de ruta
        const filtroRuta = document.getElementById('filtro-mapa-ruta');
        if (filtroRuta) {
            filtroRuta.addEventListener('change', (e) => {
                this.filtrarPorRuta(e.target.value);
            });
        }

        // Filtros de tipo
        ['retrasos', 'desvios', 'accidentes'].forEach(tipo => {
            const checkbox = document.getElementById(`filter-${tipo}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.aplicarFiltros();
                });
            }
        });
    }

    // Método para debug
    mostrarEstado() {
        console.log('📊 Estado del Mapa:', {
            inicializado: this.inicializado,
            marcadores: this.marcadores.length,
            incidentesVisibles: this.incidentesVisibles.length,
            filtroRutaActual: this.filtroRutaActual,
            filtrosTipo: this.filtrosTipo
        });
    }
}

// Manejo de accesibilidad para modales Bootstrap
class ModalAccessibility {
    static init() {
        this.setupModalEvents();
    }

    static setupModalEvents() {
        // Configurar eventos para todos los modales
        const modales = document.querySelectorAll('.modal');
        
        modales.forEach(modal => {
            // Evento cuando el modal se muestra
            modal.addEventListener('show.bs.modal', () => {
                this.handleModalShow(modal);
            });

            // Evento cuando el modal se oculta
            modal.addEventListener('hide.bs.modal', () => {
                this.handleModalHide(modal);
            });

            // Evento cuando el modal se muestra completamente
            modal.addEventListener('shown.bs.modal', () => {
                this.handleModalShown(modal);
            });

            // Evento cuando el modal se oculta completamente
            modal.addEventListener('hidden.bs.modal', () => {
                this.handleModalHidden(modal);
            });
        });

        // También manejar modales manualmente si es necesario
        this.overrideBootstrapModalMethods();
    }

    static handleModalShow(modal) {
        // Remover aria-hidden cuando el modal se va a mostrar
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        
        // Configurar el foco
        const focusElement = modal.querySelector('[autofocus]') || 
                           modal.querySelector('input, select, textarea, button:not([disabled])');
        
        if (focusElement) {
            setTimeout(() => {
                focusElement.focus();
            }, 100);
        }

        console.log('🔧 Modal mostrándose:', modal.id);
    }

    static handleModalHide(modal) {
        console.log('🔧 Modal ocultándose:', modal.id);
    }

    static handleModalShown(modal) {
        // Asegurar que el modal esté completamente accesible
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        
        // Manejar el foco para lectores de pantalla
        this.trapFocus(modal);

        console.log('✅ Modal completamente visible:', modal.id);
    }

    static handleModalHidden(modal) {
        // Restaurar aria-hidden cuando el modal está completamente oculto
        modal.setAttribute('aria-hidden', 'true');
        modal.removeAttribute('aria-modal');

        console.log('🔧 Modal completamente oculto:', modal.id);
    }

    static trapFocus(modal) {
        // Implementar trap focus para accesibilidad
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }
            });
        }
    }

    static overrideBootstrapModalMethods() {
        // Override del método _enforceFocus de Bootstrap para mejor accesibilidad
        const originalEnforceFocus = bootstrap.Modal.prototype._enforceFocus;
        
        bootstrap.Modal.prototype._enforceFocus = function() {
            const modalElement = this._element;
            
            // Solo aplicar el trap focus si el modal está visible
            if (modalElement.classList.contains('show')) {
                originalEnforceFocus.call(this);
            }
        };
    }
}

// Inicializar la accesibilidad de modales cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    ModalAccessibility.init();
    
    // También inicializar VigiBusApp
    console.log('🚀 Iniciando VigiBus Colima...');
    window.vigiBusApp = new VigiBusApp();
});