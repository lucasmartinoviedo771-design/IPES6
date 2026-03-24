# Sistema de Gestión Académica - IPES Paulo Freire

Sistema integral para preinscripción, cursadas, notas y trámites administrativos del IPES Paulo Freire. Consta de un backend Django expuesto vía API Ninja y un frontend React/Vite con UI MUI.

## Arquitectura
- **Backend:** Django 5 + Django Ninja + MySQL. Gestión de dependencias con `uv`.
- **Frontend:** React 18 + Vite 8 + TypeScript + MUI. Sincronización con TanStack Query.
- **Infraestructura:** Despliegue en contenedores Docker (Nginx como proxy inverso).

## Documentación Consolidada
Para facilitar la lectura y evitar la dispersión de archivos, la documentación se ha unificado en:

- 📂 [**PROYECTO.md**](docs/PROYECTO.md): Fundamentación, alcances y cronograma del sistema.
- 🛠️ [**DOCUMENTACION_TECNICA.md**](docs/DOCUMENTACION_TECNICA.md): Guía de instalación (Docker), arquitectura, matriz de roles y tareas pendientes.
- 📜 [**REGLAS_NEGOCIO.md**](docs/REGLAS_NEGOCIO.md): Lógica de preinscripción, correlatividades y validaciones del sistema.
- 📘 [**MANUAL_USUARIO.md**](docs/MANUAL_USUARIO.md): Guías de uso para Alumnos, Bedeles, Secretaría y Administradores.
- 🛡️ [**security_audit_ipes6.md**](docs/security_audit_ipes6.md): Informe de auditoría de seguridad y mitigaciones (Marzo 2026).

## Seguridad y Hardening (Actualización Marzo 2026)
Tras una auditoría exhaustiva de ciberseguridad, se han implementado las siguientes mejoras:
- **Protección de Diagnóstico:** El profiler `Silk` ahora requiere autenticación obligatoria y permisos de superusuario.
- **Autenticación Zero Trust:** Implementación de `JWTAuth` declarativo global en toda la API de Django Ninja.
- **Gestión de Secretos:** Eliminación de fallbacks de claves por defecto; el sistema ahora exige variables de entorno seguras para arrancar.
- **Políticas de Navegador:** Endurecimiento de la CSP (eliminación de `unsafe-eval`) y configuración de cookies `SameSite=Lax`.
- **Estandarización Documental (Marzo 2026):** Refactorización integral de todo el código fuente aplicando estándares PEP 257 (Backend) y TSDoc/JSDoc (Frontend). Se eliminaron comentarios redundantes y se documentó la lógica de negocio compleja (SLA, Trayectorias, Validaciones).

## Puesta en marcha rápida

### Backend (Django)
```bash
cd backend
cp Original.env .env  # Ajusta credenciales
uv pip sync requirements.txt
uv run python manage.py migrate
uv run python manage.py runserver
```

### Frontend (React/Vite)
```bash
cd frontend
npm ci
npm run dev
```

## Despliegue en Producción (Ubuntu Server)
Para desplegar en un servidor Ubuntu con Docker:
```bash
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh setup
./scripts/deploy.sh update
```
*Guía detallada en [DOCUMENTACION_TECNICA.md](docs/DOCUMENTACION_TECNICA.md).*

---
**Autor:** Oviedo Lucas Martín
