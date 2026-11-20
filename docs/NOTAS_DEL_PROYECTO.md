# Notas generales del proyecto MusicCam

Guía de referencia para entender qué contiene el repositorio, qué responsabilidad tiene cada parte
y cómo se comunican el frontend, la API y la base de datos.

## 1. ¿Qué es el proyecto?

MusicCam es una plataforma para que artistas independientes publiquen conciertos virtuales y para
que el público los descubra, compre entradas y vea la transmisión o su repetición. Tiene tres
partes principales:

1. **Frontend**: la aplicación web que usan espectadores, artistas y administradores.
2. **Backend/API**: autentica usuarios, aplica las reglas del producto y entrega datos al frontend.
3. **PostgreSQL**: guarda las cuentas, eventos, compras, retiros y relaciones sociales.

El pago Wompi, el proveedor de transmisión y el chat se encuentran en modo simulado en este MVP. El
tráiler de un evento es un video público de YouTube incrustado; no reemplaza la transmisión
protegida del concierto.

## 2. Mapa de carpetas del repositorio

| Carpeta o archivo | Responsabilidad |
| --- | --- |
| `backend/` | Aplicación Flask, API REST, modelos de datos, migraciones y configuración Docker. |
| `frontend/` | SPA web en JavaScript, estilos, pruebas y documentación del cliente. |
| `docs/` | Esta explicación general (`NOTAS_DEL_PROYECTO.md`) y `archivo/` con versiones anteriores y respaldos. |

No hay un `package.json` en la raíz: los comandos `npm` se ejecutan dentro de
`frontend/`. La guía de uso detallada del backend está en
[`backend/README.md`](../backend/README.md); la del frontend, en
[`frontend/README.md`](../frontend/README.md).

## 3. Cómo se conectan las partes

```text
Navegador
  └─ frontend (Vite durante desarrollo)
       └─ HTTP/JSON → backend (Flask, /api/v1)
                        ├─ rutas y esquemas validan la solicitud
                        ├─ servicios aplican reglas de negocio
                        ├─ repositorios consultan o modifican datos
                        └─ SQLAlchemy → PostgreSQL
```

En Docker, `docker-compose.yml` arranca los tres servicios y los conecta en una red privada:

| Servicio | Función | Dirección desde Windows |
| --- | --- | --- |
| `frontend` | Sirve la SPA; con `docker compose watch --no-up` recibe los cambios locales del frontend. | `http://localhost:5173` |
| `api` | Sirve Flask/Gunicorn y las rutas `/api/v1`. | `http://localhost:8000` |
| `db` | Ejecuta PostgreSQL 16. | `localhost:5433` |

El frontend conoce la dirección de la API mediante `VITE_API_URL`. El backend conoce PostgreSQL
mediante `DATABASE_URL`. En Docker Compose, el nombre de host de la base es `db`; desde Windows se
usa el puerto publicado `5433`.

El volumen Docker `pgdata` conserva la base aunque se reconstruyan los contenedores. El volumen
`uploads` conserva archivos cargados, como fotos de perfil.

## 4. Backend: qué hace cada parte

El backend vive en `backend/` y está desarrollado con Flask, Flask-Smorest,
SQLAlchemy, Marshmallow, JWT y Alembic.

### Archivos principales

| Ruta | Función |
| --- | --- |
| `wsgi.py` | Crea la instancia Flask que ejecuta Gunicorn y que usan los comandos Flask. |
| `app/__init__.py` | Fábrica `create_app`: carga configuración, inicializa extensiones, registra módulos, rutas, errores y comandos. |
| `app/config.py` | Lee variables de entorno y configura desarrollo, pruebas o producción. |
| `app/extensions.py` | Inicializa base de datos, migraciones, JWT, CORS, limitador de solicitudes y OpenAPI. |
| `app/cli.py` | Registra comandos Flask, incluido `seed`. |
| `app/seed.py` | Carga datos de demostración usando servicios de negocio. Requiere un administrador activo ya creado en PostgreSQL. |
| `migrations/` | Historial versionado de cambios al esquema de la base. |
| `docker/initdb/01-bd-pruebas.sql` | Crea `streaming_test` al inicializar PostgreSQL por primera vez; no define el esquema de la aplicación. |
| `Dockerfile` | Instala dependencias y ejecuta migraciones antes de iniciar Gunicorn. |
| `docker-compose.yml` | Define API, frontend, PostgreSQL, puertos y volúmenes. |
| `Makefile` | Atajos para subir servicios, migrar, ejecutar pruebas y exportar OpenAPI. |

### Capas dentro de un módulo

La mayoría de los módulos del backend separan responsabilidades:

1. `routes.py`: declara endpoints, exige autenticación/rol, recibe la solicitud y llama un servicio.
2. `schemas.py`: valida y serializa datos; también documenta los cuerpos y respuestas en OpenAPI.
3. `service.py`: aplica reglas de negocio y coordina operaciones.
4. `repository.py`: contiene consultas y escrituras de acceso a datos.
5. `models.py`: define tablas, relaciones, índices y restricciones de SQLAlchemy.

