# MusicCam

Plataforma para que artistas independientes publiquen conciertos virtuales y el público los
descubra, compre su entrada y los vea en vivo o en replay.

## Estructura

```text
.
├── frontend/   SPA en JavaScript (Vanilla JS + Bootstrap 5 + Vite), organizada por features
│   └── src/
│       ├── app/        rutas, router, guards y layouts (composición de la aplicación)
│       ├── core/       configuración, cliente HTTP, sesión, store y bus de eventos
│       ├── shared/     componentes UI, utilidades y estilos reutilizables
│       └── features/   auth · catalog · checkout · watch · account · studio · admin
├── backend/    API REST en Flask (/api/v1), PostgreSQL, migraciones y Docker Compose
└── docs/       notas generales del proyecto y archivo de versiones anteriores
```

Dependencias del frontend en un solo sentido: `app → features → shared → core`.

## Documentación

| Tema | Archivo |
| --- | --- |
| Visión general y cómo se conectan las partes | [docs/NOTAS_DEL_PROYECTO.md](docs/NOTAS_DEL_PROYECTO.md) |
| Arquitectura y reglas del frontend | [frontend/AGENTS.md](frontend/AGENTS.md) |
| Uso del frontend | [frontend/README.md](frontend/README.md) |
| Reglas de negocio y contrato de la API | [backend/AGENTS.md](backend/AGENTS.md) |
| Uso del backend | [backend/README.md](backend/README.md) |

## Arranque rápido (Docker)

```powershell
Set-Location .\backend
Copy-Item .env.example .env   # solo la primera vez
docker compose up -d --build
```

Para que los cambios del frontend se vean al guardar, deja corriendo en otra terminal:

```powershell
docker compose watch --no-up
```

El código no se comparte como carpeta con el contenedor (en Windows eso hacía que cada página
tardara segundos): `watch` copia cada archivo que guardas y Vite recarga el navegador.

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/v1
- PostgreSQL: localhost:5433
