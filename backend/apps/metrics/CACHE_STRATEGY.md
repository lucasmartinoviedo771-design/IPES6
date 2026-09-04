# Estrategia de Caching - Analytics Dashboard

## Objetivo

Reducir carga de base de datos y mejorar performance del dashboard mediante caching inteligente con invalidación automática.

## Configuración Base

### Development (Django LocMemCache - default)

```python
# settings.py (Django default)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}
```

✅ Bueno para desarrollo local  
❌ No persistente, no compartido entre procesos

### Production (Redis - RECOMENDADO)

```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PARSER_KWARGS': {'encoding': 'utf8'},
            'POOL_KWARGS': {'max_connections': 50},
        },
        'KEY_PREFIX': 'ipes6',
        'TIMEOUT': 300,  # Default 5 minutos
    }
}
```

✅ Persistente, compartido entre procesos  
✅ Soporte para key patterns (invalidación bulk)  
✅ Mejor performance en alta concurrencia

### Installation

```bash
pip install django-redis
# Production
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Estrategia de Caching por Endpoint

### 1. Summary de Estudiantes (CRÍTICO)

| Parámetro | Timeout | Razón |
|-----------|---------|-------|
| Dependencia | Regularidad, RiesgoAcademicoEstudiante | Alta frecuencia de cálculos |
| Timeout | **10 minutos (600s)** | Los datos no cambian en tiempo real |
| Invalidación | POST Regularidad, RiesgoAcademicoEstudiante | Al cambiar notas o riesgo |

**Flujo:**
```
GET /students/summary/ 
  ├─ Cache HIT → 200ms ✓
  └─ Cache MISS → 2000ms → Guardar 10 min
```

### 2. Rendimiento Académico (PESADO)

| Parámetro | Timeout | Razón |
|-----------|---------|-------|
| Dependencia | ActaExamen (queries N+1) | Múltiples joins + agregaciones |
| Timeout | **15 minutos (900s)** | Datos menos volátiles |
| Invalidación | POST ActaExamen, Regularidad | Cuando se cargan notas/actas |

### 3. Ausentismo Consolidado (MODERADO)

| Parámetro | Timeout | Razón |
|-----------|---------|-------|
| Dependencia | AusentismoSnapshot | Datos pre-agregados de Fase A |
| Timeout | **10 minutos (600s)** | Snapshots se recalculan diariamente |
| Invalidación | POST AusentismoSnapshot | Cuando se recalculan snapshots |

### 4. Auditoría Dashboard (LIVIANO)

| Parámetro | Timeout | Razón |
|-----------|---------|-------|
| Dependencia | AuditLog, SystemLog | Listado + agregaciones simples |
| Timeout | **5 minutos (300s)** | Requiere datos más frescos |
| Invalidación | No crítico | Se renueva constantemente |

---

## Invalidación Automática (Signals)

Los signals en `signals.py` invalidan cache al detectar cambios:

```python
# Cuando se guarda EstudianteCarrera:
MatriculaSnapshot.delete()  # Limpiar snapshots stale
cache.delete("*students_summary*")

# Cuando se guarda ActaExamen:
cache.delete("*academic_performance*")

# Cuando se guarda AsistenciaEstudiante:
AusentismoSnapshot.delete()
cache.delete("*ausentismo*")
```

---

## Monitoreo y Debugging

### Ver cache hits/misses

```python
# Shell Django
from django.core.cache import cache
cache.get("analytics:students_summary:abc12345")  # None = miss
cache.set("test", "value", 60)
cache.get("test")  # "value" = hit

# Con Redis CLI
redis-cli
> KEYS "ipes6:analytics:*"
> TTL "ipes6:analytics:students_summary:abc12345"
```

### Limpiar cache (si es necesario)

```bash
# Desde management command (crear si no existe)
python manage.py shell
>>> from django.core.cache import cache
>>> cache.clear()

# Con Redis
redis-cli FLUSHDB

# Invalidar patrón específico
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', ARGV[1])))" 0 "ipes6:analytics:*"
```

---

## Benchmarks Esperados

### Sin Cache
```
GET /analytics/students/summary/ → 2000-3000ms (con muchos estudiantes)
GET /analytics/academic-performance/por-materia/ → 3000-5000ms
```

### Con Cache (Hit)
```
GET /analytics/students/summary/ → 50-100ms ✓
GET /analytics/academic-performance/por-materia/ → 50-100ms ✓
```

**Mejora esperada: 20-50x más rápido**

---

## Configuración por Entorno

### Development
```bash
# Django locmem (default)
# Ya configurado en settings.py
# Sin Redis necesario
```

### Staging/Testing
```bash
# Redis en Docker
docker run -d -p 6379:6379 redis:7-alpine
# O usar Redis Cloud (free tier)
CACHES['default']['LOCATION'] = 'redis://user:pass@redis-host:6379/1'
```

### Production
```bash
# Redis managed (AWS ElastiCache, Azure Cache for Redis, etc)
CACHES['default']['LOCATION'] = os.environ['REDIS_URL']
# Con high availability (Sentinel, Cluster)
# Monitorear con NewRelic, DataDog, etc
```

---

## Checklist de Activación

- [ ] Redis instalado/configurado en settings.py
- [ ] Signals registrados (AppConfig.ready() llamado)
- [ ] Decoradores @cache_endpoint aplicados
- [ ] TTL values ajustados según carga
- [ ] Monitoring de hits/misses configurado
- [ ] Fallback si cache no disponible (Django graceful)

---

## Mejoras Futuras

1. **Cache Warming**: Precalcular snapshots/summary al inicio del día
2. **Cache Invalidation Smart**: Usar eventos en lugar de signals
3. **Query Optimization**: Índices en ActaExamen, PlanillaRegularidad
4. **Varnish/CDN**: Para endpoints públicos (si aplica)
5. **Compression**: Comprimir respuestas grandes (gzip)