El servicio es quien decide qué operaciones son válidas; la ruta HTTP no contiene las reglas
principales. El repositorio es quien habla con la base y el modelo representa sus datos.

### Módulos de negocio

| Módulo en `app/modules/` | Qué resuelve |
| --- | --- |
| `sistema/` | Estado y disponibilidad de la API, por ejemplo `/api/v1/health`. |
| `auth/` | Registro, inicio de sesión y renovación de tokens. |
| `usuarios/` | Perfil, datos personales, roles, estado y fotos de usuario. |
| `artistas/` | Funciones del artista, saldo, estadísticas y solicitudes de retiro. |
| `eventos/` | Crear, editar, publicar, cancelar, consultar y moderar eventos. |
| `compras/` | Compras, pagos, webhooks y acceso a entradas. |
| `transmision/` | Inicio/finalización de transmisiones y autorización de reproducción. |
| `social/` | Favoritos y seguimiento de artistas. |
| `admin/` | Dashboard y operaciones de administración sobre usuarios, eventos, compras y retiros. |

`app/common/` guarda elementos reutilizados, como enumeraciones, errores HTTP, seguridad,
paginación, formato de dinero y reloj. `app/infrastructure/` contiene adaptadores para pagos,
transmisión y almacenamiento; los servicios usan esas interfaces sin depender directamente de un
proveedor externo.

### Administradores

Las cuentas `ADMIN` se crean exclusivamente mediante inserción directa en PostgreSQL. No existe
botón, ruta de API, comando CLI ni creación desde `seed`. La contraseña debe guardarse como hash
Werkzeug, nunca en texto plano, y la fila debe incluir los datos obligatorios de consentimiento y
versión de política. El seed necesita al menos un `ADMIN` activo preexistente para realizar las
acciones administrativas de demostración.

## 5. Frontend: qué hace cada parte

El frontend está en `frontend/`. Es una SPA (aplicación de una sola página) construida con
JavaScript, Vite y Bootstrap. No utiliza un framework de componentes.

| Ruta | Responsabilidad |
| --- | --- |
| `index.html` | Contenedor HTML inicial de la aplicación. |
| `src/main.js` | Carga estilos, restaura la sesión y arranca el router. |
| `src/app/` | Tabla de rutas, navegación, guards de rol y layouts público, artista y administrador. |
| `src/core/` | Configuración, estado de sesión, cliente HTTP, manejo de errores y bus de eventos. |
| `src/features/` | Pantallas y lógica agrupadas por funcionalidad. |
| `src/shared/` | Componentes visuales, estilos y utilidades reutilizadas por varias funcionalidades. |
| `docs/openapi.json` | Copia del contrato OpenAPI generado por el backend. |
| `docs/trazabilidad.md` | Relación entre requisitos, pruebas y flujos que se deben verificar. |
| `tests/` | Pruebas automatizadas de servicios, vistas, utilidades y reglas de arquitectura. |
| `vite.config.js` | Configuración de Vite y salida de compilación en `dist/`. |
| `csp.config.js` | Política de seguridad de contenido añadida al HTML compilado. |

### Funcionalidades (`src/features/`)

| Feature | Pantallas y responsabilidades |
| --- | --- |
| `auth/` | Registro e inicio de sesión. |
| `catalog/` | Inicio, catálogo de eventos, perfiles de artistas y detalle del evento. |
| `checkout/` | Flujo para seleccionar y comprar una entrada. |
| `watch/` | Reproducción en vivo/replay, controles del reproductor y chat simulado. |
| `account/` | Perfil, entradas del usuario, favoritos y artistas seguidos. |
| `studio/` | Panel del artista: eventos, edición, sala de control, estadísticas y finanzas. |
| `admin/` | Dashboard, gestión de usuarios/eventos, consulta de compras, retiros y configuración. |

Las pantallas llaman servicios de su propia feature; esos servicios usan el cliente API definido en
`core/http/api-client.js`. `shared/` contiene elementos visuales comunes, así que las features no
necesitan duplicar botones, tarjetas, modales ni formatos.

### Sesión y comunicación

El access token se conserva en memoria y se envía en el encabezado `Authorization: Bearer ...`.
El refresh token se conserva en `sessionStorage` y el cliente HTTP lo usa para renovar la sesión
cuando corresponde. Los guards de `app/routes.js` protegen las rutas de artista y administrador.

El bus de eventos de `core/event-bus.js` permite que una funcionalidad avise a otra de cambios, por
ejemplo que una compra aprobada refresque una pantalla relacionada, sin importar archivos internos
de otra feature.

## 6. Ejemplo de un flujo completo

1. El artista se registra desde `auth/`; el frontend envía los datos a la API de autenticación.
2. En `studio/`, el artista crea un evento. La API valida sus datos y guarda el evento.
3. El público encuentra el evento desde `catalog/` y compra una entrada en `checkout/`.
4. El backend solicita el pago al adaptador configurado. En este MVP se usa Wompi simulado.
5. Al aprobarse el pago, la compra queda registrada y el usuario obtiene acceso.
6. En `watch/`, el backend comprueba que la persona pueda ver la transmisión o el replay.
7. El artista revisa ventas y saldo en `studio/`; un administrador supervisa datos desde `admin/`.

