# Correcciones a los manuales de uso — IPES6

> Copiá todo lo que sigue —desde "CONTEXTO" hasta el final— y pegalo en la IA
> que escribió los manuales.

---

## CONTEXTO

Ya escribiste los 12 manuales de uso en
`backend/apps/asistente_ia/knowledge/documentos/`. Están bien: los permisos por
rol son correctos, cada manual aclara qué NO puede hacer ese rol y a quién
derivar, y los datos numéricos coinciden con el reglamento.

Se revisaron contra el código fuente y hay **dos correcciones** y **tres
agregados**. Aplicalos sobre los archivos existentes, sin rehacerlos.

---

## CORRECCIÓN 1 — El porcentaje de asistencia está mal explicado

**Dónde:** `manual-estudiante.txt` y cualquier otro manual que mencione el
porcentaje de asistencia.

**Dice hoy:**

> "el mínimo exigido por el Reglamento Académico (80% o 65% con justificativo)"

**Está mal.** El Art. 24°.d no depende del justificativo sino **del formato de la
materia**. Un estudiante de un seminario leería eso y creería que necesita 80%
cuando le alcanza con 65%.

**Reemplazar por:**

> El porcentaje mínimo de asistencia depende del formato de la unidad curricular
> (Art. 24°.d del Reglamento Académico):
>
> - **80%** en Talleres, Prácticas Docentes, Laboratorios y unidades
>   promocionales. En estos casos, presentando justificativo oficial se concede
>   hasta un 15% adicional de inasistencias, o sea que el piso baja al 65%.
> - **65%** en Seminarios, Asignaturas, Materias y Módulos. En estos casos **no
>   hay régimen de excepcionalidad**: el 65% se exige siempre, con o sin
>   justificativo.
>
> Si no alcanzás el porcentaje que corresponde a tu materia, perdés la condición
> de alumno regular en esa unidad curricular.

---

## CORRECCIÓN 2 — Completar la tolerancia de asistencia docente

**Dónde:** `manual-docente.txt`, en el `[VERIFICAR CON SECRETARÍA]` que dice
"Cantidad exacta de minutos de tolerancia previa para marcar asistencia docente".

Ya no hace falta preguntarlo: está en el código
(`backend/apps/asistencia/services.py`, constantes `TOLERANCIA_ANTERIOR_MINUTOS`
y `TOLERANCIA_TARDE_MINUTOS`).

**Sacá esa marca de verificación y agregá esta sección:**

```
## ¿Desde cuándo puedo marcar mi asistencia? (Ventana horaria)

Rol: docente
Dónde: menú Docentes → Mi Asistencia

Podés marcar desde 10 minutos antes del horario de inicio de tu primera clase
del turno, y hasta que termina la última.

Si marcás dentro de los primeros 15 minutos posteriores al inicio, quedás
registrado como Presente. Pasado ese cuarto de hora, el sistema te registra
como Tarde.

La ventana se calcula por turno completo, no por materia: si tenés varias horas
seguidas con el mismo turno, marcás una sola vez y cubre todas.

Si una clase no tiene hora de fin cargada, el sistema asume una duración de 3
horas desde el inicio.

Errores frecuentes:
- El botón de marcar aparece deshabilitado o gris: todavía faltan más de 10
  minutos para el inicio de tu clase, o el turno ya terminó.
- Figurás como "Tarde" habiendo llegado a horario: marcaste pasados los 15
  minutos de tolerancia. Pedí la corrección a Bedelía.
- "Esta clase no tiene habilitada la asistencia por PIN": esa comisión no tiene
  activado el método de PIN; tomá la asistencia de forma manual.

Términos relacionados: asistencia, presentismo, marcar, fichar, presente, tarde,
ausente, ventana, tolerancia, no puedo marcar, botón deshabilitado.
```

---

## AGREGADO 1 — Errores reales que el sistema muestra y los manuales no explican

Estos son mensajes **literales** del sistema, tomados del código. Son los que la
gente ve cuando algo se bloquea, y son exactamente las preguntas del tipo "¿por
qué no puedo…?". Agregalos a la sección "Errores frecuentes" del manual del rol
que corresponda, explicando la causa y qué hacer.

**Para `manual-docente.txt`:**

