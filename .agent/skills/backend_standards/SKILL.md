---
name: backend_standards
description: Estándares de desarrollo, convenciones y flujos obligatorios para el backend SIGED IPES Paulo Freire (Django 5 + Ninja).
---

# Skill: Estándares de Desarrollo Backend SIGED

## 1. Objetivo
Esta skill define el contrato técnico obligatorio para la generación y mantenimiento de código en el backend del sistema SIGED (IPES Paulo Freire). Su propósito es:
- **Automatizar** la creación de endpoints seguros y consistentes.
- **Estandarizar** la nomenclatura y estructura de archivos para facilitar el mantenimiento.
- **Prevenir errores recurrentes** (N+1 queries, PydanticUserError, inconsistencias de datos).
- **Garantizar la lógica de negocio académica** correcta (asistencias, preinscripciones, regularidades).

## 2. Stack Tecnológico
El proyecto utiliza estrictamente las siguientes tecnologías. No introducir librerías fuera de `requirements.txt` sin autorización.

- **Framework Web**: Django 5.x
- **API**: Django Ninja (basado en Pydantic v2)
- **Base de Datos**: MySQL (driver `pymysql`)
- **Autenticación**: JWT (SimpleJWT) en cookies `HTTP-only` + Protección CSRF.
- **Gestión de Paquetes**: `uv`.
- **Contenedores**: Docker & Docker Compose.
- **Reportes**: WeasyPrint / ReportLab.

## 3. Reglas de Estilo y Convenciones

### Naming
- **Clases (Modelos, Schemas, Servicios)**: `PascalCase`.
  - Bien: `AsistenciaEstudiante`, `PreinscripcionIn`.
  - Mal: `asistencia_estudiante`, `Preinscripcion_in`.
- **Variables y Funciones**: `snake_case`.
  - Bien: `obtener_por_dni`, `calcular_porcentaje`.
- **Endpoints (URL path)**: `kebab-case`.
  - Bien: `/asistencias-estudiantes`, `/reportes/pdf`.
- **Campos de API (JSON)**: `snake_case` (consistente con Pydantic y Python).

### Organización de Módulos (Carpeta `apps/`)
Cada dominio debe ser una "app" Django en `backend/apps/` (ej: `apps/asistencia`, `apps/estudiantes`). Estructura interna requerida:

```text
apps/nombre_app/
├── models.py       # Definición de datos (DB)
├── api.py          # Routers y Endpoints (Controller)
├── schemas.py      # Contratos Pydantic (In/Out)
├── services.py     # Lógica de negocio pura (Service Layer)
├── urls.py         # (Opcional) Rutas clásicas si existen
└── admin.py        # Configuración Django Admin
```

## 4. Estándar de Respuestas de la API

### Respuesta Exitosa Generica (`ApiResponse`)
Para operaciones que no retornan un objeto de modelo directo, usar siempre `ApiResponse`.

```python
from apps.common.api_schemas import ApiResponse

return ApiResponse(
    ok=True,
    message="Operación exitosa",
    data={"id": 123} # Opcional
)
```

### Respuesta de Error
Usar excepciones HTTP nativas de Ninja.

```python
from ninja.errors import HttpError

raise HttpError(404, "El recurso solicitado no existe.")
raise HttpError(400, "Validación de negocio fallida: el alumno ya está inscripto.")
```

## 5. Flujo Obligatorio para Crear Nuevo Endpoint

Para añadir una nueva funcionalidad, seguir estrictamente este orden:

1.  **Modelo (`models.py`)**: Definir o verificar la estructura de datos. Asegurar `__str__` y `Meta` (db_table, verbose_name).
2.  **Schema (`schemas.py`)**:
    *   Crear `SchemaIn` para validación de entrada (excluir campos auto-generados).
    *   Crear `SchemaOut` para serialización de respuesta.
    *   *Tip*: Usar `ModelSchema` de Ninja solo si los modelos son simples. Para lógica compleja, definir schemas explícitos.
3.  **Service (`services.py`)**:
    *   Implementar la lógica pura.
    *   **NO** acceder a `request` aquí. Recibir argumentos tipados.
    *   Manejar transacciones (`@transaction.atomic`) aquí.
