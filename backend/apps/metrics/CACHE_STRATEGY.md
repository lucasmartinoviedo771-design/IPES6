# Caching de los endpoints de analytics

> Estado real del sistema, verificado el 04/09/2026. Si cambiás algo acá,
> actualizá este archivo.

## Qué hay hoy

Un decorador `@cache_endpoint(timeout, prefix)` en `cache_utils.py` que guarda
la respuesta del endpoint en el cache de Django. **La única forma de que un
valor cacheado se renueve es que expire su TTL.** No hay invalidación por
eventos.

### Endpoints cacheados

| Endpoint | Prefijo | TTL |
|---|---|---|
| `students/summary/` | `students_summary` | 10 min |
| `academic-performance/por-materia/` | `academic_performance_materia` | 15 min |
| `academic-performance/por-comisiones/` | `academic_performance_comisiones` | 15 min |
| `academic-performance/comparacion-cohortes/` | `academic_performance_cohortes` | 15 min |
| `ausentismo/consolidado/` | `ausentismo_consolidado` | 10 min |
| `mesas/dashboard/` | `mesas_dashboard` | 15 min |
| `tramites/dashboard/` | `tramites_dashboard` | 10 min |

Deliberadamente **sin cachear**: `students/at-risk/` (listado que se consulta
para intervenir sobre estudiantes concretos), `auditoria/dashboard/` (datos de
seguridad, se quieren frescos) y los `*/evolucion/` (leen snapshots, ya son
baratos).

La clave se arma con el prefijo más un hash MD5 de los parámetros, así que
filtrar por profesorado o por año genera entradas distintas.

## Dónde vive el cache

Servicio `redis` del compose (`ipes6-redis-dev`), configurado en settings a
partir de `REDIS_URL` (por defecto `redis://redis:6379/1`). Es cache
descartable: arranca con `--save "" --appendonly no`, sin persistencia, y con
`--maxmemory 256mb --maxmemory-policy allkeys-lru` para que no crezca sin techo.

**Si `REDIS_URL` no está definida, settings cae a `LocMemCache`** y el sistema
sigue funcionando, solo que cada worker de gunicorn tiene su propia copia y
hay menos aciertos. Es un modo degradado válido, no un error.

## La limitación que queda

Los datos recién cargados tardan en aparecer: si alguien cierra una planilla o
carga un acta, el dashboard puede seguir mostrando el valor anterior **hasta 15
minutos**. No es un bug, es el TTL. No hay invalidación por eventos.

Con Redis ya es posible implementarla (ver abajo); mientras no exista, la
palanca es bajar los TTL de la tabla de arriba.

## Medición real

Sobre la base de datos de prueba, `rendimiento_por_materia` (296 materias),
midiendo desde **dos procesos distintos** para comprobar que el cache se
comparte:

```
proceso A (miss, escribe): 121 ms
proceso B (otro PID, hit):   2 ms
```

El número depende del volumen de datos y del endpoint; no extrapolar a los
demás sin medir.

## Pendiente: invalidación por eventos

Redis soporta borrado por patrón, así que se puede invalidar al guardar
`ActaExamen`, `Regularidad`, etc. en lugar de esperar el TTL. Requiere
`django-redis` (el backend nativo de Django no expone `delete_pattern`) o
mantener un índice de claves propio.

**Advertencia sobre las señales:** hubo un intento previo de hacer esto que
además de invalidar el cache borraba filas de `MatriculaSnapshot` y
`AusentismoSnapshot` en cada `post_save`. Eso destruye la serie histórica que
esos modelos existen para acumular. Si se reimplementa, la señal debe tocar
únicamente el cache, nunca los snapshots.

## Cómo inspeccionar el cache

```bash
# listar claves y vaciar (db 1)
docker exec ipes6-redis-dev redis-cli -n 1 --scan --pattern "ipes6:*"
docker exec ipes6-redis-dev redis-cli -n 1 dbsize
docker exec ipes6-redis-dev redis-cli -n 1 flushdb
```

Las claves quedan como `ipes6:1:analytics:<prefijo>:<hash>` — Django intercala
su version del cache entre el KEY_PREFIX y la clave.
