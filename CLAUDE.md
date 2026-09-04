# IPES6 — Instrucciones para Claude Code

## ⚠️ Arquitectura: fuente de verdad de identidad (decisión P-1)

`Persona` es la ÚNICA fuente de verdad para `nombre`, `apellido` y `email`.

- `auth.User` guarda SOLO autenticación: `username` (= DNI), `password`, grupos/permisos.
- Los campos `User.first_name`, `User.last_name`, `User.email` están OBSOLETOS.
  Pueden contener datos históricos sucios — NO leerlos, NO escribirlos.
- Para leer identidad de un estudiante: `estudiante.nombre/.apellido/.email`
  (properties que leen de Persona). Para docentes/staff: vía `profile.persona`.
- La señal `sync_user_from_persona` sincroniza únicamente `username`.

Hay un test que vigila esto: `core/tests/test_fuente_de_verdad_persona.py`.
Si lo ves fallar, es porque alguien reactivó la escritura en auth.User. No lo
"arregles" llenando User — el fix es escribir en Persona.

## Cron pendiente de configurar en producción

El contenedor **no tiene cron instalado**, así que los cron van en el crontab del
host (`crontab -e` como el usuario del servidor) invocando el contenedor. El
contenedor se llama `ipes6-backend-dev`.

Patrón que usan los cron ya configurados:

```
<horario> docker exec -u root ipes6-backend-dev /app/.venv/bin/python /app/manage.py <comando> >> /home/admin486321/NuevoIPES/logs/backend/<comando>.log 2>&1
```

### Ya configurados

```
0 3 1 * *  purge_audit_logs                       # purga de AuditLog, día 1 de cada mes
30 23 * * * calcular_snapshots                     # snapshots diarios de matrícula/asistencia/ausentismo
0 6 1 6 *  verificar_residencias_condicionales     # 01/06 anual, ver detalle abajo
```

`calcular_snapshots` alimenta los gráficos de evolución del dashboard. Es
idempotente y acepta `--fecha AAAA-MM-DD` para rellenar días faltantes, y
`--profesorado-id N` para acotar el alcance.

### Residencias condicionales

**Qué hace:** El 01/06 a las 6am, verifica todas las inscripciones condicionales a
Residencia (Práctica IV / Talleres de Residencia) del ciclo lectivo en curso.
- Si el estudiante aprobó la materia pendiente en las mesas extraordinarias de mayo → marca la condición como RESUELTA.
- Si no aprobó → marca la condición como CAÍDA y pone la regularidad de Residencia en resguardo automáticamente.

**Verificación manual (sin esperar el 01/06):**
```bash
# --dry-run informa sin escribir; --ciclo AAAA procesa otro año lectivo
docker exec ipes6-backend-dev /app/.venv/bin/python /app/manage.py verificar_residencias_condicionales --dry-run
```

## Reactivar la inscripción a materias para estudiantes

Para volver a habilitar la inscripción a materias por autogestión de estudiantes, realiza las siguientes reversiones de código:

### 1. Backend
En [inscripciones_materias_api.py](file:///home/ipesrg/sistema-gestion/backend/apps/estudiantes/api/inscripciones_materias_api.py), elimina o comenta el bloque de validación de rol activo que se encuentra al principio de las funciones `inscripcion_materia` (línea ~121) y `aceptar_residencia_condicional` (línea ~775):
```python
    # Bloqueo temporal para estudiantes (solo habilitado para bedeles, secretaría y administradores)
    from core.permissions import get_user_roles
    if not (get_user_roles(request.user) & {"admin", "secretaria", "bedel"}):
        return 400, ApiResponse(
            ok=False, 
            message="..."
        )
```

### 2. Dashboard del Estudiante
En [Index.tsx](file:///home/ipesrg/sistema-gestion/frontend/src/pages/Estudiantes/Index.tsx):
- Elimina o comenta la sección en `sections` useMemo (línea ~320) que deshabilita la tarjeta:
```typescript
    if (isStudent && !isAdmin) {
      filteredSections = filteredSections.map(s => { ... })
    }
```
- Restablece el evento `onClick` de la grilla de próximos eventos (línea ~404) eliminando la condición de retorno prematuro.
- Restablece el valor de `cursor` (línea ~420) a `event.path ? "pointer" : "default"`.

### 3. Página de Cursadas y Botones de Acción
- En [useInscripcionMateria.ts](file:///home/ipesrg/sistema-gestion/frontend/src/pages/Estudiantes/inscripcion-materia/useInscripcionMateria.ts) (línea ~293), cambia:
```typescript
  const puedeInscribirse = ventanaActiva && puedeGestionar;
```
a:
```typescript
  const puedeInscribirse = ventanaActiva;
```
- En [InscripcionMateriaPage.tsx](file:///home/ipesrg/sistema-gestion/frontend/src/pages/Estudiantes/InscripcionMateriaPage.tsx) (línea ~146), remueve o comenta el componente `Alert` que muestra el cartel amarillo de advertencia:
```typescript
          {!puedeGestionar && (
            <Alert severity="warning" ...>
          )}
```

### 4. Recompilar
Una vez hechos los cambios, ejecuta en la carpeta `backend`:
```bash
docker compose up -d --build frontend
```

