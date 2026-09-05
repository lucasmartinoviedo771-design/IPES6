# ⚠️ ADVERTENCIA: Puerto 22 (SSH) en Firewall

Al configurar `deny all` en nginx para restringir a Cloudflare:

```nginx
allow 103.21.244.0/22;
...
deny all;
```

**Esto solo afecta HTTP/HTTPS (puertos 80/443).** El puerto 22 (SSH) queda sin restricción.

## ¿Qué NO hacer?

❌ No agregar SSH a las reglas de nginx. Nginx no controla puertos fuera de HTTP/HTTPS.

<<<<<<< HEAD
## Si necesitas restringir SSH

Hacerlo en el **firewall del sistema** (ufw/iptables), no en nginx:

```bash
sudo ufw default deny incoming
sudo ufw allow from 203.0.113.0/24 to any port 22  # Tu red de admin
sudo ufw allow from 103.21.244.0/22 to any port 80,443  # Cloudflare
sudo ufw allow 22/tcp
sudo ufw enable
```

## La distinción

- **Nginx** (en este archivo): controla HTTP/HTTPS solamente
- **Firewall del host** (ufw/iptables): controla TODOS los puertos

Restriccionar SSH desde nginx no hace nada. Hacerlo desde el sistema sí.

## Verificar después de cambios

```bash
ssh user@server "echo OK"   # ¿SSH funciona?
curl -I https://server      # ¿HTTPS funciona?
=======
## Si necesitas restringir SSH a ciertos orígenes

Hacerlo en el **firewall del sistema** (ufw), no en nginx.

### Configuración segura (ufw)

```bash
# Denegar todo por defecto
sudo ufw default deny incoming

# Permitir tu red de administración (SSH)
sudo ufw allow from 203.0.113.0/24 to any port 22

# Permitir Cloudflare (HTTP/HTTPS)
sudo ufw allow from 103.21.244.0/22 to any port 80,443 proto tcp
sudo ufw allow from 103.22.200.0/22 to any port 80,443 proto tcp
# ... (continuar con los otros rangos de Cloudflare)

# Habilitar firewall
sudo ufw enable
```

**Nota:** `proto tcp` es obligatorio cuando especificas múltiples puertos en ufw.

## La distinción

- **Nginx** (en `/etc/nginx/conf.d/default.conf`): controla HTTP/HTTPS solamente
- **Firewall del host** (ufw/iptables): controla **TODOS** los puertos, incluyendo SSH

Restringir SSH desde nginx no hace nada. Hacerlo desde ufw sí.

## ⚠️ RIESGO CRÍTICO

Si cambias el firewall incorrectamente, **pierdes acceso SSH al servidor y no puedes recuperarlo remotamente.**

Siempre verificar después de cambios:

```bash
# En una terminal, ANTES de cerrar la sesión actual:
ssh user@server "echo OK"   # ¿SSH funciona?
curl -I https://server      # ¿HTTPS funciona?

# Si algo falla, volver atrás:
sudo ufw reset
```

## Revertir cambios rápidamente

```bash
sudo ufw reset
sudo ufw disable
>>>>>>> a8eee79 (docs: advertencia sobre puerto 22 en configuracion de firewall)
```
