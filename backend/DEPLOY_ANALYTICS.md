# Despliegue del dashboard de analytics

Guía para pasar a producción los cambios del panel de analítica institucional.
**No alcanza con `git pull`**: hay una migración, dos rebuilds, un servicio nuevo
y dos tareas programadas.

Los comandos usan los nombres de contenedor de DEV (`ipes6-backend-dev`,
`ipes6-frontend-dev`, `ipes6-redis-dev`). Si en producción se llaman distinto,
adaptarlos.

---

## Antes de empezar

- [ ] Backup completo de la base de datos.
- [ ] Anotar el commit actual, para poder volver: `git rev-parse --short HEAD`

---

## Lo que cambia en infraestructura

Cuatro archivos versionados modifican cómo corre el sistema, no solo qué hace:

| Archivo | Qué cambia |
|---|---|
| `docker-compose.yml` | Servicio `redis` nuevo, y el backend pasa a depender de él |
| `pyproject.toml` / `uv.lock` | Dependencias nuevas: `redis`, `django-redis` |
| `config/settings.py` | Bloque `CACHES`, que lee `REDIS_URL` |

### ⚠️ El backend no arranca si Redis no está levantado

El compose trae:

```yaml
depends_on:
  redis:
    condition: service_healthy
```

Con `docker compose up -d` (sin nombrar servicio) Redis se levanta solo y no hay
problema. **Pero si el script de despliegue hace `up -d backend` puntual**,
revisalo: Compose deberia levantar la dependencia igual, pero conviene
verificarlo antes y no durante el despliegue.

Si se prefiere **no usar Redis todavía**, ver [Alternativa sin Redis](#alternativa-sin-redis).

### Dos detalles del servicio Redis

- Publica el puerto **6380** en el host (`127.0.0.1:6380:6379`). Verificar que
  esté libre en producción: `ss -ltnp | grep 6380`
- El `container_name` es `ipes6-redis-dev` — dice "dev" aunque corra en
  producción, igual que el resto de los contenedores del proyecto.

---

## Pasos

### 1. Traer el código

```bash
cd <ruta del repo>
git pull
```

### 2. Levantar Redis y reconstruir el backend

```bash
cd backend
docker compose up -d --build redis backend
```

Verificar:

```bash
docker ps --filter name=redis --format '{{.Names}}\t{{.Status}}'   # debe decir (healthy)
docker exec ipes6-backend-dev bash -c "cd /app && .venv/bin/python manage.py check"
```

### 3. Aplicar la migración

Crea tres tablas nuevas para los snapshots. **No modifica ninguna tabla
existente**, así que es de bajo riesgo.

```bash
docker exec ipes6-backend-dev bash -c "cd /app && .venv/bin/python manage.py migrate metrics"
```

Verificar:

```bash
docker exec ipes6-backend-dev bash -c "cd /app && .venv/bin/python manage.py showmigrations metrics"
# esperado: [X] 0001_initial
```

Sin este paso, las pestañas de Ausentismo y los gráficos de evolución fallan.

### 4. Reconstruir el frontend

**Sin esto no se ve ningún cambio**: el navegador sigue sirviendo el bundle
anterior por más que el código esté actualizado.

```bash
docker compose up -d --build frontend
```

Verificar que las pestañas nuevas estén en el bundle publicado:

```bash
docker exec ipes6-frontend-dev sh -c 'grep -l "Rendimiento Académico" /usr/share/nginx/html/assets/*.js'
```

### 5. Generar el primer snapshot

Los gráficos de evolución quedan vacíos hasta que exista al menos un snapshot.

```bash
docker exec -u root ipes6-backend-dev /app/.venv/bin/python /app/manage.py calcular_snapshots
```

Es idempotente. Para rellenar días hacia atrás: `--fecha AAAA-MM-DD`.

### 6. Programar las tareas

Van en el **crontab del host** (`crontab -e`): el contenedor no tiene cron
instalado. Estas dos están configuradas en DEV y producción necesita las suyas.

```
30 23 * * * docker exec -u root ipes6-backend-dev /app/.venv/bin/python /app/manage.py calcular_snapshots >> <ruta>/logs/backend/calcular_snapshots.log 2>&1
0 6 1 6 *  docker exec -u root ipes6-backend-dev /app/.venv/bin/python /app/manage.py verificar_residencias_condicionales >> <ruta>/logs/backend/residencias.log 2>&1
```

Sin el primero, los gráficos de evolución no acumulan historia.

---

## Verificación final

```bash
docker ps --filter name=ipes6 --format '{{.Names}}\t{{.Status}}'
```

En la aplicación, abrir el dashboard y recorrer las siete pestañas.
**Recargar con Ctrl+Shift+R** para saltear la caché del navegador.

Qué esperar:

- **Rendimiento Académico**, **Auditoría** y **Mesas**: datos reales.
- **Ausentismo**: un aviso de *"Módulo de asistencia en puesta a punto"*. Es
  correcto y esperado mientras la asistencia no se tome de forma sistemática; el
  aviso desaparece solo cuando los datos alcanzan (≥100 registros y ≥20% de
  marcación efectiva).
- **Trámites**: vacío si no hay pedidos de analítico ni de equivalencia cargados.
- **`/reportes`**: redirige al dashboard. Sus paneles se movieron a las pestañas
  Preinscripciones, Estudiantes, Rendimiento y Ausentismo.

---

## Alternativa sin Redis

El sistema funciona sin Redis: si `REDIS_URL` no está definida, `settings.py` cae
a `LocMemCache`. Se pierde la invalidación por eventos (el caché pasa a depender
solo del TTL, hasta 15 minutos) y cada worker de gunicorn tiene su propia copia,
con menos aciertos. Es un modo degradado válido.

**Pero hay que quitar la dependencia del compose**, o el backend no arranca:

```yaml
depends_on:
  db:
    condition: service_healthy
  # redis:                        <- comentar estas dos lineas
  #   condition: service_healthy
```

---

## Si hay que volver atrás

La migración solo agrega tablas, así que revertir el código alcanza en la
mayoría de los casos:

```bash
git checkout <commit anotado al principio>
docker compose up -d --build
```

Para deshacer también la migración (borra las tres tablas de snapshots y los
datos que hayan acumulado):

```bash
docker exec ipes6-backend-dev bash -c "cd /app && .venv/bin/python manage.py migrate metrics zero"
```

Restaurar el backup solo si algo tocó datos existentes, cosa que este despliegue
no hace.

---

## Documentación relacionada

- `apps/metrics/CACHE_STRATEGY.md` — cómo funciona el caché, qué se invalida y
  cuándo, y cómo inspeccionarlo.
- `CLAUDE.md` — sección de cron, con el patrón que usan las tareas programadas.