El tráiler de YouTube es contenido promocional público. La transmisión/replay tiene controles de
acceso distintos. El chat visible durante la reproducción es una simulación local, no un chat
multiusuario en tiempo real.

## 7. Base de datos y persistencia

- La base principal se llama `streaming`.
- Las pruebas usan `streaming_test`; los tests comprueban que no se ejecuten por error sobre otra
  base y limpian las tablas entre casos.
- Alembic aplica los cambios del esquema. El contenedor de API ejecuta `flask --app wsgi db upgrade`
  antes de iniciar Gunicorn.
- PostgreSQL guarda los datos estructurados; los archivos de usuario se guardan bajo el directorio
  de uploads.
- `docker compose down` conserva el volumen de datos. `docker compose down -v` elimina también los
  volúmenes y borra los datos locales.

## 8. Puesta en marcha en Windows

Desde PowerShell:

```powershell
Set-Location .\backend
Copy-Item .env.example .env
docker compose up -d --build
```

Antes de ejecutar el seed, debe haber un administrador activo creado directamente en PostgreSQL.
Después:

```powershell
docker compose exec api flask --app wsgi seed
```

Direcciones útiles:

- Aplicación: `http://localhost:5173`
- Salud de la API: `http://localhost:8000/api/v1/health`
- Swagger/OpenAPI interactivo: `http://localhost:8000/api/docs`
- PostgreSQL: puerto `5433` en el equipo, puerto `5432` dentro de Docker

Para desarrollar solo el frontend, entra a `frontend/`, instala dependencias con `npm ci` y
ejecuta `npm run dev`. Para que se conecte a la API local, `VITE_API_URL` debe apuntar al host y
puerto correctos; CORS del backend debe permitir el origen del frontend.

## 9. Variables de entorno importantes

Los valores de ejemplo están en los `.env.example`; se copian a `.env` local y no se deben subir
secretos reales al repositorio.

- Backend: `DATABASE_URL`, `TEST_DATABASE_URL`, `POSTGRES_PASSWORD`, `CORS_ORIGINS`, llaves JWT,
  comisión/precios, proveedor de pago, proveedor de streaming y carpeta de uploads.
