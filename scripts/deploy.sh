#!/bin/bash

# Script de despliegue para IPES6 en Ubuntu
# Uso: ./deploy.sh [comando]
# Comandos: setup, start, stop, restart, logs, update, backup

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="$HOME/IPES6"
BACKEND_DIR="$PROJECT_DIR/backend"

# Función para imprimir mensajes
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose no está instalado"
        exit 1
    fi
    
    print_info "Docker y Docker Compose están instalados correctamente"
}

# Configuración inicial
setup() {
    print_info "Iniciando configuración inicial..."
    
    check_docker
    
    # Verificar que existe el directorio
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "El directorio $PROJECT_DIR no existe"
        exit 1
    fi
    
    cd "$BACKEND_DIR"
    
    # Crear .env si no existe
    if [ ! -f .env ]; then
        if [ -f .env.docker.example ]; then
            print_warning "Creando .env desde .env.docker.example"
            cp .env.docker.example .env
            print_warning "¡IMPORTANTE! Edita el archivo .env con tus configuraciones:"
            print_warning "nano $BACKEND_DIR/.env"
            exit 0
        else
            print_error "No se encontró .env ni .env.docker.example"
            exit 1
        fi
    fi
    
    print_info "Construyendo contenedores..."
    docker compose build
    
    print_info "Iniciando servicios..."
    docker compose up -d
    
    print_info "Esperando a que la base de datos esté lista..."
    sleep 20
    
    print_info "Ejecutando migraciones..."
    docker compose exec backend /app/.venv/bin/python manage.py migrate
    
    print_info "Recolectando archivos estáticos..."
    docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
    
    print_info "¡Configuración completada!"
    print_warning "Ahora crea un superusuario con: ./deploy.sh createsuperuser"
}

# Iniciar servicios
start() {
    print_info "Iniciando servicios..."
    cd "$BACKEND_DIR"
    docker compose up -d
    print_info "Servicios iniciados"
    status
}

# Detener servicios
stop() {
    print_info "Deteniendo servicios..."
    cd "$BACKEND_DIR"
    docker compose down
    print_info "Servicios detenidos"
}

# Reiniciar servicios
restart() {
    print_info "Reiniciando servicios..."
    cd "$BACKEND_DIR"
    docker compose restart
    print_info "Servicios reiniciados"
    status
}

# Ver estado
status() {
    print_info "Estado de los servicios:"
    cd "$BACKEND_DIR"
    docker compose ps
}

# Ver logs
logs() {
    cd "$BACKEND_DIR"
    if [ -z "$1" ]; then
        print_info "Mostrando logs de todos los servicios..."
        docker compose logs -f
    else
        print_info "Mostrando logs de $1..."
        docker compose logs -f "$1"
    fi
}

# Actualizar aplicación
update() {
    print_info "Actualizando aplicación..."
    
    cd "$PROJECT_DIR"
    
    # Si existe git, hacer pull
    if [ -d .git ]; then
        print_info "Obteniendo últimos cambios desde Git..."
        git pull
    fi
    
    cd "$BACKEND_DIR"
    
    print_info "Reconstruyendo contenedores..."
    docker compose up -d --build
    
    print_info "Aplicando migraciones..."
    docker compose exec backend /app/.venv/bin/python manage.py migrate
    
    print_info "Recolectando archivos estáticos..."
    docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
    
    print_info "Reiniciando servicios..."
    docker compose restart
    
    print_info "¡Actualización completada!"
}

# Backup de base de datos
backup() {
    print_info "Creando backup de la base de datos..."
    
    cd "$BACKEND_DIR"
    
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker compose exec db mysqldump -u root -p"${DB_ROOT_PASSWORD:-root}" ipes6 > "$BACKUP_FILE"
    
    print_info "Backup creado: $BACKUP_FILE"
}

# Crear superusuario
createsuperuser() {
    print_info "Creando superusuario..."
    cd "$BACKEND_DIR"
    docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
}

# Shell de Django
shell() {
    print_info "Abriendo shell de Django..."
    cd "$BACKEND_DIR"
    docker compose exec backend /app/.venv/bin/python manage.py shell
}

# Comando principal
case "$1" in
    setup)
        setup
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    createsuperuser)
        createsuperuser
        ;;
    shell)
        shell
        ;;
    *)
        echo "Script de gestión de IPES6"
        echo ""
        echo "Uso: $0 [comando]"
        echo ""
        echo "Comandos disponibles:"
        echo "  setup           - Configuración inicial (primera vez)"
        echo "  start           - Iniciar servicios"
        echo "  stop            - Detener servicios"
        echo "  restart         - Reiniciar servicios"
        echo "  status          - Ver estado de servicios"
        echo "  logs [servicio] - Ver logs (backend, frontend, db)"
        echo "  update          - Actualizar aplicación"
        echo "  backup          - Crear backup de BD"
        echo "  createsuperuser - Crear usuario administrador"
        echo "  shell           - Abrir shell de Django"
        echo ""
        echo "Ejemplos:"
        echo "  $0 setup"
        echo "  $0 logs backend"
        echo "  $0 update"
        ;;
esac
