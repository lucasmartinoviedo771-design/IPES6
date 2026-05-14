# IPES6 — Instrucciones para Claude Code

## Cron pendiente de configurar en producción

Agregar el siguiente cron en el servidor de producción para que el sistema verifique
automáticamente las residencias condicionales el 1° de junio de cada año:

```
0 6 1 6 * cd /app && .venv/bin/python manage.py verificar_residencias_condicionales
```

**Qué hace:** El 01/06 a las 6am, verifica todas las inscripciones condicionales a
Residencia (Práctica IV / Talleres de Residencia) del ciclo lectivo en curso.
- Si el estudiante aprobó la materia pendiente en las mesas extraordinarias de mayo → marca la condición como RESUELTA.
- Si no aprobó → marca la condición como CAÍDA y pone la regularidad de Residencia en resguardo automáticamente.

**Cómo configurar:**
```bash
# Dentro del contenedor Docker de producción:
docker exec -it ipes6-backend crontab -e
# O bien configurarlo en el crontab del host apuntando al contenedor:
# 0 6 1 6 * docker exec ipes6-backend bash -c "cd /app && .venv/bin/python manage.py verificar_residencias_condicionales"
```

**Verificación manual (sin esperar el 01/06):**
```bash
docker exec ipes6-backend bash -c "cd /app && .venv/bin/python manage.py verificar_residencias_condicionales --dry-run"
```
