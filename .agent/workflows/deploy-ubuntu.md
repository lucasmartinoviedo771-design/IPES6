---
description: Guía completa para desplegar IPES6 en servidor Ubuntu con Docker
---

# Guía de Despliegue IPES6 en Ubuntu Server

Esta guía te llevará paso a paso para desplegar tu aplicación IPES6 en un servidor Ubuntu usando Docker y Docker Compose.

## Pre-requisitos en el Servidor Ubuntu

1. **Ubuntu Server** (versión 20.04 o superior recomendada)
2. **Docker** y **Docker Compose** instalados
3. **Git** instalado
4. **Acceso SSH** al servidor
5. **Puertos abiertos**: 80 (HTTP), 443 (HTTPS si usas SSL)

---

## PASO 1: Verificar instalación de Docker en Ubuntu

```bash
# Verificar que Docker está instalado
docker --version

# Verificar que Docker Compose está instalado
docker compose version

# Verificar que el servicio de Docker está corriendo
sudo systemctl status docker
```

**Si Docker no está instalado o no funciona correctamente**, ejecuta:

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar tu usuario al grupo docker (para no usar sudo siempre)
sudo usermod -aG docker $USER

# Aplicar cambios (cierra y vuelve a abrir sesión SSH o ejecuta)
newgrp docker

# Verificar instalación
docker --version
docker compose version
```

---

## PASO 2: Clonar o subir el proyecto al servidor

### Opción A: Si tu repositorio está en GitHub/GitLab (RECOMENDADO)

```bash
# Navegar al directorio donde quieres el proyecto
cd ~

# Clonar el repositorio
git clone https://github.com/TU_USUARIO/IPES6.git

# Entrar al directorio
cd IPES6
```

### Opción B: Subir archivos manualmente desde tu PC Windows

Desde tu PC Windows, usando PowerShell o CMD:

```powershell
# Comprimir el proyecto (desde c:\proyectos\IPES6)
cd c:\proyectos\IPES6
tar -czf IPES6.tar.gz --exclude=node_modules --exclude=.venv --exclude=dist --exclude=.git .

# Subir al servidor (reemplaza USER y SERVER_IP)
scp IPES6.tar.gz USER@SERVER_IP:~/

# Luego en el servidor Ubuntu, descomprimir:
# cd ~
# mkdir IPES6
# cd IPES6
# tar -xzf ../IPES6.tar.gz
```

---

## PASO 3: Configurar variables de entorno

```bash
# Entrar al directorio del backend
cd ~/IPES6/backend

# Crear archivo .env desde el ejemplo
cp .env.docker.example .env

# Editar el archivo .env
nano .env
```

**Variables CRÍTICAS que debes cambiar:**

```env
# Seguridad
SECRET_KEY=TU_CLAVE_SECRETA_SUPER_LARGA_Y_ALEATORIA_AQUI
DEBUG=False
DJANGO_ENV=production

# Base de datos
DB_NAME=ipes6
DB_USER=ipes_user
DB_PASSWORD=UNA_CONTRASEÑA_SEGURA_AQUI
DB_ROOT_PASSWORD=OTRA_CONTRASEÑA_SEGURA_AQUI
DB_HOST=db
DB_PORT=3306

# Hosts y URLs permitidas (IMPORTANTE: pon la IP o dominio de tu servidor)
ALLOWED_HOSTS=localhost,127.0.0.1,TU_IP_SERVIDOR,TU_DOMINIO.com
FRONTEND_ORIGINS=http://TU_IP_SERVIDOR,http://TU_DOMINIO.com
CSRF_TRUSTED_ORIGINS=http://TU_IP_SERVIDOR,http://TU_DOMINIO.com
FRONTEND_URL=http://TU_IP_SERVIDOR

