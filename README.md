# 🎓 Sistema de Gestión Académica - IPES Paulo Freire

![Django](https://img.shields.io/badge/Backend-Django%205-092e20?style=for-the-badge&logo=django)
![React](https://img.shields.io/badge/Frontend-React%2018-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Build-Vite%208-646cff?style=for-the-badge&logo=vite)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ed?style=for-the-badge&logo=docker)

Sistema integral de última generación para la gestión de preinscripciones, cursadas, trayectorias académicas y trámites administrativos del **IPES Paulo Freire**.

---

## 🚀 Tecnologías Core

El proyecto utiliza un stack moderno y eficiente, optimizado para el rendimiento y la seguridad:

*   **Backend:** [Django 5](https://www.djangoproject.com/) + [Django Ninja](https://django-ninja.dev/) + MySQL.
    *   Gestión de paquetes ultra-rápida con `uv`.
    *   Arquitectura basada en API REST asíncrona.
*   **Frontend:** [React 18](https://reactjs.org/) + [Vite 8](https://vitejs.dev/) + TypeScript.
    *   Interfaz de usuario basada en [Material UI (MUI)](https://mui.com/).
    *   Gestión de estado y caché con TanStack Query.
*   **Infraestructura:** Despliegue automatizado mediante Docker y Nginx como Proxy Inverso.

## 🛡️ Seguridad y Estándares (Hardening)

El sistema ha sido sometido a un proceso de endurecimiento (hardening) completado en Marzo 2026:

-   **Zero Trust Architecture:** Implementación de autenticación declarativa `JWT` en todos los endpoints.
-   **Seguridad de Capas:** Políticas de CSP estrictas, eliminación de `unsafe-eval` y cookies con atributos `SameSite=Lax`.
-   **Calidad de Código:** Adhesión a estándares PEP 257 (Backend) y documentación TSDoc/JSDoc integral en el Frontend.
-   **Gestión de Secretos:** Configuración robusta basada exclusivamente en variables de entorno seguras.

## 🛠️ Configuración del Entorno de Desarrollo

### Requisitos Previos
- Docker Desktop (opcional para local)
- `uv` (para Python)
- Node.js 20+

### Backend (Django)
```bash
cd backend
cp .env.example .env  # Configurar variables locales
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

### Frontend (React/Vite)
```bash
cd frontend
npm ci
npm run dev
```

---

## 👨‍💻 Contribución y Desarrollo

Este repositorio sigue el flujo de trabajo de Git simplificado. Por favor, asegúrese de que sus cambios pasen los tests y sigan los estándares de documentación establecidos antes de solicitar un merge.

**Autor:** Oviedo Lucas Martín
**Institución:** IPES Paulo Freire
