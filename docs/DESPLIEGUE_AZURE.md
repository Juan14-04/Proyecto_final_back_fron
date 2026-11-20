# Despliegue de MusicCam en Azure (adaptación del Manual de Infraestructura)

Pasos 1–16 y 17–19 del manual se hacen **igual** (portal Azure + SSH), cambiando nombres si quieres
(`alojamientos` → `musiccam`). Aquí solo se listan las diferencias de MusicCam frente al ejemplo.

## Diferencias frente al Sistema Alojamientos

| Manual (Alojamientos) | MusicCam |
|---|---|
| MySQL 8.4 | **PostgreSQL 16** (servicio `db`, volumen `musiccam_pgdata`) |
| Backend Flask en puerto 5000, módulo `app:crear_app()` | Flask en puerto **8000**, `wsgi:app`; el contenedor ejecuta `flask db upgrade` al iniciar (no hay paso manual de migraciones) |
| `/health` | **`/api/v1/health`** |
| Frontend con Dockerfile + nginx incluido | El `Dockerfile` es de desarrollo; se añadió **`frontend/Dockerfile.prod`** + `frontend/nginx.conf` |
| `VITE_API_URL=/api/v1` | **URL absoluta** `http://<DNS>/api/v1` (el código hace `new URL(apiUrl)`, una ruta relativa fallaría) |
| Nginx proxy a `/api/` | Proxy a `/api/` **y `/uploads/`** (fotos y tráilers) |
| Script `promover_admin.py` | No existe: el admin se crea por **inserción directa en PostgreSQL** (ver `backend/README.md`, ~línea 98) |

Plantillas listas en [`deploy/`](../deploy): `compose.yaml`, `nginx/default.conf`, `.env.example`.

## 0. Antes de Azure: dos repositorios en GitHub (obligatorio en la entrega)

Hoy el código está en un monorepo. Se piden repos **Backend** y **Frontend** separados:

```bash
# Desde la carpeta del monorepo (git subtree conserva historial)
git subtree split -P backend  -b split-backend
git subtree split -P frontend -b split-frontend
# Crea en GitHub: musiccam-api y musiccam-frontend (vacíos), luego:
git push https://github.com/Juan14-04/musiccam-api.git      split-backend:main
git push https://github.com/Juan14-04/musiccam-frontend.git split-frontend:main
```

Haz commit y push de `frontend/Dockerfile.prod` y `frontend/nginx.conf` **antes** del split.
Si son privados, da acceso de lectura a `rortegani@gmail.com`.

## Pasos 1–16 (portal Azure) — resumen de valores

Suscripción Azure for Students · presupuesto 10 USD con alertas 50/80/100 % · RG `rg-musiccam-g01`
· región North Central US (o la autorizada en tu política) · VM `vm-musiccam-g01`, Ubuntu 24.04,
`Standard_B2als_v2`, SSD estándar 32 GiB, clave SSH Ed25519, **sin puertos públicos** · IP pública
estática · NSG propio sin reglas abiertas · apagado automático 11:30 (SA Pacific) · DNS
`musiccam-g01.northcentralus.cloudapp.azure.com` · regla `Allow-SSH-Admin` (tu IPv4/32, prioridad 100)
· tarea de encendido 10:00 (opcional).

Para la demo en vivo, **la regla HTTP**: el manual la limita a tu IP (`Allow-HTTP-Admin`, 110).
Como el video/revisión necesita acceso, usa origen **Internet** en TCP 80 si el docente debe abrir la
URL; nunca abras 8000 ni 5432.

## Pasos 17–18: Docker en la VM (idénticos)

Actualizar Ubuntu, instalar `docker-ce docker-compose-plugin` desde el repo oficial, verificar con
`sudo docker run --rm hello-world`.

## Paso 19 (adaptado): código en la VM

```bash
mkdir -p ~/musiccam && chmod 700 ~/musiccam
git clone https://github.com/<usuario>/musiccam-api.git      ~/musiccam/backend
git clone https://github.com/<usuario>/musiccam-frontend.git ~/musiccam/frontend
git -C ~/musiccam/backend  status -sb
git -C ~/musiccam/frontend status -sb
```

## Pasos 20–22 (adaptados): configuración, BD, backend y frontend

Copia las plantillas del monorepo (desde tu PC, con scp, o pega con `nano`):

```bash
cd ~/musiccam
mkdir -p nginx
# compose.yaml y nginx/default.conf = contenido de deploy/compose.yaml y deploy/nginx/default.conf
cp .env.example .env 2>/dev/null || nano .env   # contenido de deploy/.env.example
```

Rellena `.env` **sin imprimir secretos** (mismo estilo que 20.11):

```bash
python3 - <<'PY'
from pathlib import Path
from secrets import token_hex
p = Path.home()/"musiccam"/".env"
dns = "http://musiccam-g01.northcentralus.cloudapp.azure.com"
p.write_text(
  f"PUBLIC_ORIGIN={dns}\nPOSTGRES_PASSWORD={token_hex(24)}\n"
  f"SECRET_KEY={token_hex(32)}\nJWT_SECRET_KEY={token_hex(32)}\nPLAYBACK_TOKEN_SECRET={token_hex(32)}\n")
p.chmod(0o600)
PY
cut -d= -f1 .env          # solo nombres
```

