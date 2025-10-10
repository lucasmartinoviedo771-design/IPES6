# Proyecto IPES6 - Sistema de Preinscripción

Sistema de preinscripción para el IPES6, dividido en un backend de Django y un frontend de React.

## Tecnologías Utilizadas

-   **Backend**:
    -   Python
    -   Django + Django Ninja (para la API REST)
    -   UV (para gestión de dependencias y entorno virtual)
    -   MySQL (Base de datos)

-   **Frontend**:
    -   React + Vite
    -   TypeScript
    -   Material-UI (MUI) para componentes de UI
    -   React Hook Form + Zod (para gestión y validación de formularios)
    -   TanStack Query (para gestión de estado del servidor)
    -   Day.js (para manejo de fechas)
    -   React Router (para enrutamiento)

---

## Requisitos Previos

-   **Node.js** (v18+ recomendado)
-   **Python** (v3.11+ recomendado)
-   **UV**: Instalador de paquetes y gestor de entorno virtual de Python. Si no lo tienes, instálalo con `pip install uv`.
-   **MySQL**: Una instancia de base deatos MySQL en ejecución.

---

## Configuración y Ejecución

### 1. Backend (Django)

1.  **Navega a la carpeta del backend:**
    ```bash
    cd backend
    ```

2.  **Configura el entorno virtual e instala dependencias:**
    El siguiente comando creará un entorno virtual y luego instalará las dependencias de `requirements.txt`.
    ```bash
    uv pip sync requirements.txt
    ```

3.  **Configura las variables de entorno:**
    Crea un archivo `.env` en la raíz de la carpeta `backend/`. Puedes usar el siguiente template (ajusta los valores de tu base de datos):
    ```env
    SECRET_KEY=tu-clave-secreta-aqui
    DEBUG=True

    # Configuración de la Base de Datos
    DB_NAME=ipes_db
    DB_USER=ipes_user
    DB_PASSWORD=tu_password_de_db
    DB_HOST=127.0.0.1
    DB_PORT=3306
    ```

4.  **Aplica las migraciones:**
    Esto creará las tablas necesarias en tu base de datos.
    ```bash
    uv run python manage.py migrate
    ```

5.  **Crea un Superusuario (Opcional):**
    Para acceder al panel de administración de Django, necesitarás un superusuario.
    ```bash
    uv run python manage.py createsuperuser
    ```
    Sigue las instrucciones para crear tu usuario.

6.  **Ejecuta el servidor de desarrollo:**
    ```bash
    uv run python manage.py runserver
    ```
    El backend estará disponible en `http://127.0.0.1:8000`.

### 2. Frontend (React)

1.  **Navega a la carpeta del frontend:**
    ```bash
    cd frontend
    ```

2.  **Instala las dependencias de Node.js:**
    ```bash
    npm install
    ```

3.  **Configura las variables de entorno:**
    Crea un archivo `.env.local` en la raíz de la carpeta `frontend/` con la siguiente variable, apuntando a tu backend:
    ```env
    VITE_API_BASE=http://127.0.0.1:8000/api
    ```

4.  **Ejecuta el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    La aplicación frontend estará disponible en `http://localhost:5173`.

---

## Características Implementadas

-   **Formulario de Preinscripción Desacoplado**: El registro de postulantes es un proceso autocontenido que no requiere la creación de usuarios en el sistema, simplificando el flujo inicial.
-   **Gestión de Carreras (Profesorados)**: API completo (CRUD) para crear, listar, actualizar y activar/desactivar las carreras ofrecidas.
-   **Gestión de Planes de Estudio**: API completo (CRUD) para crear, listar, actualizar y desactivar/reactivar planes de estudio.
-   **Asociación Profesorado-Plan**: Gestión de la relación entre profesorados y planes, incluyendo la marcación del plan vigente para nuevas inscripciones.
-   **Gestión de Archivos de Preinscripción**: Endpoints para subir, listar, borrar y descargar documentos asociados a una preinscripción.
-   **Autenticación JWT**: Endpoints de `login` y `perfil` de usuario protegidos con JSON Web Tokens para futuras áreas seguras.
-   **Validación Robusta**: Validación de datos en tiempo real y por paso, utilizando Zod.
-   **Máscaras de Entrada**: Campos de DNI, CUIL y teléfono con máscaras para facilitar la carga de datos.
-   **Selector de Fechas**: Implementación de un `DatePicker` con localización en español.
-   **Autoguardado de Borrador**: El progreso del formulario se guarda automáticamente en `localStorage` para evitar la pérdida de datos.
-   **API RESTful**: Endpoints claros y definidos con Django Ninja para gestionar preinscripciones y documentos.
-   **Generación de PDF**: Endpoint para generar un comprobante de preinscripción en formato PDF.

---

## Autores

-   Oviedo Lucas