- Frontend: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_PLAYER_MODE` y opciones de herramientas de
  desarrollo.

En producción se deben reemplazar las claves de ejemplo y desactivar los endpoints y herramientas
de desarrollo.

## 10. Pruebas y documentación técnica

- Frontend: desde `frontend/`, `npm test`, `npm run lint` y `npm run build`.
- Backend: instala `requirements-dev.txt` y ejecuta `pytest` desde
  `backend/`, con `TEST_DATABASE_URL` configurada hacia `streaming_test`.
- OpenAPI: la fuente se genera en el backend; las pruebas comprueban que `docs/openapi.json` esté
  sincronizado con las rutas actuales.
- Reglas completas de negocio y arquitectura: `backend/AGENTS.md`.
- Contrato de la API para el frontend: `backend/docs/openapi.json` y
  `frontend/docs/openapi.json`.

## 11. Inventario detallado del código

Las siguientes listas explican para qué sirve cada archivo fuente principal. La extensión del
archivo indica su tipo: `.py` es Python del backend; `.js` es JavaScript del navegador o de sus
pruebas; `.css` define estilos. Los archivos de configuración y ejecución están descritos en las
secciones anteriores.

### Backend: arranque y archivos comunes

| Archivo | Responsabilidad |
| --- | --- |
| `app/__init__.py` | Construye y configura la aplicación Flask con `create_app()`. |
| `app/cli.py` | Registra los comandos de terminal disponibles para Flask. |
| `app/config.py` | Convierte variables de entorno en configuración de cada entorno. |
| `app/extensions.py` | Crea las instancias compartidas de extensiones Flask/SQLAlchemy. |
| `app/models.py` | Importa modelos para que SQLAlchemy y Alembic conozcan las tablas. |
| `app/seed.py` | Prepara datos demostrativos llamando a los servicios del backend. |
| `app/common/__init__.py` | Inicializa el paquete de utilidades comunes. |
| `app/common/clock.py` | Centraliza el reloj UTC para lógica y pruebas deterministas. |
| `app/common/enums.py` | Define roles, estados, categorías y otros valores controlados. |
| `app/common/errors.py` | Define errores de negocio y su conversión a respuestas HTTP. |
| `app/common/headers.py` | Añade cabeceras de seguridad a las respuestas. |
| `app/common/money.py` | Calcula montos y comisiones con reglas de redondeo financiero. |
| `app/common/pagination.py` | Estandariza paginación de consultas y respuestas. |
| `app/common/schemas.py` | Contiene esquemas compartidos, como respuestas de error y paginación. |
| `app/common/security.py` | Resuelve el usuario actual y protege rutas por roles. |
| `app/common/sql.py` | Centraliza utilidades seguras para consultas SQL, como búsqueda textual escapada. |

### Backend: adaptadores de infraestructura

| Archivo | Responsabilidad |
| --- | --- |
| `app/infrastructure/__init__.py` | Inicializa el paquete de adaptadores externos. |
| `app/infrastructure/payments/__init__.py` | Selecciona y valida la configuración del proveedor de pagos. |
| `app/infrastructure/payments/base.py` | Define el contrato que implementa cualquier pasarela de pago. |
| `app/infrastructure/payments/wompi_simulado.py` | Simula checkout y eventos firmados de pago para desarrollo. |
| `app/infrastructure/storage/__init__.py` | Expone la integración de almacenamiento de archivos. |
| `app/infrastructure/storage/base.py` | Define el contrato de guardar, obtener y eliminar archivos. |
| `app/infrastructure/storage/local.py` | Guarda archivos en el sistema local del servidor. |
| `app/infrastructure/streaming/__init__.py` | Selecciona y valida el proveedor de transmisión. |
| `app/infrastructure/streaming/base.py` | Define el contrato de inicio y finalización de transmisiones. |
| `app/infrastructure/streaming/simulado.py` | Implementa un proveedor de streaming simulado. |

### Backend: módulos de negocio

Los `__init__.py` de los módulos marcan paquetes Python y pueden exponer sus imports públicos. En
cada grupo, `routes.py` define la interfaz HTTP, `schemas.py` valida datos, `service.py` aplica la
regla de negocio, `repository.py` consulta PostgreSQL y `models.py` representa tablas cuando
corresponde.

| Archivo | Responsabilidad |
| --- | --- |
| `app/modules/__init__.py` | Registra los blueprints de todos los módulos en la API. |
| `app/modules/admin/__init__.py` | Inicializa el paquete de administración. |
| `app/modules/admin/repository.py` | Ejecuta consultas administrativas agregadas o de solo lectura. |
| `app/modules/admin/routes.py` | Publica el dashboard y las rutas protegidas de administración. |
| `app/modules/admin/schemas.py` | Valida filtros y respuestas administrativas. |
| `app/modules/admin/service.py` | Coordina operaciones de administración mediante los servicios dueños de los datos. |
| `app/modules/artistas/__init__.py` | Inicializa el paquete de artistas. |
| `app/modules/artistas/models.py` | Define los datos de retiro del artista. |
| `app/modules/artistas/repository.py` | Consulta artistas, saldos, estadísticas y retiros. |
| `app/modules/artistas/routes.py` | Expone perfil/panel de artista, finanzas y estadísticas. |
| `app/modules/artistas/schemas.py` | Valida solicitudes y serializa respuestas de artista y retiro. |
| `app/modules/artistas/service.py` | Aplica reglas de saldo, solicitudes de retiro y estadísticas. |
| `app/modules/auth/__init__.py` | Inicializa el paquete de autenticación. |
| `app/modules/auth/routes.py` | Expone registro, login y renovación de sesión. |
| `app/modules/auth/schemas.py` | Valida datos de entrada y salida de autenticación. |
| `app/modules/auth/service.py` | Coordina registro, comprobación de contraseña y emisión de tokens. |
| `app/modules/compras/__init__.py` | Inicializa el paquete de compras. |
| `app/modules/compras/models.py` | Define la tabla y los estados de compra. |
| `app/modules/compras/repository.py` | Lee y persiste compras y sus relaciones. |
| `app/modules/compras/routes.py` | Expone compra, consulta de compra, pagos simulados y webhook. |
| `app/modules/compras/schemas.py` | Valida órdenes de compra y serializa tickets/respuestas. |
| `app/modules/compras/service.py` | Controla el ciclo de compra, pago, reembolso y autorización por compra. |
| `app/modules/eventos/__init__.py` | Inicializa el paquete de eventos. |
| `app/modules/eventos/models.py` | Define eventos, estados, restricciones y criterios de visibilidad. |
| `app/modules/eventos/repository.py` | Consulta, crea, actualiza y bloquea filas de eventos. |
| `app/modules/eventos/routes.py` | Expone catálogo y operaciones de creación/publicación del artista. |
| `app/modules/eventos/schemas.py` | Valida eventos, incluyendo fechas, precios y enlaces de tráiler. |
| `app/modules/eventos/service.py` | Aplica las transiciones y reglas de publicación/cancelación. |
| `app/modules/sistema/__init__.py` | Inicializa el paquete de endpoints del sistema. |
| `app/modules/sistema/routes.py` | Publica endpoints de estado como el health check. |
| `app/modules/sistema/service.py` | Construye la información de salud del backend. |
| `app/modules/social/__init__.py` | Inicializa el paquete social. |
| `app/modules/social/models.py` | Define relaciones de favoritos y artistas seguidos. |
| `app/modules/social/repository.py` | Consulta y persiste favoritos y seguimientos. |
| `app/modules/social/routes.py` | Expone endpoints de favoritos y seguidos. |
| `app/modules/social/service.py` | Aplica reglas de visibilidad, idempotencia y autorización social. |
| `app/modules/transmision/__init__.py` | Inicializa el paquete de transmisión. |
| `app/modules/transmision/routes.py` | Expone credenciales, iniciar/finalizar y consultar transmisión. |
| `app/modules/transmision/schemas.py` | Valida los datos de las operaciones de transmisión. |
| `app/modules/transmision/service.py` | Verifica derechos de acceso y coordina con el proveedor de streaming. |
| `app/modules/usuarios/__init__.py` | Inicializa el paquete de usuarios. |
| `app/modules/usuarios/models.py` | Define las cuentas, roles, estado y datos de perfil. |
| `app/modules/usuarios/repository.py` | Lee y persiste usuarios, bloqueos y búsquedas. |
| `app/modules/usuarios/routes.py` | Expone perfil propio, fotos, compras y datos de usuario. |
| `app/modules/usuarios/schemas.py` | Valida perfil y serializa datos públicos/privados permitidos. |
| `app/modules/usuarios/service.py` | Aplica registro de usuario, perfil, rol y reglas de cuenta. |

### Backend: migraciones y pruebas

| Archivo | Qué verifica o mantiene |
| --- | --- |
| `migrations/env.py` | Conecta Alembic con la configuración y metadata de modelos. |
| `migrations/script.py.mako` | Plantilla para generar nuevas migraciones. |
| `migrations/versions/f83b134f5706_crear_tabla_usuarios.py` | Crea el esquema inicial de usuarios. |
| `migrations/versions/4a8b008f23d0_crear_tabla_eventos.py` | Crea tablas y campos de eventos. |
| `migrations/versions/dea8e7712d17_crear_tabla_compras.py` | Crea tablas y campos de compras. |
| `migrations/versions/b1f5584029a3_crear_tabla_retiros.py` | Crea las tablas de retiro de artistas. |
| `migrations/versions/b877ffcf2bfd_crear_tablas_favoritos_y_seguidores.py` | Añade relaciones sociales. |
| `migrations/versions/c6e1d7b4a920_agregar_trailer_youtube_eventos.py` | Añade el enlace de tráiler a eventos. |
| `tests/conftest.py` | Crea la app de pruebas, prepara `streaming_test` y limpia datos entre casos. |
| `tests/factories.py` | Construye usuarios, eventos, compras y datos reutilizables para pruebas. |
| `tests/unit/test_arquitectura.py` | Vigila dependencias entre módulos y reglas de arquitectura. |
| `tests/unit/test_comun.py` | Prueba utilidades compartidas de negocio. |
| `tests/unit/test_entrega.py` | Verifica reglas relacionadas con la entrega de compras/entradas. |
| `tests/unit/test_gateway.py` | Prueba el adaptador de pagos y su contrato. |
| `tests/unit/test_streaming.py` | Prueba el adaptador de transmisión. |
| `tests/integration/test_admin.py` | Prueba permisos, gestión administrativa, roles y moderación. |
| `tests/integration/test_artistas_panel.py` | Prueba panel, estadísticas, saldo y retiros del artista. |
| `tests/integration/test_auth.py` | Prueba registro, login, refresh y control de autenticación. |
| `tests/integration/test_cli.py` | Comprueba los comandos CLI disponibles y que no exista `crear-admin`. |
| `tests/integration/test_compras.py` | Prueba compras, pagos y cambios de estado asociados. |
| `tests/integration/test_e2e_demo.py` | Recorre un flujo completo entre registros, evento, compra y administración. |
| `tests/integration/test_endurecimiento.py` | Comprueba validaciones y endurecimiento de la API. |
| `tests/integration/test_eventos.py` | Prueba creación, edición, publicación y transiciones de eventos. |
| `tests/integration/test_openapi.py` | Verifica endpoints, esquemas, ejemplos y archivo OpenAPI exportado. |
| `tests/integration/test_proteccion.py` | Comprueba que respuestas y registros no filtren datos sensibles. |
| `tests/integration/test_seed.py` | Verifica datos demo, idempotencia y requisito de admin preexistente. |
| `tests/integration/test_sistema.py` | Prueba endpoints de salud del sistema. |
| `tests/integration/test_social.py` | Prueba favoritos y relaciones de seguimiento. |
| `tests/integration/test_transmision.py` | Prueba acceso, permisos y ciclo de vida de transmisión/replay. |
| `tests/integration/test_usuarios.py` | Prueba perfil, roles, estado y fotos de usuario. |

### Frontend: aplicación, rutas y núcleo

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.js` | Carga estilos globales, restaura sesión e inicia el router. |
| `src/app/routes.js` | Mapea hashes/rutas a páginas y define guards/layouts por rol. |
| `src/app/router.js` | Controla navegación, carga diferida de páginas, errores y foco. |
| `src/app/route-match.js` | Encuentra la definición de ruta que coincide con la URL actual. |
| `src/app/guards.js` | Permite o redirige navegación según sesión y roles. |
| `src/app/layouts/public.layout.js` | Monta navegación y estructura de páginas públicas. |
| `src/app/layouts/studio.layout.js` | Monta la navegación y estructura del panel de artista. |
| `src/app/layouts/admin.layout.js` | Monta la navegación y estructura del panel de administración. |
| `src/app/layouts/panel-nav.js` | Construye la navegación compartida de los paneles. |
| `src/app/pages/system.pages.js` | Renderiza páginas del sistema, acceso denegado y rutas inexistentes. |
| `src/core/config.js` | Lee variables Vite y valida URLs de configuración externa. |
| `src/core/store.js` | Implementa el estado reactivo pequeño usado por la aplicación. |
| `src/core/event-bus.js` | Permite publicar y escuchar eventos entre funcionalidades desacopladas. |
| `src/core/http/api-client.js` | Hace peticiones HTTP, añade JWT, serializa parámetros y renueva sesión. |
| `src/core/http/api-error.js` | Normaliza errores de API a un formato que las vistas pueden mostrar. |
| `src/core/session/session-store.js` | Mantiene access token en memoria y refresh token en `sessionStorage`. |
| `src/core/session/session.js` | Inicia, restaura, actualiza y cierra sesiones del usuario. |

