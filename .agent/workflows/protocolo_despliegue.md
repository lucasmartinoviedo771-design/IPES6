---
description: Protocolo de despliegue y seguridad para el mantenimiento del sistema en producción.
---

# Protocolo Estándar de Operación y Despliegue

## 1. Reglas de Seguridad de Datos
*   **PRODUCCIÓN**: Estamos operando sobre un sistema en producción.
*   **BASE DE DATOS**: **NUNCA** borrar la base de datos bajo ninguna circunstancia, salvo pedido explícito y confirmado del usuario.
*   **ELIMINACIÓN DE ARCHIVOS**: Nunca borrar archivos o directorios sin autorización previa explícita.

## 2. Procedimiento de Rebuild (Reconstrucción)

Para aplicar cambios, seguir este criterio estricto:

### Cambios Pequeños (Frontend)
Reconstruir solo el frontend para agilizar:
```bash
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml build frontend
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml up -d frontend
```

### Cambios Pequeños (Backend)
Si es solo código (Python) y no dependencias nuevas, a veces basta con reiniciar:
```bash
docker restart backend-backend-1
```
Si se prefiere reconstruir para asegurar limpieza:
```bash
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml build backend
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml up -d backend
```

### Cambios Grandes / Estructurales
Realizar un rebuild completo sin caché para garantizar integridad:
```bash
// turbo-all
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml down
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml build --no-cache
docker compose -f /home/ipesrg/sistema-gestion/backend/docker-compose.yml up -d
```

## 3. Idioma
*   Toda comunicación y documentación debe realizarse estrictamente en **ESPAÑOL**.
