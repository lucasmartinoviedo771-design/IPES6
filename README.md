# Sistema de Gestión Académica - IPES Paulo Freire

Este proyecto es un sistema integral de gestión académica para el IPES Paulo Freire, diseñado para manejar desde la preinscripción de nuevos alumnos hasta la gestión de cursadas, notas y trámites administrativos.

El sistema está construido con una arquitectura moderna de dos componentes principales: un backend robusto hecho en Django y un frontend interactivo desarrollado con React.

---

## Tecnologías Utilizadas

-   **Backend**:
    -   Python 3.11+
    -   Django 5+
    -   Django Ninja (para una API REST de alto rendimiento)
    -   UV (como gestor de entorno virtual y paquetes)
    -   MySQL (Base de datos)

-   **Frontend**:
    -   React 18+ (con Vite)
    -   TypeScript
    -   Material-UI (MUI) para la interfaz de usuario
    -   React Hook Form & Zod para formularios y validación
    -   TanStack Query para la gestión de datos y cache
    -   React Router para la navegación en la aplicación

---

## Instalación y Puesta en Marcha

Sigue estos pasos para configurar y ejecutar el proyecto en un entorno de desarrollo local.

### Requisitos Previos

-   **Node.js**: Versión 18 o superior.
-   **Python**: Versión 3.11 o superior.
-   **UV**: Un instalador de paquetes de Python. Si no lo tienes, instálalo globalmente con `pip install uv`.
-   **Git**: Sistema de control de versiones.
-   **MySQL**: Una base de datos MySQL activa.

### 1. Backend (Servidor Django)

1.  **Clona el repositorio y navega a la carpeta del backend:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd IPES6/backend
    ```

2.  **Crea el entorno virtual e instala las dependencias:**
    Este comando usa `uv` para crear un entorno virtual y sincronizarlo con las dependencias del proyecto.
    ```bash
    uv pip sync requirements.txt
    ```

3.  **Configura la base de datos:**
    Crea un archivo `.env` en la carpeta `backend/` y configúralo con tus credenciales de MySQL. Puedes usar este template:
    ```env
    SECRET_KEY=django-insecure-una-clave-muy-secreta
    DEBUG=True
    DB_NAME=ipes_db
    DB_USER=root
    DB_PASSWORD=tu_contraseña
    DB_HOST=127.0.0.1
    DB_PORT=3306
    ```

4.  **Aplica las migraciones de la base de datos:**
    ```bash
    uv run python manage.py migrate
    ```

5.  **Verifica las variables de entorno críticas (opcional pero recomendado):**
    ```bash
    uv run python manage.py check_env
    ```

6.  **Crea un superusuario (opcional):**
    Para acceder al panel de administrador de Django (`/admin`):
    ```bash
    uv run python manage.py createsuperuser
    ```

6.  **Inicia el servidor del backend:**
    ```bash
    uv run python manage.py runserver
    ```
    El servidor estará activo en `http://127.0.0.1:8000`.

### 2. Frontend (Aplicación React)

1.  **Abre una nueva terminal y navega a la carpeta del frontend:**
    ```bash
    cd IPES6/frontend
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Configura la variable de entorno:**
    Crea un archivo `.env.local` en `frontend/` para indicarle a la aplicación dónde encontrar la API del backend.
    ```env
    VITE_API_BASE=http://localhost:8000/api
    ```

4.  **Inicia el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:5173`.

---

## Mantenimiento Reciente

-   **Actualización de Dependencias del Backend**: Se ha regenerado el archivo `requirements.txt` para asegurar que todas las dependencias del proyecto estén actualizadas y consistentes.
-   **Corrección de Codificación de Caracteres**: Se solucionaron errores de codificación (UTF-8) en múltiples componentes del frontend, asegurando la correcta visualización de acentos y caracteres especiales en toda la aplicación.
-   **Actualización de Dependencias**: Se actualizó el archivo `requirements.txt` para reflejar el estado actual de las dependencias del backend.
-   **Mejoras de Seguridad en Autenticación**: Se migró el almacenamiento del token JWT a cookies HTTP-only, se implementó protección CSRF en el frontend y se endurecieron las configuraciones de seguridad del backend, mejorando la resiliencia contra ataques XSS.

---

## Autores

-   Oviedo Lucas