### Frontend: funcionalidades por archivo

#### Autenticación

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/auth/index.js` | Exporta las páginas públicas de autenticación. |
| `src/features/auth/auth.api.js` | Llama endpoints de registro, login y refresh. |
| `src/features/auth/auth.service.js` | Coordina validación, registro, login y estado local de sesión. |
| `src/features/auth/pages/login.page.js` | Renderiza y controla el formulario de ingreso. |
| `src/features/auth/pages/register.page.js` | Renderiza y controla el formulario de registro. |
| `src/features/auth/components/form-feedback.js` | Muestra errores y ayudas de validación de formularios. |

#### Catálogo y relaciones sociales

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/catalog/index.js` | Exporta páginas del inicio, eventos y artistas. |
| `src/features/catalog/catalog.api.js` | Llama endpoints públicos de eventos y artistas. |
| `src/features/catalog/catalog.service.js` | Normaliza filtros y coordina consultas de catálogo. |
| `src/features/catalog/social.service.js` | Coordina favorito/seguimiento desde las pantallas de catálogo. |
| `src/features/catalog/pages/home.page.js` | Presenta portada, recomendaciones y secciones destacadas. |
| `src/features/catalog/pages/events.page.js` | Muestra y filtra el catálogo de eventos. |
| `src/features/catalog/pages/event-detail.page.js` | Presenta el detalle y tráiler promocional del evento. |
| `src/features/catalog/pages/artists.page.js` | Muestra el catálogo de artistas. |
| `src/features/catalog/pages/artist-detail.page.js` | Muestra perfil y eventos de un artista. |
| `src/features/catalog/components/event-action.js` | Decide la acción disponible según estado y acceso al evento. |
| `src/features/catalog/components/favorite-button.js` | Controla la acción de marcar/quitar favoritos. |
| `src/features/catalog/components/follow-button.js` | Controla la acción de seguir/dejar de seguir artistas. |
| `src/features/catalog/components/toggle-button.js` | Componente de botón reutilizable para toggles sociales. |

