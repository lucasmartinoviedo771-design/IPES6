# Infraestructura de Producción — IPES6

**Última verificación:** 2026-09-05
**Por qué existe este documento:** el 2026-09-05 se agregó un firewall en nginx
basado en un supuesto de arquitectura incorrecto (que el servidor era alcanzable
directamente desde internet) y tumbó el dashboard en producción durante ~35
minutos. La causa raíz no fue el comando en sí, sino que nadie tenía escrita la
cadena real de acceso al servidor. Este documento es esa referencia.

**Regla de uso:** antes de tocar nginx, firewall, DNS o cualquier cosa que
toque "cómo llega el tráfico al servidor", leer este documento entero. Si algo
acá no coincide con lo que ves en el servidor, el documento está desactualizado
— corregilo antes de seguir, no asumas que tenés razón vos.

---

## 1. Cadena de acceso pública (CRÍTICO)

```
Usuario → Cloudflare (proxy DNS, naranja) → Cloudflare Tunnel (cloudflared)
        → 127.0.0.1:8080/8443 (host) → nginx del contenedor → backend Django
```

### Verificado:

- **DNS público de `ipesrg.com`** resuelve a IPs de Cloudflare
  (`104.21.32.151`, `172.67.186.237`), **nunca** a la IP real del servidor.
  Comprobar con: `dig +short ipesrg.com`

- **`cloudflared`** corre como proceso del sistema (no en Docker), con un
  tunnel gestionado por token desde el dashboard de Cloudflare Zero Trust
  (no hay archivo de config local — las reglas de ingreso viven en Cloudflare).
  Verificar que corre: `ps aux | grep cloudflared`

- **El contenedor `ipes6-frontend-dev` (nginx) solo escucha en loopback:**
  ```
  127.0.0.1:8080->80/tcp
  127.0.0.1:8443->443/tcp
  ```
  **No hay ningún puerto público que sirva la app Docker.** Confirmar con
  `docker port ipes6-frontend-dev`.

### Consecuencia de seguridad (importante, no intuitiva)

**No hace falta, y no hay que agregar, un firewall que restrinja el origen a
rangos de IP de Cloudflare** (`allow <rangos-cloudflare>; deny all;` en nginx).

Esa defensa tiene sentido en la arquitectura clásica (Cloudflare → IP pública
→ tu server), donde alguien que descubre la IP real puede pegarle directo al
origen y falsificar `CF-Connecting-IP`. **Acá esa arquitectura no existe**: no
hay puerto público sirviendo la app, así que no hay nada a lo que "pegarle
directo". El Tunnel ya resuelve el problema, y de forma más fuerte (sin
superficie de ataque, en vez de una superficie con lista blanca).

Si en algún momento alguien agrega esa regla en nginx, **va a tumbar el sitio**:
la conexión que nginx ve siempre viene de `172.18.0.1` (el gateway hacia el
Tunnel), nunca de un rango de Cloudflare — así que `deny all` bloquea el 100%
del tráfico legítimo. Esto ya pasó una vez (2026-09-05, ~35 min de caída).

**Por qué `CF-Connecting-IP` es confiable igual, sin firewall:** porque no hay
otra forma de llegar al backend salvo a través del Tunnel, y el Tunnel solo
recibe tráfico que pasó por el edge de Cloudflare. Nadie puede inyectar ese
header directamente porque no hay puerto público al que conectarse para
intentarlo.

---

## 2. El otro sitio en la misma IP (no confundir)

El servidor físico (`72.62.105.42`) corre además un stack Hestia Control
Panel (nginx + Apache) que sirve otro contenido, sin relación con la app
Docker:

```
72.62.105.42:80/443 (nginx Hestia) → 72.62.105.42:8080/8443 (Apache)
  → /home/ipesrg/web/ipesrg.com/public_html (sitio estático, legacy)
```

Esto **no** es parte del sistema de gestión. Es alcanzable solo si alguien
conecta directo a la IP con el Host header correcto — sirve una página
estática vieja (`index.html` de 2025-12-19), no la app.

**No confundir este nginx (host, Hestia) con el nginx del contenedor
(`ipes6-frontend-dev`, Docker).** Son dos procesos nginx completamente
distintos, en máquinas/contextos distintos, sirviendo cosas distintas.

Hestia también aloja otros dominios en el mismo servidor (ver
`/home/ipesedu/` en el crontab — ipespaulofreire.edu.ar, Moodle). No tocar
esos configs pensando que son parte de IPES6.

---

## 3. Contenedores Docker (nombres reales, no confundir con nombres de otros hosts)

| Contenedor | Imagen | Puerto host | Rol |
|---|---|---|---|
| `ipes6-frontend-dev` | build local (nginx) | 127.0.0.1:8080, :8443 | Sirve SPA + proxy a backend |
| `ipes6-backend-dev` | build local (Django) | 127.0.0.1:8000 | API Django/Ninja |
| `ipes6-db-dev` | mysql:8.0 | 127.0.0.1:3307 | BD principal (`sistema_gestion`) |
| `ipes6-redis-dev` | redis:7-alpine | 127.0.0.1:6380 | Caché (django-redis) |
| `mariadb_ipes` | mariadb:10.3.39 | 127.0.0.1:3308 | Independiente, no relacionado con IPES6 — no tocar sin confirmar qué usa |
| `uptime-kuma` | louislam/uptime-kuma | 127.0.0.1:3001 | Monitoreo, no relacionado con IPES6 |

