# Caching de los endpoints de analytics

> Estado real del sistema, verificado el 04/09/2026. Si cambiás algo acá,
> actualizá este archivo: la versión anterior documentaba un mecanismo de
> invalidación por signals que no existe.

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

## Dos limitaciones que conviene conocer

### 1. Los datos recién cargados tardan en aparecer

Si alguien cierra una planilla o carga un acta, el dashboard puede seguir
mostrando el valor anterior **hasta 15 minutos**. No es un bug: es el TTL.
Si esa demora molesta, la salida es bajar los TTL de esta tabla, o implementar
invalidación real (ver abajo).

### 2. El cache está fragmentado entre workers

No hay `CACHES` configurado en settings, así que Django usa `LocMemCache`, que
vive **en la memoria de cada proceso**. Gunicorn corre con `--workers 3`, con lo
cual hay tres caches independientes: una misma consulta puede fallar el cache
tres veces antes de empezar a acertar. La eficacia real es aproximadamente un
tercio de la nominal.

## Medición real

Sobre la base de datos de prueba, `rendimiento_por_materia` (296 materias):

```
1ra llamada (miss): 166 ms
2da llamada (hit) :   1 ms
```

El cache funciona. El número depende del volumen de datos y del endpoint;
no extrapolar a los demás sin medir.

## Si se quiere mejorar

Ambas limitaciones se resuelven con lo mismo: mover el cache a Redis.

```python
# settings.py
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ["REDIS_URL"],   # redis://host:6379/1
        "KEY_PREFIX": "ipes6",
    }
}
```

Eso da un cache compartido por los tres workers (arregla el punto 2) y habilita
`delete_pattern("ipes6:analytics:*")`, con lo que se puede invalidar de verdad
desde señales de Django al guardar `ActaExamen`, `Regularidad`, etc.

**Advertencia sobre las señales:** hubo un intento previo de hacer esto que
además de invalidar el cache borraba filas de `MatriculaSnapshot` y
`AusentismoSnapshot` en cada `post_save`. Eso destruye la serie histórica que
esos modelos existen para acumular. Si se reimplementa, la señal debe tocar
únicamente el cache, nunca los snapshots.

## Cómo inspeccionar el cache

```bash
docker exec -it ipes6-backend-dev /app/.venv/bin/python /app/manage.py shell
```
```python
from django.core.cache import cache
cache.clear()          # vaciar todo
cache.get("<clave>")   # None = miss
```

Con `LocMemCache` no se puede listar claves ni borrar por patrón, y lo que
limpies afecta solo al worker que atendió esa consulta.