#### Compra y checkout

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/checkout/index.js` | Exporta los componentes y servicios del checkout. |
| `src/features/checkout/checkout.api.js` | Llama endpoints para crear y consultar compras/pagos. |
| `src/features/checkout/checkout.service.js` | Coordina compra, pago simulado y consulta de estado. |
| `src/features/checkout/components/checkout-modal.js` | Abre y administra el flujo modal de compra. |
| `src/features/checkout/components/checkout-views.js` | Renderiza los estados del checkout y sus mensajes. |
| `src/features/checkout/checkout.css` | Estilos del checkout y sus estados. |

#### Cuenta del usuario

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/account/index.js` | Exporta las páginas de perfil, entradas y listas sociales. |
| `src/features/account/account.api.js` | Llama endpoints de perfil, favoritos y seguidos. |
| `src/features/account/account.service.js` | Coordina operaciones y validaciones de la cuenta. |
| `src/features/account/tickets.service.js` | Prepara la información y acciones de entradas compradas. |
| `src/features/account/pages/profile.page.js` | Muestra y actualiza datos del perfil. |
| `src/features/account/pages/my-events.page.js` | Muestra entradas y eventos vinculados a la cuenta. |
| `src/features/account/pages/favorites.page.js` | Presenta la lista de eventos favoritos. |
| `src/features/account/pages/following.page.js` | Presenta artistas seguidos. |
| `src/features/account/pages/social-list.js` | Comparte la estructura de listas sociales. |
| `src/features/account/components/ticket-card.js` | Renderiza el detalle resumido de una entrada. |
| `src/features/account/components/calendar-view.js` | Organiza entradas/eventos en una vista calendario. |
| `src/features/account/account.css` | Estilos del perfil y las páginas de cuenta. |