# Si usas HTTPS (después de configurar SSL):
# FRONTEND_ORIGINS=https://TU_DOMINIO.com
# CSRF_TRUSTED_ORIGINS=https://TU_DOMINIO.com
# FRONTEND_URL=https://TU_DOMINIO.com
```

**Ejemplo con IP real (por ejemplo 192.168.1.100):**

```env
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100
FRONTEND_ORIGINS=http://192.168.1.100
CSRF_TRUSTED_ORIGINS=http://192.168.1.100
FRONTEND_URL=http://192.168.1.100
```

Guarda el archivo (en nano: `Ctrl+O`, Enter, `Ctrl+X`).

---

## PASO 4: Ajustar docker-compose.yml para producción

```bash
# Editar el docker-compose.yml
nano ~/IPES6/backend/docker-compose.yml
```

**Cambios importantes:**

1. **Exponer el frontend en el puerto 80** (en vez de 8080):

```yaml
  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"  # Cambiar de "8080:80" a "80:80"
    depends_on:
      - backend
```

2. **NO exponer el backend directamente** (solo a través del proxy de nginx):

```yaml
  backend:
    # ... resto de configuración ...
    ports:
      - "127.0.0.1:8000:8000"  # Solo accesible localmente, no desde fuera
```

3. **Opcional: NO exponer MySQL al exterior** (más seguro):

```yaml
  db:
    # ... resto de configuración ...
    # Comentar o eliminar la línea de ports:
    # ports:
    #   - "127.0.0.1:3307:3306"
```

Guarda los cambios.

---

## PASO 5: Construir y levantar los contenedores

```bash
# Asegurarte de estar en el directorio backend
cd ~/IPES6/backend

# Construir y levantar todos los servicios
docker compose up -d --build
```

Este comando:
- Descargará las imágenes necesarias
- Construirá el backend (Python/Django)
- Construirá el frontend (React/Vite + Nginx)
- Levantará la base de datos MySQL
- Todo en segundo plano (`-d`)

**Espera unos minutos** para que se construyan las imágenes.

---

## PASO 6: Verificar que los contenedores están corriendo

```bash
# Ver el estado de los contenedores
docker compose ps

# Deberías ver 3 servicios en estado "Up":
# - backend
# - frontend
# - db
```

Si algún servicio no está "Up", revisa los logs:

```bash
# Ver logs del backend
docker compose logs backend

# Ver logs del frontend
docker compose logs frontend

# Ver logs de la base de datos
docker compose logs db
```

---

## PASO 7: Ejecutar migraciones de Django

```bash
# Aplicar migraciones a la base de datos
docker compose exec backend /app/.venv/bin/python manage.py migrate

# Recolectar archivos estáticos
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput

# Crear superusuario para acceder al admin de Django
docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
```

Sigue las instrucciones para crear el superusuario (usuario, email, contraseña).

---

## PASO 8: Verificar que todo funciona

```bash
# Probar que el backend responde
curl http://localhost:8000/api/docs

# Probar que el frontend responde
curl http://localhost
```

Desde tu navegador en otra computadora, accede a:
- `http://TU_IP_SERVIDOR` → Debería cargar la aplicación frontend
- `http://TU_IP_SERVIDOR/api/docs` → Debería mostrar la documentación de la API

---

## PASO 9: Configuración del Firewall (UFW)

```bash
# Permitir SSH (IMPORTANTE, no te bloquees)
sudo ufw allow 22/tcp

# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS (si vas a usar SSL)
sudo ufw allow 443/tcp

# Activar el firewall
sudo ufw enable

# Ver estado
sudo ufw status
```

---

## PASO 10: (OPCIONAL) Configurar SSL con Let's Encrypt

Para usar HTTPS con certificado SSL gratuito:

### 10.1 Instalar Certbot

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 10.2 Modificar nginx.conf del frontend

Antes de usar Certbot, necesitas modificar el `nginx.conf` para que use tu dominio:

```bash
nano ~/IPES6/frontend/nginx.conf
```

Cambia la línea:
```nginx
server_name localhost;
```

