# Guía de Despliegue en Linux (IPES6)

Esta guía detalla los pasos para llevar tu aplicación desde Windows a un servidor Linux de producción.

## 1. Requisitos Previos
En tu servidor Linux (Ubuntu/Debian), instala:
- **Git**: `sudo apt update && sudo apt install git`
- **Docker**: [Guía oficial de instalación](https://docs.docker.com/engine/install/ubuntu/)
- **Docker Compose**: `sudo apt install docker-compose-plugin`

## 2. Clonar el Repositorio
```bash
git clone <URL_DE_TU_REPOSITORIO>
cd IPES6
```

## 3. Configuración del Entorno (.env)
El archivo `.env` **no se sube al repositorio** por seguridad. Debes crearlo en el servidor.

1. Ve a la carpeta backend:
   ```bash
   cd backend
   ```
2. Crea el archivo `.env`:
   ```bash
   nano .env
   ```
3. Pega tu configuración (ajustada para producción):

```ini
# --- Base de Datos ---
# Si usas la DB del contenedor Docker:
DB_HOST=db
DB_ENGINE=mysql
DB_NAME=ipes1
DB_USER=ipes_user
DB_PASSWORD=ipes_password
DB_PORT=3306

# --- Django ---
DEBUG=False
DJANGO_ENV=production
SECRET_KEY=pon-aqui-una-clave-larga-y-segura-para-prod
ALLOWED_HOSTS=tu-dominio.com,tu-ip-publica,localhost

# --- Frontend ---
# La URL pública donde accederán los usuarios
FRONTEND_URL=http://tu-dominio.com
# Orígenes permitidos para CORS
FRONTEND_ORIGINS=http://tu-dominio.com

# --- Google OAuth ---
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# ¡Importante! Cambiar localhost por tu dominio
GOOGLE_REDIRECT_URI=http://tu-dominio.com/api/auth/google/callback
```

## 4. Ajuste Importante en docker-compose.yml
En tu entorno de desarrollo (Windows), el `docker-compose.yml` fuerza `DB_HOST=host.docker.internal`.
**Para Linux**, debes editar `docker-compose.yml` y **eliminar** o comentar la sección `environment` del servicio `backend` para que use los valores de tu archivo `.env`.

```yaml
  backend:
    # ...
    env_file:
      - .env
    # environment:  <-- ELIMINA O COMENTA ESTA SECCIÓN EN PROD
    #   - DB_HOST=host.docker.internal
    #   ...
```

## 5. Iniciar la Aplicación
```bash
docker-compose up -d --build
```

## 6. Inicialización (Solo la primera vez)
Una vez que los contenedores estén corriendo:

1. **Aplicar migraciones** (crear tablas en la DB):
   ```bash
   docker-compose exec backend python manage.py migrate
   ```

2. **Recopilar archivos estáticos** (CSS/JS del admin):
   ```bash
   docker-compose exec backend python manage.py collectstatic --noinput
   ```

3. **Crear usuario administrador**:
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

## 7. Verificar
Accede a `http://tu-ip-publica:8080`.
