# ⚠️ ADVERTENCIA: Firewall y Puerto 22 (SSH)

**Ver primero [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md), sección 1.** Este
servidor usa Cloudflare Tunnel, no el modelo clásico de Cloudflare → IP
pública. Eso cambia qué firewall tiene sentido acá.

## No agregar `allow <rangos-cloudflare>; deny all;` en nginx

Esa regla fue probada en producción el 2026-09-05 y **tumbó el sitio durante
~35 minutos**. La razón: el nginx del contenedor nunca ve una IP de
Cloudflare como origen de la conexión — siempre ve `172.18.0.1` (el gateway
hacia el Cloudflare Tunnel). `deny all` bloqueó el 100% del tráfico legítimo.

Esa restricción tiene sentido quando el servidor tiene un puerto público
directo (Cloudflare → IP real → tu app), para evitar que alguien salte
Cloudflare pegándole directo al origen. Acá no hay puerto público que sirva
la app Docker — todo pasa por el Tunnel — así que no hay nada a lo que
"pegarle directo", y la regla solo rompe el tráfico legítimo.

## Sobre el puerto 22 (SSH), si en algún momento se toca el firewall del sistema

`deny all` en nginx **solo afecta HTTP/HTTPS (puertos 80/443)**. Nunca toca
SSH. Nginx no controla puertos fuera de HTTP/HTTPS — restringir SSH desde ahí
no tiene efecto.

Si en el futuro hace falta restringir SSH a ciertos orígenes, hacerlo en el
**firewall del sistema** (ufw), nunca en nginx:

```bash
# Denegar todo por defecto
sudo ufw default deny incoming

# Permitir tu red de administración (SSH) — AJUSTAR a tu IP real
sudo ufw allow from 203.0.113.0/24 to any port 22

# Permitir HTTP/HTTPS público (si hiciera falta — hoy no hace falta,
# ver INFRAESTRUCTURA.md sección 1: no hay puerto público sirviendo la app)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

sudo ufw enable
```

**Nota:** `proto tcp` es obligatorio en ufw cuando se especifican múltiples
puertos separados por coma (ej. `to any port 80,443 proto tcp`).

## La distinción que hay que tener clara

- **Nginx** (contenedor o Hestia): controla HTTP/HTTPS solamente.
- **Firewall del host** (ufw/iptables): controla **todos** los puertos,
  incluyendo SSH.

## ⚠️ Riesgo crítico de cualquier cambio de firewall

Si se configura mal, se puede perder acceso SSH al servidor sin forma de
recuperarlo remotamente.

Verificar siempre, **en una terminal separada, antes de cerrar la sesión
actual**:

```bash
ssh user@server "echo OK"   # ¿SSH sigue funcionando?
curl -I https://ipesrg.com  # ¿el sitio sigue funcionando?
```

## Revertir rápido si algo sale mal

```bash
sudo ufw reset
sudo ufw disable
```

Para nginx, sacar el bloque agregado y recargar:

```bash
docker exec ipes6-frontend-dev nginx -t && docker exec ipes6-frontend-dev nginx -s reload
```