#### Estudio del artista

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/studio/index.js` | Exporta las pantallas del estudio del artista. |
| `src/features/studio/studio.api.js` | Llama endpoints de eventos, estadísticas, streaming y finanzas. |
| `src/features/studio/studio.service.js` | Coordina operaciones de eventos y panel del artista. |
| `src/features/studio/finanzas.service.js` | Prepara y valida saldos, retiros e historial financiero. |
| `src/features/studio/pages/studio-home.page.js` | Presenta el inicio del estudio. |
| `src/features/studio/pages/my-events.page.js` | Lista eventos propios y acciones posibles. |
| `src/features/studio/pages/event-form.page.js` | Controla el formulario de crear/editar eventos. |
| `src/features/studio/pages/control-room.page.js` | Administra el panel de control de una transmisión. |
| `src/features/studio/pages/event-stats.page.js` | Muestra estadísticas de un evento del artista. |
| `src/features/studio/pages/finance.page.js` | Presenta saldo, solicitudes y movimientos de retiro. |
| `src/features/studio/components/studio-views.js` | Contiene vistas y fragmentos reutilizables del estudio. |
| `src/features/studio/components/event-form-view.js` | Renderiza campos y acciones del formulario de evento. |
| `src/features/studio/components/control-room-views.js` | Renderiza estados/acciones de la sala de control. |
| `src/features/studio/components/saldo-cards.js` | Muestra los importes de saldo por estado. |
| `src/features/studio/components/sales-chart.js` | Presenta gráficas de ventas. |
| `src/features/studio/studio.css` | Estilos del estudio y de las vistas financieras. |

#### Reproducción

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/watch/index.js` | Exporta la página de reproducción. |
| `src/features/watch/watch.api.js` | Llama endpoints de reproducción/transmisión. |
| `src/features/watch/watch.service.js` | Coordina comprobaciones de acceso y estado de reproducción. |
| `src/features/watch/pages/watch.page.js` | Une reproductor, estado del evento y chat en una pantalla. |
| `src/features/watch/components/watch-views.js` | Renderiza los estados y controles visuales del reproductor. |
| `src/features/watch/components/simulated-chat.js` | Muestra mensajes simulados claramente identificados como demo. |
| `src/features/watch/player/player-adapter.js` | Define/adapta la interfaz común del reproductor. |
| `src/features/watch/player/simulated-player.js` | Implementa la reproducción de demostración. |
| `src/features/watch/player/hls-player.js` | Integra HLS cuando se configura ese modo. |
| `src/features/watch/watch.css` | Estilos de pantalla de reproducción y chat. |

#### Administración

| Archivo | Responsabilidad |
| --- | --- |
| `src/features/admin/index.js` | Exporta las páginas del panel admin. |
| `src/features/admin/admin.api.js` | Agrupa peticiones HTTP para las funciones administrativas disponibles. |
| `src/features/admin/admin.service.js` | Maneja filtros, parámetros, validaciones y mensajes del panel admin. |
| `src/features/admin/components/admin-list.js` | Crea listas con filtros, tablas, paginación y estados de carga/error. |
| `src/features/admin/components/admin-ui.js` | Renderiza insignias y elementos visuales administrativos. |
| `src/features/admin/components/dialogs.js` | Comparte diálogos de confirmación/motivos administrativos. |
| `src/features/admin/components/filtros-ui.js` | Construye controles de búsqueda y filtros de listas. |
| `src/features/admin/pages/dashboard.page.js` | Muestra métricas generales de la plataforma. |
| `src/features/admin/pages/users.page.js` | Lista cuentas y permite suspender/reactivar; los admins se crean en PostgreSQL. |
| `src/features/admin/pages/events.page.js` | Lista y modera eventos. |
| `src/features/admin/pages/purchases.page.js` | Consulta compras y agrupa información de pago/desglose. |
| `src/features/admin/pages/withdrawals.page.js` | Gestiona solicitudes de retiro. |
| `src/features/admin/pages/settings.page.js` | Presenta parámetros públicos de configuración. |
| `src/features/admin/admin.css` | Estilos de filtros, tablas, formularios e indicadores de administración. |

#### Componentes y utilidades compartidas

