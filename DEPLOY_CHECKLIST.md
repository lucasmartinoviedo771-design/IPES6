# ✅ Checklist de Despliegue IPES6 en Ubuntu

## 📋 Antes de Empezar

- [ ] Tengo acceso SSH a mi servidor Ubuntu
- [ ] Conozco la IP o dominio de mi servidor: ________________
- [ ] El servidor tiene instalado Docker y Docker Compose
- [ ] Tengo Git instalado (o método para transferir archivos)
- [ ] Tengo el proyecto IPES6 listo para subir

---

## 🖥️ PARTE 1: En tu PC Windows (Preparación)

### Opción A: Preparación Automática
- [ ] Ejecutar: `.\scripts\prepare-deploy.ps1`
- [ ] Revisar y editar: `backend\.env.production`
- [ ] Cambiar `SECRET_KEY` por una clave aleatoria segura
- [ ] Cambiar `DB_PASSWORD` y `DB_ROOT_PASSWORD`
- [ ] Reemplazar `TU_IP_O_DOMINIO_AQUI` con la IP real de tu servidor

### Opción B: Preparación Manual
- [ ] Copiar `backend\.env.docker.example` a `backend\.env`
- [ ] Editar `backend\.env` con valores de producción
  - [ ] `SECRET_KEY=` (clave larga y aleatoria)
  - [ ] `DEBUG=False`
  - [ ] `DB_PASSWORD=` (contraseña segura)
  - [ ] `DB_ROOT_PASSWORD=` (contraseña segura)
  - [ ] `ALLOWED_HOSTS=localhost,127.0.0.1,MI_IP_SERVIDOR`
  - [ ] `FRONTEND_ORIGINS=http://MI_IP_SERVIDOR`
  - [ ] `CSRF_TRUSTED_ORIGINS=http://MI_IP_SERVIDOR`
  - [ ] `FRONTEND_URL=http://MI_IP_SERVIDOR`

---

## 📤 PARTE 2: Subir al Servidor

### Opción A: Con Git (Recomendado)
```bash
# En tu PC
git add .
git commit -m "Preparado para despliegue"
git push

# Luego en el servidor Ubuntu
git clone https://github.com/TU_REPO/IPES6.git
```

- [ ] Código pusheado a Git
- [ ] Código clonado en el servidor

### Opción B: Con SCP
```powershell
# En tu PC Windows
scp -r c:\proyectos\IPES6 usuario@IP_SERVIDOR:~/
```

- [ ] Archivos transferidos al servidor

---

## 🐧 PARTE 3: En el Servidor Ubuntu

### 3.1 Verificar Docker
```bash
docker --version
docker compose version
sudo systemctl status docker
```

- [ ] Docker instalado y funcionando
- [ ] Docker Compose instalado

**Si Docker NO está instalado:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

- [ ] Docker instalado correctamente

### 3.2 Preparar Configuración
```bash
cd ~/IPES6/backend
cp .env.docker.example .env    # o .env.production si existe
nano .env
```

**Verificar valores en .env:**
- [ ] `SECRET_KEY` es único y seguro
- [ ] `DEBUG=False`
- [ ] `DB_PASSWORD` es segura
- [ ] `DB_ROOT_PASSWORD` es segura
- [ ] `ALLOWED_HOSTS` incluye la IP del servidor
- [ ] `FRONTEND_ORIGINS` tiene la URL correcta
- [ ] `CSRF_TRUSTED_ORIGINS` tiene la URL correcta

### 3.3 Ajustar docker-compose.yml
```bash
nano ~/IPES6/backend/docker-compose.yml
```

- [ ] Puerto del frontend cambiado a `"80:80"` (línea ~61)
- [ ] Backend NO expuesto externamente (puerto 127.0.0.1:8000:8000)

### 3.4 Dar Permisos al Script
```bash
chmod +x ~/IPES6/scripts/deploy.sh
```

- [ ] Script executable

---

## 🚀 PARTE 4: Despliegue

### Opción A: Con el Script de Ayuda (Recomendado)
```bash
~/IPES6/scripts/deploy.sh setup
```

- [ ] Servicios construidos y levantados
- [ ] Migraciones aplicadas
- [ ] Archivos estáticos recolectados

### Opción B: Manual
```bash
cd ~/IPES6/backend
docker compose up -d --build
sleep 30
docker compose exec backend /app/.venv/bin/python manage.py migrate
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
```

- [ ] Contenedores construidos
- [ ] Servicios levantados
- [ ] Migraciones aplicadas
- [ ] Archivos estáticos recolectados

### 4.2 Crear Superusuario
```bash
~/IPES6/scripts/deploy.sh createsuperuser
# O manualmente:
# docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
```

**Datos del superusuario:**
- Usuario: ________________
- Email: ________________
- Contraseña: ________________ (¡Guárdala de forma segura!)

- [ ] Superusuario creado

---

## ✅ PARTE 5: Verificación

### 5.1 Verificar Servicios
```bash
~/IPES6/scripts/deploy.sh status
# O:
# cd ~/IPES6/backend
# docker compose ps
```

**Deberías ver 3 servicios "Up":**
- [ ] `backend` - Estado: Up
- [ ] `frontend` - Estado: Up
- [ ] `db` - Estado: Up

