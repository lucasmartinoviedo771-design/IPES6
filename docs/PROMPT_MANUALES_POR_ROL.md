# Prompt para generar los manuales de usuario por rol (IPES6)

> Copiá todo lo que sigue —desde "CONTEXTO" hasta el final— y pegalo en la otra IA.
> Está escrito para que trabaje sola sin volver a preguntar lo básico.

---

## CONTEXTO

Trabajás sobre **IPES6**, el sistema de gestión académica del IPES "Paulo Freire"
(Río Grande, Tierra del Fuego). Es un Django 5 + Django-Ninja en el backend y un
React + TypeScript + MUI en el frontend. La base es MySQL 8.

El sistema tiene un **asistente virtual con IA** que responde consultas en
lenguaje natural. Ese asistente ya sabe leer documentos institucionales: los
busca, los parte en fragmentos y devuelve el pasaje pertinente citando la fuente.
Hoy tiene cargado el Reglamento Académico, una disposición y el calendario.

**Tu tarea es escribir los manuales de uso del sistema, por rol**, para que el
asistente pueda responder preguntas operativas del personal, del tipo:

- "¿Cómo cargo una nota?"
- "¿Cómo reseteo la contraseña de un estudiante?"
- "¿Por qué no puedo marcar mi asistencia?"
- "¿Cómo cierro una planilla?"

## POR QUÉ HACE FALTA

El sistema tenía un mecanismo de guías (`GET /api/guias/guia-usuario`) que lee
archivos `docs/manuales/manual_<rol>.txt`. Está abandonado:

- La carpeta `docs/manuales/` **no existe**: devuelve 404 para todos los roles.
- Contempla 8 roles de los 17 que hoy tiene el sistema.
- **No contempla `docente`, que tiene 393 usuarios**, el segundo grupo más grande.
- Sí contempla `jefa_aaee`, que tiene 1 usuario.

No vas a arreglar ese mecanismo viejo. Vas a escribir el contenido en el formato
que el asistente indexa.

## DÓNDE VAN LOS ARCHIVOS

```
backend/apps/asistente_ia/knowledge/documentos/
```

Es la carpeta que el asistente escanea. Ya contiene el reglamento y el
calendario. Al agregar archivos, el asistente los detecta e indexa solo, sin
reiniciar el servidor.

**Formatos aceptados:** `.txt`, `.md`, `.pdf`.
**Usá `.txt` o `.md`.** El PDF hay que extraerlo y es ~11.000 veces más lento
(medido: 21 segundos contra 1,8 milisegundos).

**Codificación: UTF-8.**

## NOMBRE DE LOS ARCHIVOS

Un archivo por rol, con este patrón exacto:

```
manual-<rol>.txt
```

Ejemplos: `manual-docente.txt`, `manual-bedel.txt`, `manual-secretaria.txt`.