| Archivo | Responsabilidad |
| --- | --- |
| `src/shared/ui/artist-card.js` | Tarjeta reutilizable de artista. |
| `src/shared/ui/avatar.js` | Presenta avatar/foto y alternativa si no hay imagen. |
| `src/shared/ui/bar-chart.js` | Renderiza gráficas de barras reutilizables. |
| `src/shared/ui/category-chips.js` | Muestra filtros/enlaces rápidos de categorías. |
| `src/shared/ui/confirm-dialog.js` | Diálogo accesible de confirmación. |
| `src/shared/ui/countdown.js` | Cuenta regresiva hacia la fecha del evento. |
| `src/shared/ui/cover.js` | Renderiza portada de contenido. |
| `src/shared/ui/empty-state.js` | Presenta estados vacíos y de error. |
| `src/shared/ui/event-card.js` | Tarjeta de evento reutilizada en catálogo y listas. |
| `src/shared/ui/footer.js` | Pie común de la aplicación. |
| `src/shared/ui/form-field.js` | Estructura común de campos de formulario. |
| `src/shared/ui/hero.js` | Sección principal destacada de una página. |
| `src/shared/ui/kpi-card.js` | Tarjeta para indicador o métrica. |
| `src/shared/ui/live-badge.js` | Insignia de evento en vivo. |
| `src/shared/ui/modal.js` | Infraestructura común para modales accesibles. |
| `src/shared/ui/navbar-links.js` | Define enlaces visibles según el rol. |
| `src/shared/ui/navbar.js` | Renderiza la barra principal de navegación. |
| `src/shared/ui/pagination.js` | Controles de cambio de página. |
| `src/shared/ui/rail.js` | Carrusel/riel horizontal de elementos. |
| `src/shared/ui/skeleton.js` | Placeholders de carga. |
| `src/shared/ui/spinner.js` | Indicador giratorio de carga. |
| `src/shared/ui/toast.js` | Notificaciones temporales. |
| `src/shared/utils/categorias.js` | Nombres y mapeos de categorías. |
| `src/shared/utils/category-gradient.js` | Selecciona gradientes visuales por categoría. |
| `src/shared/utils/debounce.js` | Retrasa una operación hasta que cesa la entrada repetida. |
| `src/shared/utils/dom.js` | Inserta nodos HTML seguros y realiza operaciones DOM comunes. |
| `src/shared/utils/format-date.js` | Formatea fechas y horas en la zona horaria del producto. |
| `src/shared/utils/format-money.js` | Formatea importes en pesos colombianos. |
| `src/shared/utils/html.js` | Crea plantillas HTML seguras escapando texto por defecto. |
| `src/shared/utils/media-url.js` | Resuelve URLs de imágenes y medios. |
| `src/shared/utils/motion.js` | Centraliza desplazamientos y respeta movimiento reducido. |
| `src/shared/utils/query-string.js` | Convierte parámetros de URL en filtros y viceversa. |
| `src/shared/utils/validators.js` | Validaciones compartidas de formularios. |
| `src/shared/utils/youtube-url.js` | Valida/normaliza enlaces de videos de YouTube. |

#### Estilos globales

| Archivo | Responsabilidad |
| --- | --- |
| `src/shared/styles/tokens.css` | Colores, tipografía, radios, espaciado y otros tokens del diseño. |
| `src/shared/styles/base.css` | Estilos base para documento, foco, tipografía y estructura. |
| `src/shared/styles/bootstrap-overrides.css` | Ajusta Bootstrap para el tema y componentes del proyecto. |
| `src/shared/styles/components.css` | Estilos visuales compartidos por componentes y páginas. |

### Frontend: pruebas

| Archivo | Qué verifica |
| --- | --- |
| `tests/account/account-views.test.js` | Estructura y presentación de pantallas de cuenta. |
| `tests/account/tickets.service.test.js` | Preparación y comportamiento de las entradas. |
| `tests/admin/admin-acceso.test.js` | Guards, navegación admin, reglas UI y estructura de tablas administrativas. |
| `tests/admin/admin.service.test.js` | Filtros, parámetros y mensajes del panel admin. |
| `tests/auditoria/reglas.test.js` | Reglas de dependencias entre features y uso seguro de APIs. |
| `tests/catalog/artistas.test.js` | Comportamiento de vistas/listas de artistas. |
| `tests/catalog/catalog.service.test.js` | Filtros y coordinación del catálogo. |
| `tests/catalog/social.test.js` | Interacciones sociales desde catálogo. |
| `tests/checkout/checkout.service.test.js` | Flujo de compra y pago desde el cliente. |
| `tests/checkout/checkout-views.test.js` | Estados visuales del checkout. |
| `tests/http/api-client.test.js` | HTTP, JWT, refresh, errores, cancelación y formularios multipart. |
| `tests/studio/finanzas.test.js` | Formateo y validaciones financieras del artista. |
| `tests/studio/studio-views.test.js` | Vistas del panel de artista. |
| `tests/studio/studio.service.test.js` | Reglas de servicio y validaciones del estudio. |
| `tests/ui/event-card.test.js` | Presentación y acciones de la tarjeta de evento. |
| `tests/utils/format-date.test.js` | Formato de fecha, hora y conversiones locales/UTC. |
| `tests/utils/format-money.test.js` | Formateo de moneda. |
| `tests/utils/html.test.js` | Escapado y seguridad de plantillas HTML. |
| `tests/utils/query-string.test.js` | Parseo y generación de parámetros URL. |
| `tests/utils/validators.test.js` | Validadores compartidos. |
| `tests/utils/youtube-url.test.js` | Validación de enlaces a videos de YouTube. |
| `tests/watch/watch.test.js` | Acceso y comportamiento de reproductor/chat de demostración. |

Esta guía identifica la responsabilidad principal de cada archivo. Para conocer las condiciones
exactas de una función, sus argumentos y sus efectos, la implementación de ese mismo archivo y las
pruebas indicadas son la referencia detallada.


