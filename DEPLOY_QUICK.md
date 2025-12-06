# Guía Rápida de Despliegue IPES6 en Ubuntu

## Resumen Ejecutivo

Esta es una guía rápida para desplegar IPES6 en Ubuntu. Para la guía completa, consulta `.agent/workflows/deploy-ubuntu.md`.

## Pre-requisitos

- ✅ Servidor Ubuntu 20.04+ con acceso SSH
- ✅ Docker y Docker Compose instalados en Ubuntu
- ✅ Tu IP o dominio del servidor
- ✅ Puertos 80 y 443 abiertos en el firewall

## Pasos Rápidos

### 1️⃣ En tu PC Windows (OPCIONAL - Preparación)

```powershell
cd c:\proyectos\IPES6
.\scripts\prepare-deploy.ps1
```

Este script te ayuda a:
- Verificar que tienes los archivos necesarios
- Crear configuración de producción
- Opcionalmente crear un ZIP para transferir

### 2️⃣ Transferir al Servidor Ubuntu

**Opción A: Git (Recomendado)**
```bash
# En el servidor
cd ~
git clone https://github.com/TU_REPO/IPES6.git
cd IPES6
```

**Opción B: SCP desde Windows**
```powershell
# En Windows PowerShell
scp -r c:\proyectos\IPES6 usuario@IP_SERVIDOR:~/
```

### 3️⃣ En el Servidor Ubuntu - Configurar

```bash
cd ~/IPES6/backend

# Crear y editar .env
cp .env.production .env   # o .env.docker.example si no existe
nano .env

# IMPORTANTE: Cambia estos valores en .env:
# - SECRET_KEY (genera una clave aleatoria)
# - DB_PASSWORD y DB_ROOT_PASSWORD
# - ALLOWED_HOSTS=TU_IP_O_DOMINIO
# - FRONTEND_ORIGINS=http://TU_IP_O_DOMINIO
# - CSRF_TRUSTED_ORIGINS=http://TU_IP_O_DOMINIO
```

### 4️⃣ Desplegar con el Script de Ayuda

```bash
# Dar permisos de ejecución
chmod +x ~/IPES6/scripts/deploy.sh

# Ejecutar configuración inicial
~/IPES6/scripts/deploy.sh setup

# Esto automáticamente:
# - Construye las imágenes Docker
# - Inicia los contenedores
# - Aplica migraciones
# - Recolecta archivos estáticos
```

### 5️⃣ Crear Superusuario

```bash
~/IPES6/scripts/deploy.sh createsuperuser
```

### 6️⃣ Verificar

```bash
# Ver estado
~/IPES6/scripts/deploy.sh status

# Ver logs
~/IPES6/scripts/deploy.sh logs

# Probar en el navegador
# http://TU_IP_O_DOMINIO
```

## Comandos del Script de Ayuda

```bash
./scripts/deploy.sh setup           # Primera configuración
./scripts/deploy.sh start           # Iniciar servicios
./scripts/deploy.sh stop            # Detener servicios
./scripts/deploy.sh restart         # Reiniciar servicios
./scripts/deploy.sh status          # Ver estado
./scripts/deploy.sh logs [servicio] # Ver logs
./scripts/deploy.sh update          # Actualizar aplicación
./scripts/deploy.sh backup          # Backup de BD
./scripts/deploy.sh createsuperuser # Crear admin
```

## Configuración Manual (Sin Script)

Si prefieres hacerlo paso a paso manualmente:

```bash
cd ~/IPES6/backend

# 1. Construir y levantar
docker compose up -d --build

# 2. Esperar 30 segundos a que arranque todo
sleep 30

# 3. Aplicar migraciones
docker compose exec backend /app/.venv/bin/python manage.py migrate

# 4. Archivos estáticos
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput

# 5. Crear superusuario
docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
```

## Configurar Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Verificar que Todo Funciona

```bash
# Verificar servicios
docker compose ps

# Deberías ver 3 servicios "Up":
# - backend
# - frontend  
# - db

# Probar desde el servidor
curl http://localhost
curl http://localhost/api/docs
```

## Acceder desde Tu PC

Abre tu navegador y ve a:
- `http://IP_DE_TU_SERVIDOR` → Aplicación
- `http://IP_DE_TU_SERVIDOR/api/docs` → Documentación API

## Solución Rápida de Problemas

### No carga la aplicación
```bash
# Ver logs del frontend
docker compose logs frontend

# Reconstruir
docker compose up -d --build frontend
```

### Error de base de datos
```bash
# Ver logs de la BD
docker compose logs db

# Verificar credenciales
cat backend/.env | grep DB_
```

### Los cambios no se reflejan
```bash
# Reconstruir todo
docker compose down
docker compose up -d --build
```

## Mantenimiento

### Backup
```bash
~/IPES6/scripts/deploy.sh backup
```

### Actualizar código
```bash
cd ~/IPES6
git pull  # Si usas Git
~/IPES6/scripts/deploy.sh update
```

### Ver logs en tiempo real
```bash
~/IPES6/scripts/deploy.sh logs backend
```

## Configuración Importante de Producción

Edita `backend/.env` con estos valores mínimos:

```env
# Seguridad
SECRET_KEY=cambiar-por-clave-larga-y-aleatoria
DEBUG=False
DJANGO_ENV=production

# Base de datos
DB_NAME=ipes6
DB_USER=ipes_user
DB_PASSWORD=contraseña-segura-aqui
DB_ROOT_PASSWORD=otra-contraseña-segura
DB_HOST=db
DB_PORT=3306

# Red (IMPORTANTE: usa tu IP o dominio real)
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100
FRONTEND_ORIGINS=http://192.168.1.100
CSRF_TRUSTED_ORIGINS=http://192.168.1.100
FRONTEND_URL=http://192.168.1.100
```

## Próximos Pasos Opcionales

1. **Configurar SSL/HTTPS** con Let's Encrypt (ver guía completa)
2. **Configurar dominio** apuntando a tu servidor
3. **Backups automáticos** con cron
4. **Monitoreo** con Portainer

## Ayuda

- **Guía completa**: `.agent/workflows/deploy-ubuntu.md`
- **Ver logs**: `~/IPES6/scripts/deploy.sh logs`
- **Estado**: `~/IPES6/scripts/deploy.sh status`

---

**¡Listo!** Tu aplicación IPES6 debería estar corriendo en Ubuntu 🚀