**Nota:** todos los nombres llevan el sufijo `-dev` pese a ser producción. Es
un detalle histórico del deploy, no significa que sea un entorno de pruebas.

Repo: `/home/ipesrg/sistema-gestion` (rama `main`).
Compose: `backend/docker-compose.yml`.

---

## 4. Django — configuración relevante

```
ALLOWED_HOSTS: localhost, 127.0.0.1, backend, 72.62.105.42,
               ipesrg.com, www.ipesrg.com, gestion.ipesrg.com
CORS_ALLOWED_ORIGINS: https://ipesrg.com, https://www.ipesrg.com,
                       https://gestion.ipesrg.com (+ localhost:8080 para dev)
DATABASE: MySQL (sistema_gestion) vía django.db.backends.mysql
CACHE: django_redis.cache.RedisCache (desde 2026-09-05)
```

**`gestion.ipesrg.com` aparece en ALLOWED_HOSTS/CORS pero no fue verificado
en esta sesión** — confirmar si es un dominio activo o vestigial antes de
asumir cualquier cosa sobre él.

**Resolución de IP del cliente:** `backend/core/client_ip.py`, prioridad:
1. `CF-Connecting-IP` (header que solo Cloudflare puede setear de forma
   confiable, dado que no hay otro camino público — ver sección 1)
2. `X-Forwarded-For[CLIENT_IP_XFF_INDEX]` (default índice 0)
3. `REMOTE_ADDR` (último recurso, siempre será `172.18.0.1` en este setup)

---

## 5. Cron (host, no en el contenedor — el contenedor no tiene cron)

Editar con `crontab -e` como el usuario del servidor (no root, salvo que se
indique `docker exec -u root`).

| Horario | Comando | Qué hace |
|---|---|---|
| `0 2 * * *` | `daily_backup.sh` | Backup diario de BD |
| `0 4 * * 0` | `weekly_backup.sh` | Backup semanal |
| `0 5 * * 2,5` | `docker system prune` | Limpieza de imágenes viejas |
| `0 6 1 6 *` | `verificar_residencias_condicionales` | Anual, residencias |
| `30 1 * * *` | `recalcular_resguardo --solo-activos` | Diario, resguardo de materias |
| `30 23 * * *` | `calcular_snapshots` | Diario, snapshots para dashboard (agregado 2026-09-05) |

Los crons de `0 3 * * 3` en adelante (`ipesweb.sh`, `ipesmoodledata.sh`, etc.)
son de **otro** sitio (`ipespaulofreire.edu.ar`, Hestia), no de IPES6.

---

## 6. Backups

Script principal: `scripts/backup_completo.sh` (en el repo). Genera un
tarball con código (vía `git archive`, limpio de dependencias), dump de BD,
`.env` y media. Se guarda en `backups/backup_IPES6_COMPLETO_YYYYMMDD.tar.gz`.

Rutinas automáticas de BD sola: `/home/ipesrg/scripts/daily_backup.sh` y
`weekly_backup.sh` (fuera del repo, en el home del usuario del sistema).

---

## 7. Preguntas abiertas / pendientes de verificar

Esta sección existe para no repetir el error de "asumir y romper". Si alguien
verifica algo de esta lista, muévalo arriba con la evidencia y la fecha.

- [ ] ¿`gestion.ipesrg.com` es un dominio activo? ¿Qué sirve?
- [ ] ¿El Tunnel de Cloudflare tiene más de un ingress rule (ej. subdominios
      distintos a distintos puertos)? Solo se puede ver desde el dashboard de
      Cloudflare Zero Trust, no desde el servidor.
- [ ] ¿`mariadb_ipes` (puerto 3308) es usado por algo activo, o es un
      remanente? No tocar sin confirmar.
- [ ] Reglas de IPv6 de Cloudflare — no se verificaron (solo IPv4 en cualquier
      config anterior).

---

## 8. Errores ya cometidos (para no repetirlos)

| Fecha | Qué se hizo | Por qué estuvo mal | Lección |
|---|---|---|---|
| 2026-09-05 | Se agregó `allow <cloudflare>; deny all;` en nginx del contenedor | Asumió que el servidor tiene un puerto público directo; en realidad todo pasa por Tunnel y nginx nunca ve una IP de Cloudflare | Verificar la cadena real de acceso (sección 1) antes de tocar reglas de origen |
| 2026-09-05 | Commit con `git add -A` incluyó un archivo de trabajo temporal (`nuevo1.txt`) que se perdió en un `reset --hard` posterior | No se revisó qué incluía el `add -A` antes de commitear | Preferir `git add <archivo>` explícito; `.gitignore` ya cubre `nuevo*.txt` |
