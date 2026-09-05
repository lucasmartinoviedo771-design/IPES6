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

## Invalidación por eventos

Además del TTL, el caché se borra en cuanto cambian los datos de origen. Las
señales viven en `cache_invalidation.py`, que mapea cada modelo a los prefijos
que deja obsoletos: guardar una `Regularidad` borra `students_summary` y los
`academic_performance_*`, guardar un `ActaExamen` borra además `mesas_dashboard`,
y así.

Esto es lo que obliga a usar `django_redis.cache.RedisCache` y no el backend
nativo de Django: la invalidación se apoya en `delete_pattern()`, que la API
genérica de caché de Django no expone (tiene que funcionar igual con Memcached
o con caché en base de datos, donde el borrado por patrón no es eficiente).

Si el backend no soporta `delete_pattern` —el modo degradado sin Redis—
`invalidar()` no hace nada y el caché vuelve a depender solo del TTL. Es una
desmejora, no un error. Lo mismo si Redis se cae: se registra un warning y el
guardado del usuario sigue adelante; como mucho se sirve un dato viejo hasta
que venza el TTL.

**No borres snapshots desde estas señales.** Una versión previa lo hacía, y con
eso destruía la serie histórica que `MatriculaSnapshot` y `AusentismoSnapshot`
existen para acumular: son el registro de cómo estaba el sistema cada día y no
se pueden recalcular hacia atrás. Hay un test que lo vigila
(`test_la_invalidacion_no_borra_snapshots`).

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

## Tests

Los tests corren contra el mismo Redis que la aplicación, así que el caché está
aislado a propósito en `core/tests/conftest.py`:

- por defecto, `DummyCache` (fixture autouse): cada lectura es un miss, que es
  lo que se quiere cuando el caché no es el objeto de la prueba;
- `cache_real` para probar comportamiento de caché sin depender de un servicio
  externo (LocMemCache, aislado por test);
- `cache_redis` para lo que necesita `delete_pattern` de verdad, como la
  invalidación: Redis real sobre la base 15, y se saltea el test si no hay Redis.

Sin ese aislamiento los tests no son reproducibles. El caso concreto: el test
que verifica que un usuario sin permisos no puede leer métricas pasaba con Redis
vacío y fallaba con Redis poblado.

> **Dos trampas con `conftest.py`.** Las dos se manifiestan igual —las fixtures
> figuran como "not found" aunque el archivo esté ahí— y por eso cuestan de
> diagnosticar.
>
> 1. *Volúmenes.* El `docker-compose.yml` monta solo `./apps`, `./core`,
>    `./config` y `./manage.py`. Un `conftest.py` en la raíz del backend existe
>    en el host pero **no dentro del contenedor**. Vale para cualquier archivo
>    nuevo fuera de esos cuatro directorios.
> 2. *`.gitignore`.* La regla era `conftest*.py` sin barra inicial, así que
>    ignoraba los conftest de cualquier nivel, no solo los locales de la raíz
>    que se querían excluir. El archivo funcionaba en DEV y **no llegaba al
>    repo**: el CI clonaba sin él y fallaba. Corregido a `/conftest*.py`, igual
>    que la línea `/test_*.py` de al lado. Si agregás un `conftest.py` nuevo,
>    confirmá con `git ls-files` que quedó trackeado.

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
