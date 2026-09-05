# Procedimiento Completo de Despliegue — Analytics Dashboard + Seguridad

**Última actualización:** 2026-09-05  
**Confirmado en:** Producción

---

Este documento duplica información que está dispersa en el repo para servir como guía de referencia única. Para el próximo despliegue importante, usá esto como checklist.

## Pasos

### 1. Preparación (Solo Lectura)
- Identificar nombres reales de contenedores: `docker ps --format '{{.Names}}\t{{.Status}}'`
- Medir alcance: `git fetch origin && git log HEAD..origin/main` (commits pendientes)
- Verificar estado: `git status --short` (sin cambios sin commitear)
- Línea de base: `docker exec <backend> manage.py shell -c "..."` (métricas pre-deploy)

### 2. Backup Completo
```bash
bash /home/ipesrg/sistema-gestion/scripts/backup_completo.sh
# Genera: /home/ipesrg/sistema-gestion/backups/backup_IPES6_COMPLETO_YYYYMMDD.tar.gz (590M)
```

### 3. Traer Código
```bash
cd /home/ipesrg/sistema-gestion
git pull
git log --oneline -3
```

### 4. Levantar Redis
```bash
cd backend
docker compose up -d --build redis backend
# Espera a que redis esté (healthy)
docker ps | grep redis
```

### 5. Verificar Caché
```bash
docker exec <backend> manage.py check
docker exec <backend> manage.py shell -c "
from django.core.cache import cache
cache.set('test','ok',30)
print('Caché:', cache.get('test'))
"
```

### 6. Aplicar Migraciones
```bash
docker exec <backend> manage.py migrate metrics
docker exec <backend> manage.py showmigrations metrics
# Esperado: [X] 0001_initial
```

### 7. Reconstruir Frontend
```bash
docker compose up -d --build frontend
# Verificar source maps desactivados:
docker exec <frontend> sh -c 'ls /usr/share/nginx/html/assets/*.map 2>/dev/null | wc -l'
# Esperado: 0
```

### 8. Generar Primer Snapshot
```bash
docker exec -u root <backend> /app/.venv/bin/python /app/manage.py calcular_snapshots
```

### 9. Configurar Nginx con Cloudflare
```bash
# Agregar proxy_set_header CF-Connecting-IP en cada bloque location de proxy
# Agregar allow/deny para los 22 rangos de Cloudflare (ver paso 10)
docker exec <frontend> nginx -t && docker exec <frontend> nginx -s reload
```

### 10. Firewall a Cloudflare (CRÍTICO)
```bash
# En /etc/nginx/conf.d/default.conf, después de "server {":
allow 103.21.244.0/22;
allow 103.22.200.0/22;
# ... (completar con los 22 rangos de https://www.cloudflare.com/ips/)
deny all;
```

### 11. Agregar Cron de Snapshots
```bash
crontab -e
# Agregar:
30 23 * * * docker exec -u root ipes6-backend-dev /app/.venv/bin/python /app/manage.py calcular_snapshots >> /home/ipesrg/scripts/snapshots.log 2>&1
```

### 12. Verificar
```bash
# Navegar por el sistema para generar eventos nuevos
# Después, verificar que aparecen IPs reales (no 172.18.0.1):
docker exec <backend> manage.py shell -c "
from django.db.models import Count
from core.models import AuditLog
ids = list(AuditLog.objects.order_by('-timestamp').values_list('id', flat=True)[:100])
for r in AuditLog.objects.filter(id__in=ids).values('ip_origen').annotate(n=Count('id')).order_by('-n')[:5]:
    print(r['ip_origen'], r['n'])
"
# Si aparecen IPs públicas: ✅ ÉXITO
# Si solo 172.18.0.1: ❌ Revisar cadena de proxies
```

---

## Migraciones

La única migración de este despliegue es `metrics.0001_initial`:

```
Tablas creadas (nuevas, no modifica existentes):
  - metrics_matriculasnapshot
  - metrics_asistenciasnapshot
  - metrics_ausentismosnapshot
```

**Reversibilidad:** ✅ Seguro revertir.

**Importante:** Los snapshots acumulados en esas tablas NO se pueden reconstruir hacia atrás (son fotos diarias). Si se borran, se pierde el historial. Pero la migración solo agregó tablas sin tocar nada existente, así que en la mayoría de los casos alcanza con revertir el código y dejar las tablas vacías.

---

## Comportamientos que NO son errores

Después del deploy, algunos gráficos/datos pueden verse vacíos o con advertencias:

| Comportamiento | Causa | Cuándo se arregla |
|---|---|---|
| **Ausentismo muestra cifras altas** | Módulo en puesta a punto; sin datos sistemáticos = todo cuenta como ausente | Cuando la asistencia se registra consistentemente |
| **Gráficos de evolución: un solo punto** | Primer snapshot acumulado | Después de 2-3 días (acumula snapshots diarios) |
| **Panel Trámites vacío** | No hay pedidos de analítico o equivalencia | Normal si no hay trámites en curso |

Ninguno de estos es un error de despliegue.

---

## Firewall

**⚠️ Ver [FIREWALL_WARNING.md](FIREWALL_WARNING.md) antes de tocar el firewall del sistema.**

Resumen: `deny all` en nginx solo bloquea puertos 80/443. Para restringir SSH (puerto 22), usar ufw, no nginx.

---

## Rollback

```bash
# Código
cd /home/ipesrg/sistema-gestion
git checkout 395f70b
cd backend && docker compose up -d --build

# Migración (opcional, borra snapshots acumulados)
docker exec <backend> manage.py migrate metrics zero
```

---

## Monitoreo Post-Despliegue

- `/home/ipesrg/scripts/snapshots.log` — cron diario a 23:30
- Nginx `deny all` — verificar que no bloquea healthchecks/scripts internos
- Cloudflare IP ranges — actualizar las 22 reglas si Cloudflare cambia su infraestructura