El nombre aparece en las citas que ve el usuario ("Fuente Oficial:
manual-docente.txt"), así que tiene que leerse bien. Sin mayúsculas, sin
espacios, sin tildes.

## FORMATO DEL CONTENIDO — IMPORTANTE

El asistente parte cada documento en **fragmentos de hasta 1800 caracteres** y
devuelve los 4 más pertinentes. De eso se desprenden tres reglas:

1. **Cada procedimiento debe ser autocontenido y caber en ~1500 caracteres.**
   Si un procedimiento es más largo, partilo en pasos numerados que se entiendan
   por separado ("Cargar notas — parte 1: abrir la planilla").

2. **Separá los bloques con una línea en blanco.** El cortador usa el doble salto
   de línea para no partir a mitad de una idea.

3. **Repetí las palabras clave dentro de cada bloque.** La búsqueda es por
   palabras (BM25): si el bloque sobre notas nunca dice "nota" sino "calificación",
   no aparece cuando alguien pregunta "cómo cargo una nota". Escribí ambos
   términos.

Estructura sugerida para cada procedimiento:

```
## Cargar las notas de una mesa de examen

Rol: docente (titular de la mesa)
Dónde: menú Docentes → Carga de Notas

Pasos:
1. ...
2. ...

Errores frecuentes:
- "No se pudo cargar la información": ...

Términos relacionados: nota, calificación, acta, planilla, mesa, final.
```

La línea "Términos relacionados" no es decorativa: mejora mucho que el asistente
encuentre el bloque cuando la persona pregunta con otras palabras.

## LOS 17 ROLES, CON SUS PERMISOS REALES

Estos datos salen de `backend/core/permissions.py` (diccionario `CAPABILITIES`) y
de la base de datos. **Un manual no puede prometer algo que el rol no puede
hacer**: verificá contra esta tabla.

| rol | usuarios | permisos | qué puede hacer (resumen) |
|---|---|---|---|
| `estudiante` | 4389 | 3 | enviar mensajes, ver estructura y horarios |
| `docente` | 393 | 12 | cargar regularidades y finales, acta manual, asistencia de estudiantes (ver/editar), ver estudiantes, dashboard, reportes |
| `coordinador` | 9 | 9 | ver actas, documentación, estudiantes, reportes, gestionar curso de ingreso |
| `bedel` | 8 | 29 | además de lo docente: editar estructura y estudiantes, formalizar inscripción, justificar inasistencias, analíticos, cambio de comisión, calendario |
| `secretaria` | 5 | 41 | casi todo: asignar roles, auditoría, equivalencias, títulos, asistencia docente |
| `tutor` | 4 | 12 | equivalencias, títulos, analíticos, cambio de comisión, curso de ingreso |
| `rectorado` | 4 | 8 | ver actas, métricas, dashboard, reportes (solo lectura) |
| `titulos` | 3 | 7 | analíticos, títulos, equivalencias de títulos, ver actas |
| `jefes` | 3 | 9 | ver actas, documentación, métricas, reportes |
| `attp` | 3 | 12 | **resetear contraseñas** (docente y estudiante), calendario, cambio de comisión, formalizar inscripción |
| `bedel_secretaria` | 2 | 13 | preinscripción, curso de ingreso, analíticos, ver asistencia |
| `kiosk` | 1 | 2 | solo asistencia docente (es un dispositivo físico, no una persona) |
| `jefa_aaee` | 1 | 7 | gestionar ventanas de habilitación, dashboard, reportes |
| `admin` | 0 | 42 | todo |
| `consulta` | 0 | 6 | solo lectura general |
| `equivalencias` | 0 | 2 | revisar equivalencias |
| `curso_intro` | 0 | 2 | gestionar curso de ingreso |

**Prioridad:** escribí primero `docente` (393 usuarios), `estudiante` (4389),
`bedel` (8) y `secretaria` (5). Los roles con 0 usuarios pueden esperar.

**Dato importante:** resetear contraseñas es permiso de `attp`, `secretaria`,
`bedel` y `admin` — **no de `docente`**. Si alguien escribe un manual de docente
explicando cómo resetear contraseñas, está mal.

## DE DÓNDE SACAR EL CONTENIDO

No inventes pasos. Cada procedimiento tiene que salir de una de estas fuentes:

1. **El código del frontend**, que es donde están las pantallas reales:
   - Navegación por rol: `frontend/src/components/layout/app-shell/constants.ts`
     (constante `ROLE_NAV_MAP`, dice qué secciones ve cada rol).
   - Páginas: `frontend/src/pages/` (por ejemplo `Secretaria/CargaNotasPage.tsx`
     para la carga de notas).
2. **Los endpoints del backend**: `backend/apps/*/api*.py`. Los mensajes de error
   que ahí se devuelven son literalmente los que ve el usuario, y sirven para la
   sección "errores frecuentes".
3. **Los permisos**: `backend/core/permissions.py`.
4. **El Reglamento Académico**, ya cargado en
   `backend/apps/asistente_ia/knowledge/documentos/`, para las reglas
   institucionales (plazos, porcentajes, condiciones).

**Si un paso no lo podés verificar en el código, no lo escribas.** Dejá una marca
`[VERIFICAR CON SECRETARÍA]` y seguí. Es preferible un manual con huecos
señalados que uno con pasos inventados que la gente va a seguir.

## REGLAS DE ESTILO

- **Español rioplatense**, tuteo con "vos": "tenés", "podés", "hacé".
- Tono institucional pero claro. Sin jerga técnica: no digas "endpoint", "query"
  ni "commit".
- Frases cortas. Pasos numerados.
- No prometas funcionalidad que no exista.
- Usá los nombres que la persona ve en pantalla, no los nombres internos del
  código (no digas "InscripcionMesa", decí "inscripción a la mesa").

## QUÉ ENTREGAR

1. Un archivo `manual-<rol>.txt` por cada rol prioritario, en
   `backend/apps/asistente_ia/knowledge/documentos/`.
2. Cada archivo con esta cabecera:

```
MANUAL DE USO DEL SISTEMA IPES6 — ROL: <NOMBRE DEL ROL>
Última actualización: <fecha>
Este documento describe los procedimientos del sistema para el rol <rol>.
Para normativa académica (plazos, porcentajes, condiciones) ver el Reglamento
Académico Institucional.
```

3. Al final de cada archivo, una lista de los `[VERIFICAR CON SECRETARÍA]` que
   hayas dejado, para que alguien los complete.

## CÓMO VERIFICAR QUE FUNCIONÓ

Después de crear los archivos, comprobá que el asistente los indexa y los
encuentra:

```bash
docker exec ipes6-backend-dev /app/.venv/bin/python /app/manage.py shell -c "
from apps.asistente_ia.knowledge import kb_loader
from apps.asistente_ia.knowledge.kb_reglamento import buscar_en_reglamento
kb_loader._cache_documentos = None
print('fragmentos:', len(kb_loader.cargar_documentos_adicionales()))
print(buscar_en_reglamento('como cargo una nota')[:400])
"
```

Tiene que devolver el fragmento del manual, no el reglamento. Si devuelve el
reglamento, agregá más términos relacionados al bloque.

## LO QUE NO TENÉS QUE HACER

- **No toques el código del asistente.** Otra persona está trabajando en
  `backend/apps/asistente_ia/` en la rama `feature/asistente-ia-v2`; si modificás
  esos archivos vamos a chocar. Vos solo agregás documentos a la carpeta
  `documentos/`.
- **No arregles** `backend/apps/guias/api.py` ni crees `docs/manuales/`. Ese
  mecanismo queda obsoleto.
- **No inventes** resoluciones, números de artículo, plazos ni porcentajes.
- **No escribas** un manual para `kiosk`: es un dispositivo, no una persona.
