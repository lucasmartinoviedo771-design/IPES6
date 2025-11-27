# Automatización diaria de asistencia (docentes y comisiones)

Guía breve para mantener actualizado el módulo de asistencia sin intervención manual. Los comandos son idempotentes: si se vuelven a ejecutar para la misma fecha, no generan duplicados.

## Qué hace cada comando
- `python manage.py sync_asistencia_snapshots`
  - Toma una “foto” de horarios y alumnos inscriptos por comisión.
  - Útil cuando se crean o modifican comisiones, horarios o inscripciones.
- `python manage.py generate_asistencia_classes --fecha AAAA-MM-DD`
  - Crea/verifica las clases programadas de ese día y deja listas las asistencias:
    - Docente: marcado como ausente por defecto, listo para que marque presente.
    - Estudiantes: marcados como ausentes por defecto.

## Orden recomendado diario
1) Sincronizar snapshots (horarios/alumnos).
2) Generar clases y asistencias del día.

## Ejemplo en Linux con cron
Ejecutar desde la carpeta del proyecto (activar antes el entorno virtual si aplica).
```
# Cada día 02:00 - sincroniza horarios y alumnos
0 2 * * * cd /ruta/a/IPES6 && /ruta/a/.venv/bin/python manage.py sync_asistencia_snapshots
# Cada día 06:00 - genera clases del día
0 6 * * * cd /ruta/a/IPES6 && /ruta/a/.venv/bin/python manage.py generate_asistencia_classes --fecha $(date +\%F)
```

## Alternativa fiable en Linux: systemd timers
`Persistent=true` hace que, si el equipo estuvo apagado, ejecute al volver.
- Servicio: `/etc/systemd/system/ipes6-sync-asistencia.service`
```
[Unit]
Description=Sync asistencia snapshots

[Service]
Type=oneshot
WorkingDirectory=/ruta/a/IPES6
ExecStart=/ruta/a/.venv/bin/python manage.py sync_asistencia_snapshots
```
- Timer: `/etc/systemd/system/ipes6-sync-asistencia.timer`
```
[Unit]
Description=Timer diario sync asistencia snapshots

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```
Repetir con otro par de service/timer para `generate_asistencia_classes` a las 06:00 (cambiando nombre, descripción y ExecStart).

## Windows (Task Scheduler)
Crear dos tareas programadas:
1) “Sync asistencia” a las 02:00
   - Acción: `python manage.py sync_asistencia_snapshots`
   - Activar “Run task as soon as possible after a scheduled start is missed”.
2) “Generar clases asistencia” a las 06:00
   - Acción: `python manage.py generate_asistencia_classes --fecha AAAA-MM-DD`
   - Mismo ajuste de “run if missed”.
Nota: usar la ruta completa a `python.exe` del entorno virtual y la carpeta del proyecto como “Start in”.

### Atajo en Windows
Puedes usar `scripts/run_asistencia_jobs.ps1`, que corre ambos comandos con la fecha del día:
- Acción: `powershell.exe -ExecutionPolicy Bypass -File C:\proyectos\IPES6\scripts\run_asistencia_jobs.ps1`
- Start in: `C:\proyectos\IPES6`
- Programar la tarea una vez por día (ej. 06:00). El propio script corre primero el sync y luego las clases.

## Qué hacer si se perdió la ejecución (corte de red/servidor)
- Al volver el servicio, ejecutar manualmente en este orden:
  1) `python manage.py sync_asistencia_snapshots`
  2) `python manage.py generate_asistencia_classes --fecha AAAA-MM-DD` (la fecha que se perdió o la actual).

## Verificación rápida
- Backend: `python manage.py generate_asistencia_classes --fecha AAAA-MM-DD` debe responder “Generadas/verificadas N clases...”.
- Frontend kiosco `/docentes/asistencia`: debería listar las clases del día para un docente y permitir marcar.

## Notas operativas
- Cada vez que se cambian horarios/comisiones/inscripciones, el sync diario garantiza que la foto quede actualizada.
- No es necesario borrar nada antes de correr estos comandos; son seguros de reejecutar.
