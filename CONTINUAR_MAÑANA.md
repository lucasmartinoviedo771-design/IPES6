# 🚀 Continuar Despliegue - Pasos para Mañana

## 📋 Situación Actual

- ✅ Código en GitHub (rama main)
- ✅ Proyecto clonado en servidor Ubuntu (192.168.1.212)
- ✅ Docker instalado y funcionando
- ⚠️ Problema: docker-compose.yml tiene contraseñas hardcodeadas

---

## 🎯 Pasos para Completar el Despliegue (5-10 minutos)

### 1. Conectarse al Servidor

```bash
ssh admin@192.168.1.212
```

### 2. Restaurar docker-compose.yml Original

```bash
cd ~/IPES6/backend
git checkout docker-compose.yml
```

### 3. Crear .env Correcto

```bash
cat > .env << 'EOF'
DJANGO_ENV=production
DEBUG=False
SECRET_KEY=y2FzLrxpCqcUhfi3umnJNwtgD8ERA0j7k5vsWPGIbH4SQVM1d9
DB_NAME=ipes6
DB_USER=ipes_user
DB_PASSWORD=ipes2024
DB_ROOT_PASSWORD=root2024
DB_HOST=db
DB_PORT=3306
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.212
FRONTEND_ORIGINS=http://192.168.1.212
CSRF_TRUSTED_ORIGINS=http://192.168.1.212
FRONTEND_URL=http://192.168.1.212
MEDIA_URL=/media/
MEDIA_ROOT=/app/media
STATIC_URL=/static/
STATIC_ROOT=/app/staticfiles
LOG_LEVEL=INFO
LANGUAGE_CODE=es-ar
TIME_ZONE=America/Argentina/Buenos_Aires
USE_I18N=True
USE_TZ=True
EOF
```

### 4. Limpiar TODO lo Viejo

```bash
docker compose down
docker volume prune -f
docker system prune -af
```

### 5. Desplegar

```bash
docker compose up -d --build
```

Espera 2-3 minutos mientras construye las imágenes.

### 6. Aplicar Migraciones

```bash
# Esperar a que MySQL esté listo (30-60 segundos)
sleep 60

# Aplicar migraciones
docker compose exec backend /app/.venv/bin/python manage.py migrate

# Recolectar estáticos
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
```

### 7. Crear Superusuario

```bash
docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
```

Ingresa:
- Usuario: admin
- Email: tu_email@ejemplo.com
- Contraseña: (elige una segura)

### 8. Verificar Estado

```bash
docker compose ps
```

Deberías ver 3 servicios "Up":
- backend
- frontend
- db

### 9. Probar en el Navegador

Abre en tu navegador:
- http://192.168.1.212 → Aplicación
- http://192.168.1.212/api/docs → API
- http://192.168.1.212/admin → Admin Django

---

## 🔧 Si Algo Sale Mal

### Ver logs:
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs db
```

### Reiniciar todo:
```bash
docker compose down -v
docker compose up -d --build
```

---

## 📞 Información de Configuración

- **Servidor**: 192.168.1.212
- **Usuario SSH**: admin
- **Base de datos**: ipes6
- **Usuario MySQL**: ipes_user
- **Contraseña MySQL**: ipes2024
- **Contraseña Root MySQL**: root2024

---

## ✅ Checklist Final

- [ ] Conectado al servidor
- [ ] docker-compose.yml restaurado
- [ ] .env creado
- [ ] Volúmenes antiguos eliminados
- [ ] docker compose up ejecutado
- [ ] Migraciones aplicadas
- [ ] Estáticos recolectados
- [ ] Superusuario creado
- [ ] Aplicación funciona en el navegador

---

¡Estás a solo 5-10 minutos de tener todo funcionando! 🎉
