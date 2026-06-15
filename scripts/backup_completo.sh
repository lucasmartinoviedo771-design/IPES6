#!/bin/bash

# Script de Respaldo Completo para IPES6 (Código, DB, .env, Media)
# Ubicación recomendada: /home/ipesrg/sistema-gestion/scripts/backup_completo.sh

# Salir inmediatamente si ocurre un error inesperado
set -e

# 1. Validar directorio de trabajo
if [ ! -d "backend" ] || [ ! -d "frontend" ] || [ ! -d ".git" ]; then
    echo "❌ Error: Este script debe ser ejecutado desde la raíz del proyecto /home/ipesrg/sistema-gestion"
    exit 1
fi

# 2. Verificar cambios sin confirmar en Git
UNCOMMITTED=$(git status --porcelain)
if [ -n "$UNCOMMITTED" ]; then
    echo "⚠️ ADVERTENCIA: Hay cambios sin confirmar (uncommitted changes) en el repositorio:"
    echo "$UNCOMMITTED"
    echo ""
    read -p "¿Deseas continuar con el backup del código base tal como está en el último commit? (s/n): " confirm
    if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
        echo "❌ Backup cancelado por el usuario."
        exit 1
    fi
fi

# 3. Cargar variables de entorno de forma segura
ENV_PATH="backend/.env"
if [ ! -f "$ENV_PATH" ]; then
    echo "❌ Error: No se encontró el archivo de entorno en $ENV_PATH"
    exit 1
fi

echo "🔐 Leyendo credenciales de base de datos desde $ENV_PATH..."
# Extraer variables de forma aislada para evitar problemas de parseo
DB_NAME=$(grep -E "^DB_NAME=" "$ENV_PATH" | cut -d'=' -f2 | tr -d '\r' | tr -d '"' | tr -d "'")
DB_ROOT_PASSWORD=$(grep -E "^DB_ROOT_PASSWORD=" "$ENV_PATH" | cut -d'=' -f2 | tr -d '\r' | tr -d '"' | tr -d "'")

# Valores por defecto si no existen
DB_NAME=${DB_NAME:-sistema_gestion}
DB_CONTAINER="ipes6-db-dev"
BACKEND_CONTAINER="ipes6-backend-dev"

if [ -z "$DB_ROOT_PASSWORD" ]; then
    echo "❌ Error: DB_ROOT_PASSWORD no está definida en el archivo .env"
    exit 1
fi

# 4. Configurar nombres y rutas
TIMESTAMP=$(date +%Y%m%d_%H%M)
BACKUP_DIR="/home/ipesrg/sistema-gestion/backups"
TEMP_DIR="${BACKUP_DIR}/backup_IPES6_${TIMESTAMP}"
TARBALL_FILE="${BACKUP_DIR}/backup_IPES6_${TIMESTAMP}.tar.gz"

echo "📂 Creando directorios de trabajo..."
mkdir -p "$BACKUP_DIR"
mkdir -p "$TEMP_DIR"

# 5. Exportar código limpio usando git archive
echo "📦 Exportando código versionado de Git (limpio de node_modules, .venv, dist)..."
git archive HEAD | tar -x -C "$TEMP_DIR"

# 6. Copiar secretos (.env)
echo "🔑 Copiando archivos de configuración de entorno (.env)..."
if [ -f "backend/.env" ]; then
    cp "backend/.env" "$TEMP_DIR/backend/.env"
fi
if [ -f "frontend/.env" ]; then
    cp "frontend/.env" "$TEMP_DIR/frontend/.env"
fi

# 7. Respaldo de Base de Datos desde el contenedor Docker
echo "🗄️ Generando dump de la base de datos MySQL ($DB_NAME)..."
if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    # Redirigir stdout al archivo sql local
    docker exec "$DB_CONTAINER" mysqldump -u root -p"$DB_ROOT_PASSWORD" "$DB_NAME" > "$TEMP_DIR/db_ipes6.sql"
    
    # Validación crítica: revisar si el dump se generó correctamente y no está vacío
    if [ ! -s "$TEMP_DIR/db_ipes6.sql" ] || [ $(wc -c < "$TEMP_DIR/db_ipes6.sql") -lt 100 ]; then
        echo "❌ Error: El dump de la base de datos está vacío o incompleto."
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    echo "✅ Dump de base de datos generado exitosamente."
else
    echo "❌ Error: El contenedor de base de datos '$DB_CONTAINER' no está en ejecución."
    rm -rf "$TEMP_DIR"
    exit 1
fi

# 8. Respaldo de Media desde el contenedor backend
echo "🖼️ Copiando archivos multimedia (volumen media_volume)..."
if docker ps --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
    # Creamos la carpeta destino en la estructura exportada
    mkdir -p "$TEMP_DIR/backend/media"
    # docker cp de los contenidos del contenedor
    docker cp "${BACKEND_CONTAINER}:/app/media/." "$TEMP_DIR/backend/media/"
    echo "✅ Archivos multimedia copiados exitosamente."
else
    echo "⚠️ Advertencia: El contenedor '$BACKEND_CONTAINER' no está corriendo. Intentando copiar carpeta local media/ si existe..."
    if [ -d "backend/media" ]; then
        cp -r "backend/media" "$TEMP_DIR/backend/media"
    else
        echo "⚠️ No se encontró carpeta media local ni contenedor corriendo."
    fi
fi

# 9. Comprimir carpeta de backup completa
echo "🤐 Comprimiendo todo en $TARBALL_FILE..."
tar -czf "$TARBALL_FILE" -C "$BACKUP_DIR" "backup_IPES6_${TIMESTAMP}"

# 10. Limpieza
echo "🧹 Limpiando archivos temporales..."
rm -rf "$TEMP_DIR"

# 11. Resultado
echo ""
echo "=========================================================="
echo "🎉 Backup completo finalizado con éxito!"
echo "=========================================================="
echo "📁 Archivo generado: $TARBALL_FILE"
echo "⚖️ Tamaño del backup: $(du -sh "$TARBALL_FILE" | cut -f1)"
echo "🔍 Contenido del archivo comprimido (primeras 25 líneas):"
tar -tf "$TARBALL_FILE" | head -n 25
echo "... (se omiten las líneas restantes para mayor claridad)"
echo "=========================================================="
