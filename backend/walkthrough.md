# Walkthrough: Mejoras y Dockerización IPES6

Se han realizado tareas de limpieza, optimización y estandarización del entorno de desarrollo/producción mediante Docker.

## Cambios Realizados

### 1. Limpieza de Código
- **Eliminado**: `frontend/src/api/axios.ts` (redundante, se usa `client.ts`).
- **Validación**: Se confirmaron las versiones de dependencias en `pyproject.toml` y `package.json`.

### 2. Dockerización
Se crearon los archivos necesarios para levantar todo el stack (Backend + Frontend + Base de Datos) con un solo comando.

- **Backend**: `backend/Dockerfile` (Python 3.11 slim + uv + gunicorn).
- **Frontend**: `frontend/Dockerfile` (Node build -> Nginx serve).
- **Orquestación**: `backend/docker-compose.yml` (define servicios `backend`, `frontend`, `db`).

### 3. Configuraciones de Producción
- **Logging**: Se mejoró `settings.py` para tener logs estructurados en consola (ideal para Docker/AWS/Azure).
- **Vite Build**: Se optimizó `vite.config.ts` para dividir el código en chunks (`react-vendor`, `mui-vendor`, etc.), mejorando la carga inicial.
- **Documentación**: Se creó `backend/ENV_TEMPLATE.md` con la lista de variables de entorno requeridas.

## Cómo correr el proyecto con Docker

Desde la carpeta `backend/`:

1.  **Construir y levantar servicios**:
    ```bash
    docker-compose up --build
    ```
    *(Esto puede tardar unos minutos la primera vez mientras descarga imágenes y compila)*.

2.  **Acceder a la aplicación**:
    - Frontend: [http://localhost](http://localhost) (Puerto 80)
    - Backend API: [http://localhost:8000/api](http://localhost:8000/api)
    - Admin Django: [http://localhost:8000/admin](http://localhost:8000/admin)

3.  **Detener servicios**:
    ```bash
    docker-compose down
    ```

## Verificación
- [x] `docker-compose build` debería ejecutarse sin errores.
- [x] Los logs del backend deberían mostrar formato estructurado.
- [x] El build del frontend debería generar múltiples archivos `.js` en `dist/assets` (vendor splitting).
