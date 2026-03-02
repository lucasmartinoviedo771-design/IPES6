# data_imports

Importaciones manuales de estudiantes con proceso seguro (simulacion + aplicacion).

## Script principal

`scripts/data_imports/import_estudiantes_excel.py`

Objetivo:
- Actualizar `core_estudiante` por DNI (sin tocar apellido/nombre).
- Actualizar `auth_user.email` si viene email valido.
- Actualizar `core_estudiante.datos_extra` (nacimiento, secundario, superior).
- Vincular carrera en `core_estudiantecarrera` mapeando texto Excel -> `core_profesorado.id`.
- Soportar correccion opcional de mojibake preexistente.

## Dependencias

En el entorno donde ejecutes:
- `pymysql`
- `openpyxl`

Ejemplo:

```bash
pip install pymysql openpyxl
```

## Uso recomendado

1) Simular (no escribe en DB):

```bash
python3 scripts/data_imports/import_estudiantes_excel.py \
  --excel "Temporales/Datos  PErsonales de inscripcion. de estudiantes.xlsx" \
  --db-host 127.0.0.1 --db-port 3306 \
  --db-user ipes_user --db-password '***' --db-name ipes6 \
  --career-map scripts/data_imports/carrera_map.example.json
```

2) Revisar salida:
- `Temporales/import_estudiantes_YYYYmmdd_HHMMSS/summary.txt`
- `Temporales/import_estudiantes_YYYYmmdd_HHMMSS/preview_changes.csv`
- `Temporales/import_estudiantes_YYYYmmdd_HHMMSS/career_unresolved.csv` (si existe)
- `Temporales/import_estudiantes_YYYYmmdd_HHMMSS/dni_only_excel.txt`
- `Temporales/import_estudiantes_YYYYmmdd_HHMMSS/dni_only_db.txt`

3) Aplicar (escribe en DB):

```bash
python3 scripts/data_imports/import_estudiantes_excel.py \
  --excel "Temporales/Datos  PErsonales de inscripcion. de estudiantes.xlsx" \
  --db-host 127.0.0.1 --db-port 3306 \
  --db-user ipes_user --db-password '***' --db-name ipes6 \
  --career-map scripts/data_imports/carrera_map.example.json \
  --apply --confirm APLICAR \
  --snapshot-prefix pre_update_estudiantes \
  --fix-existing-mojibake
```

## Flags importantes

- `--apply --confirm APLICAR`: habilita escritura.
- `--career-map`: JSON para mapear texto de carrera a nombre o ID real.
- `--allow-fuzzy-career`: activa fuzzy matching para carreras (usar con cuidado).
- `--snapshot-prefix`: crea snapshots de tablas en la DB antes de aplicar.
- `--fix-existing-mojibake`: corrige mojibake existente en `domicilio` y `datos_extra`.

## Reglas que aplica

- Match principal por `DNI`.
- Duplicados de DNI en Excel: se toma el registro mas reciente por `fechahora` (si existe), sino la ultima fila.
- Si el valor en Excel viene vacio, no pisa el dato existente.
- `apellido` y `nombre`: nunca se actualizan.
- `telefono`: se normaliza a digitos y se corta a 20 chars.
- `domicilio`: se limpia y corta a 255 chars.

## Archivo de mapeo de carreras

Plantilla:
- `scripts/data_imports/carrera_map.example.json`

Formato:
- clave: texto de carrera del Excel (cualquier variante).
- valor: nombre exacto de `core_profesorado.nombre` o ID numerico.

## Nota de seguridad

Siempre ejecutar primero en simulacion y revisar `career_unresolved.csv` antes de aplicar en produccion.
