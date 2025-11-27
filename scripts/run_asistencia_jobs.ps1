# Ejecuta los dos comandos clave del módulo de asistencia.
# 1) Sincroniza snapshots de horarios y alumnos.
# 2) Genera las clases programadas y asistencias para la fecha actual.
# Pensado para que lo llame el Programador de tareas de Windows.

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "No se encontró $python. Ajusta la ruta al intérprete de Python del entorno virtual."
    exit 1
}

Set-Location $projectRoot

& $python manage.py sync_asistencia_snapshots
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo sync_asistencia_snapshots (código $LASTEXITCODE)."
    exit $LASTEXITCODE
}

$hoy = Get-Date -Format "yyyy-MM-dd"
& $python manage.py generate_asistencia_classes --fecha $hoy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo generate_asistencia_classes (código $LASTEXITCODE)."
    exit $LASTEXITCODE
}

Write-Output "Asistencia actualizada para $hoy."
