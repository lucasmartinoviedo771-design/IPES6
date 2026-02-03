# Usar una imagen base oficial de Python ligera
FROM python:3.11-slim

# Establecer variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # uv config
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Instalar dependencias del sistema necesarias para mysqlclient, weasyprint, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    libmagic1 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar caché de capas
COPY pyproject.toml uv.lock ./

# Instalar dependencias usando uv
# --no-dev para producción, --system para instalar en el entorno global del contenedor (o crear venv)
# Aquí usaremos el venv que crea uv por defecto o --system. 
# Para simplicidad en docker, --system a veces es preferido, pero uv recomienda venv.
# Usaremos `uv sync` que crea .venv
RUN uv sync --no-dev

# Copiar el resto del código
# Copiar el resto del código
COPY . .

# Crear usuario no-root para seguridad
RUN addgroup --system appgroup && adduser --system --group appuser

# Crear directorios para estáticos y media, y asignar permisos
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appgroup /app/staticfiles /app/media && \
    chmod -R 775 /app/staticfiles /app/media

# Asignar permisos al resto del directorio de trabajo
RUN chown -R appuser:appgroup /app

# Cambiar al usuario no-root
USER appuser

# Exponer el puerto
EXPOSE 8000

# Comando por defecto (ajustar workers según CPU)
# Usamos el python del venv creado por uv
CMD ["/app/.venv/bin/gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