Por:
```nginx
server_name tu-dominio.com www.tu-dominio.com;
```

Reconstruye el frontend:
```bash
cd ~/IPES6/backend
docker compose up -d --build frontend
```

### 10.3 Obtener certificado SSL

```bash
# Detener temporalmente el frontend para que Certbot use el puerto 80
docker compose stop frontend

# Obtener certificado
sudo certbot certonly --standalone -d tu-dominio.com -d www.tu-dominio.com

# Volver a levantar el frontend
docker compose start frontend
```

### 10.4 Configurar nginx para usar SSL

Necesitarás crear una configuración nginx más avanzada con SSL. Puedo ayudarte con esto si lo necesitas.

---

## Comandos Útiles para Mantenimiento

```bash
# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar un servicio específico
docker compose restart backend
docker compose restart frontend

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes (CUIDADO: borra la BD)
docker compose down -v

# Actualizar el código y reconstruir
cd ~/IPES6
git pull  # Si usas git
cd backend
docker compose up -d --build

# Backup de la base de datos
docker compose exec db mysqldump -u root -p ipes6 > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T db mysql -u root -p ipes6 < backup_YYYYMMDD.sql

# Ver uso de recursos
docker stats

# Limpiar imágenes y contenedores no usados
docker system prune -a
```

---

## Solución de Problemas Comunes

### El frontend no carga

```bash
# Verificar logs del frontend
docker compose logs frontend

# Verificar que nginx está corriendo
docker compose ps frontend

# Reconstruir el frontend
docker compose up -d --build frontend
```

### Error de conexión a la base de datos

```bash
# Verificar que la BD está corriendo
docker compose ps db

# Verificar logs de la BD
docker compose logs db

# Verificar que las credenciales en .env coinciden
cat ~/IPES6/backend/.env | grep DB_
```

### Cambios en el código no se reflejan

```bash
# Reconstruir completamente
docker compose down
docker compose up -d --build

# Para el backend, también ejecuta:
docker compose exec backend /app/.venv/bin/python manage.py migrate
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
```

### Revisar configuración de red

```bash
# Ver qué puertos están escuchando
sudo netstat -tulpn | grep LISTEN

# O con ss
sudo ss -tulpn | grep LISTEN
```

---

## Monitoreo y Logs

```bash
# Ver todos los logs
docker compose logs

# Ver logs de las últimas 100 líneas
docker compose logs --tail=100

# Seguir los logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend
```

---

## Estructura de Datos Persistentes

Los datos se guardan en volúmenes de Docker:

- `db_data`: Base de datos MySQL
- `static_volume`: Archivos estáticos de Django
- `media_volume`: Archivos multimedia subidos por usuarios

Para hacer backup:

```bash
# Backup de volúmenes
docker run --rm -v backend_db_data:/data -v $(pwd):/backup ubuntu tar czf /backup/db_data_backup.tar.gz /data
```

---

## Próximos Pasos Recomendados

1. **Configurar backups automáticos** de la base de datos
2. **Configurar SSL/HTTPS** con Let's Encrypt
3. **Configurar un dominio** apuntando a tu servidor
4. **Configurar monitoreo** (ej: Portainer para Docker)
5. **Configurar actualizaciones automáticas** de seguridad en Ubuntu

---

## Notas Importantes

- **Seguridad**: Asegúrate de cambiar todas las contraseñas por defecto
- **Firewall**: Solo abre los puertos necesarios (22, 80, 443)
- **Backups**: Configura backups regulares de la base de datos
- **Actualizaciones**: Mantén Ubuntu, Docker y las dependencias actualizadas
- **Logs**: Revisa regularmente los logs para detectar problemas

---

## Soporte

Si encuentras problemas:
1. Revisa los logs: `docker compose logs`
2. Verifica el estado: `docker compose ps`
3. Verifica la configuración: `cat backend/.env`
4. Verifica la red: `sudo netstat -tulpn`