(La contraseña es hex, así que es URL-safe para `DATABASE_URL`. Los secretos tienen ≥32 caracteres,
exigido por `ProductionConfig`.)

Construcción y arranque:

```bash
cd ~/musiccam
sudo docker compose config --quiet && echo "Compose válido"
sudo docker compose build api frontend
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail 50 api      # debe mostrar "Running upgrade ..." y gunicorn
```

Verificaciones (equivalentes a 21.11, 21.16, 22.19, 23.12–23.13, 23.24):

```bash
sudo docker compose exec -T api python -c 'import urllib.request as u; r=u.urlopen("http://127.0.0.1:8000/api/v1/health"); print(r.status, r.read().decode())'
sudo docker compose exec -T api flask --app wsgi db current
sudo docker compose exec -T db psql -U app -d streaming -c '\dt'
sudo docker volume ls | grep musiccam
sudo docker compose exec -T frontend nginx -t
sudo docker compose exec -T frontend wget -qO- http://api:8000/api/v1/health
sudo docker inspect musiccam-frontend-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} RW={{.RW}}{{println}}{{end}}'
curl -i http://127.0.0.1/api/v1/health
curl -i http://127.0.0.1/api/v1/eventos
sudo ss -ltnp '( sport = :80 or sport = :5432 or sport = :8000 )'   # solo :80 escucha
```

Nombres de contenedor: Compose usa `<carpeta>-<servicio>-1` → `musiccam-frontend-1`, etc.

## Paso 23: acceso externo (desde Git Bash en Windows, sin SSH)

```bash
curl -I http://musiccam-g01.northcentralus.cloudapp.azure.com/
curl -i http://musiccam-g01.northcentralus.cloudapp.azure.com/api/v1/health
```

## Datos iniciales y administrador

Revisa `backend/README.md` (secciones `seed` y admin): `seed` **no corre con `APP_ENV=production`**
y requiere un admin activo. Registra un usuario por la interfaz y luego promuévelo con `UPDATE` vía
`sudo docker compose exec -T db psql -U app -d streaming` (comprueba el nombre exacto de tabla/columna
de rol en `backend/app/models.py`), sin dejar contraseñas en la grabación.

## Seguridad: el video no debe mostrar secretos

No hagas `cat .env`. Para HTTPS, el manual lo deja pendiente (Paso 24). Si las pruebas de login se
hacen por HTTP, usa el **túnel SSH** del Anexo A.1
(`ssh -i ... -N -L 127.0.0.1:8080:127.0.0.1:80 azureuser@<IP>`) y navega a `http://127.0.0.1:8080/`.
Pero ojo: `PUBLIC_ORIGIN` está horneado en el build y en CORS; para usar el túnel, el origen debe ser
`http://127.0.0.1:8080`, lo que obliga a otro build. Más simple: configurar HTTPS (Paso 24) y usar
el DNS real.

## Problemas conocidos a tener en cuenta

- **Rate limiting**: `Flask-Limiter` usa `memory://` y la IP remota; detrás de Nginx todas las
  peticiones parecen venir de la misma IP (no hay `ProxyFix`). Si el login se bloquea en la demo,
  es por esto. Solución: añadir `ProxyFix(app.wsgi_app, x_for=1)` en `create_app`.
- **Gateway de pagos/streaming** son simulados (`wompi_simulado`, `simulado`); funcionan sin servicios
  externos.
- `ENFORCE_START_WINDOW` se fuerza a `True` en producción: un evento solo se puede ver dentro de su
  ventana de inicio. Crea un evento programado para dentro de pocos minutos al grabar la demo.
- Cambiar `PUBLIC_ORIGIN` (p. ej. al pasar a HTTPS) requiere `docker compose build frontend` y
  `up -d`.

## Guion del video (orden exigido)

1. Integrantes y propósito del proyecto.
2. App por DNS: navegar, registrarse/login, listar eventos, comprar, ver; pestaña **Network**
   mostrando `/api/v1/...` con 200.
3. Portal Azure: suscripción, costos/presupuesto/alertas, RG, VM, disco, VNet/subred, NIC, IP, DNS,
   NSG (SSH solo a tu IP /32; 80 abierto; **sin** 8000/5432), apagado automático y tarea de encendido.
4. SSH: `whoami`, `hostname`, `cat /etc/os-release`, `ls ~/musiccam`, `git status -sb` de ambos
   repos, `docker --version`, `docker compose version`, `docker images`, `docker compose ps`,
   verificaciones de la sección anterior.

Entrega: `Video_Implementacion_Azure_MusicCam.mp4` + en el comentario: nombre del proyecto,
integrantes, URL repo backend, URL repo frontend, URL DNS.