### 5.2 Verificar Logs
```bash
~/IPES6/scripts/deploy.sh logs
```

- [ ] Backend sin errores críticos
- [ ] Frontend sin errores críticos
- [ ] DB sin errores críticos

### 5.3 Probar desde el Servidor
```bash
curl http://localhost
curl http://localhost/api/docs
```

- [ ] Frontend responde (código HTML)
- [ ] API responde (documentación JSON)

### 5.4 Probar desde Tu PC
Abre en tu navegador:
- `http://IP_DEL_SERVIDOR`
- `http://IP_DEL_SERVIDOR/api/docs`

- [ ] La aplicación carga correctamente
- [ ] Puedo navegar sin errores
- [ ] Puedo iniciar sesión con el superusuario

---

## 🔒 PARTE 6: Seguridad (Firewall)

```bash
sudo ufw allow 22/tcp    # SSH - ¡IMPORTANTE!
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (si usas SSL)
sudo ufw enable
sudo ufw status
```

- [ ] Firewall configurado
- [ ] Puerto 22 abierto (SSH)
- [ ] Puerto 80 abierto (HTTP)
- [ ] Puerto 443 abierto si uso SSL (HTTPS)

---

## 🎯 PARTE 7: Pruebas Finales

### Funcionalidad Básica
- [ ] Puedo acceder a la página de login
- [ ] Puedo iniciar sesión con el superusuario
- [ ] Puedo navegar por el dashboard
- [ ] Puedo acceder a la documentación de API
- [ ] Puedo acceder al admin de Django (`/admin`)

### Pruebas Adicionales
- [ ] Crear un usuario de prueba
- [ ] Verificar que se guardan datos en la BD
- [ ] Subir un archivo de prueba (si aplica)
- [ ] Verificar que los archivos estáticos cargan (CSS, JS, imágenes)

---

## 📝 PARTE 8: Documentación Post-Despliegue

### Información a Guardar
Anota esta información en un lugar seguro:

**Servidor:**
- IP/Dominio: ________________
- Usuario SSH: ________________

**Base de Datos:**
- Nombre: `ipes6`
- Usuario: `ipes_user`
- Contraseña: ________________
- Contraseña Root: ________________

**Django:**
- SECRET_KEY: ________________ (¡Mantener secreto!)
- Superusuario: ________________
- Contraseña: ________________

**URLs:**
- Aplicación: http://________________
- API Docs: http://________________/api/docs
- Admin: http://________________/admin

- [ ] Información documentada y respaldada

---

## 🔄 PARTE 9: Comandos Útiles (Referencia Rápida)

```bash
# Ver estado
~/IPES6/scripts/deploy.sh status

# Ver logs
~/IPES6/scripts/deploy.sh logs backend
~/IPES6/scripts/deploy.sh logs frontend

# Reiniciar
~/IPES6/scripts/deploy.sh restart

# Detener
~/IPES6/scripts/deploy.sh stop

# Iniciar
~/IPES6/scripts/deploy.sh start

# Backup
~/IPES6/scripts/deploy.sh backup

# Actualizar aplicación
cd ~/IPES6
git pull
~/IPES6/scripts/deploy.sh update

# Shell de Django
~/IPES6/scripts/deploy.sh shell
```

- [ ] Comandos anotados y probados

---

## 🎓 PRÓXIMOS PASOS OPCIONALES

### Seguridad Avanzada
- [ ] Configurar SSL/HTTPS con Let's Encrypt
- [ ] Cambiar puerto SSH por defecto
- [ ] Configurar fail2ban
- [ ] Implementar backups automáticos

### Rendimiento
- [ ] Configurar CDN para archivos estáticos
- [ ] Optimizar configuración de Nginx
- [ ] Configurar cache de Django

### Monitoreo
- [ ] Instalar Portainer (Docker UI)
- [ ] Configurar logs centralizados
- [ ] Configurar alertas

### Dominio
- [ ] Comprar/configurar dominio
- [ ] Apuntar DNS al servidor
- [ ] Configurar SSL con el dominio

---

## ❌ Solución de Problemas

### La aplicación no carga
```bash
~/IPES6/scripts/deploy.sh logs frontend
~/IPES6/scripts/deploy.sh restart frontend
```

### Error de base de datos
```bash
~/IPES6/scripts/deploy.sh logs db
cat ~/IPES6/backend/.env | grep DB_
```

### Error de API
```bash
~/IPES6/scripts/deploy.sh logs backend
docker compose exec backend /app/.venv/bin/python manage.py check
```

### Los cambios no se reflejan
```bash
cd ~/IPES6/backend
docker compose down
docker compose up -d --build
```

---

## 🎉 ¡DESPLIEGUE COMPLETADO!

Si todos los checkboxes están marcados, ¡tu aplicación IPES6 está corriendo en producción!

**Recordatorios importantes:**
- Hacer backups regulares de la base de datos
- Mantener el sistema actualizado
- Revisar logs periódicamente
- Cambiar contraseñas cada cierto tiempo
- Documentar cualquier cambio en la configuración

**Recursos:**
- Guía completa: `.agent/workflows/deploy-ubuntu.md`
- Guía rápida: `DEPLOY_QUICK.md`
- Script de deploy: `scripts/deploy.sh`

---

**¡Felicitaciones! 🚀**