| Mensaje que ve el usuario | Qué explicar |
|---|---|
| "Solo el Docente Presidente del tribunal de la mesa tiene autorización para cargar y guardar el acta oral." | Sólo el titular/presidente carga el acta oral. Los vocales integran el tribunal pero no cargan. |
| "La planilla está cerrada y no admite modificaciones." / "Solo Secretaría puede reabrirla." | Una vez cerrada, hay que pedirle a Secretaría que la reabra. |
| "La ventana de entrega de planillas no está habilitada. Consultá a Secretaría." | La entrega de planillas tiene fechas habilitadas en el calendario. |
| "No se puede cerrar la planilla: hay actas orales esperando la conformidad del estudiante." | Ya está documentado; verificar que la explicación coincida. |
| "El acta oral ya se encuentra cerrada y asentada. No puede modificarse sin autorización expresa de Secretaría." | Una vez que el estudiante prestó conformidad o venció el plazo, el acta queda firme. |
| "No está autorizado a descargar esta acta." | El docente sólo puede descargar el PDF de las actas de las mesas donde es titular. |

**Para `manual-estudiante.txt`:**

| Mensaje | Qué explicar |
|---|---|
| "No cumple correlatividades exigidas." | Remitir al detalle que da el sistema y a cómo consultarlo. |
| "El alumno debe encontrarse en estado 'Activo' en el profesorado correspondiente para poder inscribirse a materias." | Si figura inactivo, hay que regularizar en Bedelía. |
| "La ventana de 10 minutos ha expirado. El acta quedó notificada y sin objeción por tiempo cumplido." | Qué significa que el acta se dé por consentida. |
| "El alumno debe ser estudiante regular para solicitar cambios de comisión." | Condición previa para el cambio de comisión. |

**Para `manual-bedel.txt` y `manual-secretaria.txt`:**

| Mensaje | Qué explicar |
|---|---|
| "La planilla está cerrada. Reabrila desde Secretaría antes de sincronizar." | Circuito de reapertura. |
| "Los docentes no pueden gestionar justificaciones." | La justificación de inasistencias es de Bedelía, no del docente. |
| "El alumno no pertenece a esta carrera." / "El alumno no pertenece a este plan." | Casos de estudiantes en varias carreras o cambios de plan. |

---

## AGREGADO 2 — Dos reglas nuevas del sistema, recién implementadas

Estas funciones se agregaron hace pocos días y los manuales todavía no las
mencionan. Documentalas donde corresponda.

**a) Numeración automática de libro y folio** (para `manual-docente.txt`,
`manual-bedel.txt`, `manual-secretaria.txt`):

> Al guardar el acta definitiva con las notas, el sistema asigna solo el libro y
> el folio: el libro es **SIGI** (marca de carga digital, para distinguirla de
> los libros físicos históricos) y el folio es un número correlativo que no se
> repite.
>
> Dejá los campos "Libro" y "Número de folio" **vacíos** al generar el acta: si
> escribís algo, el sistema respeta ese valor y no lo numera solo. Los campos con
> contenido sólo se usan para cargar actas antiguas en papel.

**b) Una sola mesa por materia, fecha y modalidad** (para `manual-bedel.txt` y
`manual-secretaria.txt`):

> No se pueden crear dos mesas iguales el mismo día. Si intentás crear una mesa
> de una materia que ya tiene otra en esa fecha y con la misma condición
> (regular o libre), el sistema lo rechaza indicando cuál existe.
>
> Sí podés crear el mismo día una mesa **regular** y una **libre** de la misma
> materia: son condiciones distintas. Y los llamados 1° y 2° van en fechas
> distintas, así que tampoco chocan.

---

## AGREGADO 3 — Qué hacer con el resto de los `[VERIFICAR CON SECRETARÍA]`

Quedan 15 marcas de verificación. **Dejalas como están**: preguntan criterios
institucionales que efectivamente no están en el código (plazos de certificados
médicos, protocolos ante corte de energía, circuitos de elevación de informes).
Está bien que sigan señaladas para que Secretaría las complete.

Sólo se quita la de la tolerancia de asistencia docente, que sí se pudo resolver
(Corrección 2).

---

## RECORDATORIOS

- **No toques `backend/apps/asistente_ia/`** salvo la carpeta `documentos/`.
- Mantené el formato: bloques separados por línea en blanco, cada procedimiento
  autocontenido en ~1500 caracteres, con su línea de "Términos relacionados".
- Los encabezados con `##` ahora se usan como referencia en las citas que ve el
  usuario ("manual-docente.txt (Cargar las notas de una mesa)"), así que
  escribilos claros y descriptivos.
- Español rioplatense, tuteo con "vos".
