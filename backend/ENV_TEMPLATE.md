# Variables de Entorno para Producción (IPES6)

Este archivo documenta las variables de entorno necesarias para desplegar la aplicación en producción.
NO incluyas secretos reales aquí. Usa este template para crear tu archivo `.env` de producción.

## Backend

| Variable | Descripción | Ejemplo / Valor por defecto |
|----------|-------------|-----------------------------|
| `DJANGO_ENV` | Entorno de ejecución | `production` |
| `SECRET_KEY` | **CRÍTICO**. Llave criptográfica de Django. | `generar-una-string-larga-y-aleatoria` |
| `DEBUG` | Modo debug (siempre False en prod) | `False` |
| `ALLOWED_HOSTS` | Dominios permitidos (separados por coma) | `ipes6.com,www.ipes6.com,1.2.3.4` |
| `DB_ENGINE` | Motor de base de datos | `mysql` |
| `DB_NAME` | Nombre de la base de datos | `ipes6` |
| `DB_USER` | Usuario de la base de datos | `ipes_user` |
| `DB_PASSWORD` | Contraseña de la base de datos | `***` |
| `DB_HOST` | Host de la base de datos (nombre del servicio docker) | `db` |
| `DB_PORT` | Puerto de la base de datos | `3306` |
| `FRONTEND_ORIGINS` | Orígenes permitidos para CORS/CSRF | `https://ipes6.com,https://www.ipes6.com` |
| `RECAPTCHA_SECRET_KEY` | Secret Key de Google reCAPTCHA v3 | `***` |
| `RECAPTCHA_MIN_SCORE` | Score mínimo para aprobar (0.0 - 1.0) | `0.5` |

## Frontend (Build Time)

Estas variables se inyectan al momento de construir la imagen de Docker (`npm run build`).

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE` | URL base de la API del backend | `https://api.ipes6.com/api` |
| `VITE_RECAPTCHA_SITE_KEY` | Site Key de Google reCAPTCHA v3 | `***` |