4.  **Router (`api.py`)**:
    *   Decorar con `@router.method`.
    *   Gestionar autenticación (`auth=JWTAuth()`).
    *   Gestionar permisos (`check_roles`, `ensure_profesorado_access`).
    *   Llamar al servicio y capturar excepciones.

## 6. Lógica Específica del Dominio Académico

### Nomenclatura Clave
- **Alumno** vs **Estudiante**: Usar `alumno` para la relación FK en modelos (ej: `Preinscripcion.alumno`), pero el concepto de negocio general es **Estudiante**. En endpoints/schemas, preferir `estudiante` como nombre de campo público si no hay conflicto.
- **Profesorado** vs **Carrera**: Sinónimos en el sistema, pero el modelo es `Profesorado`.

### Asistencias
- **Clases Programadas**: Unidad base de asistencia. Debe tener fecha, hora inicio/fin y materia.
- **Snapshot**: Al tomar asistencia, se crea un `CursoEstudianteSnapshot` si no existe, vinculando al estudiante con el curso en ese momento.
- **Estados**: Presente, Ausente, Ausente Justificada, Tarde.
- **Bloqueo**: No se puede tomar asistencia si `planilla_cerrada` es True o si hay un feriado/asueto en el calendario académico para esa fecha.

### Justificaciones
- **Aplicación Automática**: Al aprobar una justificación (`Justificacion`), el sistema debe buscar las `AsistenciaEstudiante` marcadas como "Ausente" en el rango de fechas y cambiarlas a "Ausente Justificada".

## 7. Prevención de Errores y Best Practices

### ⚠️ Pydantic y Ninja
- **Error**: `pydantic.errors.PydanticUserError: Cannot use ... as a field name`.
  - **Causa**: Usar nombres reservados o definir clases dinámicas incorrectamente.
  - **Solución**: Asegurar que los Schemas hereden de `Schema` (ninja) o `BaseModel` (pydantic).
- **Error**: `Field name ... shadows a QueryParams...`.
  - **Solución**: Si un endpoint recibe un Schema por `POST/PUT`, usar `body: MiSchema = Body(...)` explícitamente.

### ⚠️ Base de Datos (ORM)
- **N+1 Queries**: Prohibido iterar relaciones en bucles sin `select_related` (FK) o `prefetch_related` (M2M).
  - *Mal*: `[a.user.first_name for a in alumnos]`
  - *Bien*: `alumnos = Alumno.objects.select_related('user').all(); ...`
- **IntegrityError**: Siempre envolver creaciones/updates críticos en `try/except IntegrityError` y devolver 409 o 400 según corresponda.

### Mutabilidad
- **Defaults**: Nunca usar objetos mutables como defaults en funciones.
  - *Mal*: `def funcion(lista=[])`
  - *Bien*: `def funcion(lista=None): if lista is None: lista = []`

## 8. Comandos Útiles de Docker

Ejecutar desde `/root/.gemini/antigravity/scratch` o directorio raíz:

- **Reiniciar Backend (rápido)**:
  `docker restart backend-backend-1`
- **Ver Logs Backend (últimas 50 líneas)**:
  `docker logs backend-backend-1 --tail 50 -f`
- **Reconstruir Backend (cambios en requirements/Dockerfile)**:
  `docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml build backend && docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml up -d backend`
- **Reiniciar Base de Datos**:
  `docker restart backend-db-1`

## 9. Checklist Final de Validación

Antes de dar por finalizada una tarea de código:
1.  [ ] **Linting**: ¿El código cumple PEP8? (Naming, imports ordenados).
2.  [ ] **Schemas**: ¿Los campos de entrada/salida coinciden con el frontend?
3.  [ ] **Seguridad**: ¿El endpoint tiene `auth=JWTAuth()`? ¿Se validan roles?
4.  [ ] **Performance**: ¿Se usa `select_related` en consultas FK?
5.  [ ] **Errores**: ¿Se maneja 404 si el objeto no existe?
6.  [ ] **Tests**: ¿El endpoint responde correctamente en `curl` o Swagger?
7.  [ ] **Docker**: ¿El contenedor sigue levantado (`docker ps`) tras los cambios?
