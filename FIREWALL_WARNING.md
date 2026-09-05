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
```
