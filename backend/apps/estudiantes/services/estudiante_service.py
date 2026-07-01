
from django.db.models import Prefetch, Q

from apps.estudiantes.api.helpers.estudiante_admin import (
    _determine_condicion,
    _extract_documentacion,
    _extract_documentacion_from_ec,
)
from apps.estudiantes.schemas import EstudianteAdminListItem, EstudianteAdminListResponse
from core.models import Estudiante, EstudianteCarrera, PreinscripcionChecklist

CHECKLIST_DOC_FIELDS = [
    "dni_legalizado",
    "fotos_4x4",
    "certificado_salud",
    "folios_oficio",
    "titulo_secundario_legalizado",
    "certificado_titulo_en_tramite",
    "analitico_legalizado",
    "articulo_7",
]


def _calcular_condicion_estudiante(est: Estudiante, checklist_map: dict) -> str:
    """Calcula la condición documental del estudiante fusionando datos del modelo y del checklist."""
    ec = est.carreras_detalle.first()
    doc_data = _extract_documentacion_from_ec(ec) if ec else _extract_documentacion(est)
    checklist = checklist_map.get(est.pk)
    if checklist:
        for k in CHECKLIST_DOC_FIELDS:
            if doc_data.get(k) in (None, False, 0, ""):
                doc_data[k] = getattr(checklist, k, None)
    return _determine_condicion(doc_data)


def _build_checklist_map(est_ids: list[int]) -> dict[int, PreinscripcionChecklist]:
    """Carga en bulk el checklist de preinscripción más reciente por estudiante (evita N+1)."""
    if not est_ids:
        return {}
    checklists = (
        PreinscripcionChecklist.objects.filter(preinscripcion__alumno_id__in=est_ids)
        .order_by("-updated_at")
        .select_related("preinscripcion")
    )
    checklist_map: dict[int, PreinscripcionChecklist] = {}
    for cl in checklists:
        alumno_id = cl.preinscripcion.alumno_id
        if alumno_id not in checklist_map:
            checklist_map[alumno_id] = cl
    return checklist_map


class EstudianteService:
    @staticmethod
    def list_estudiantes_admin(
        filters: dict, limit: int = 50, offset: int = 0, allowed_carrera_ids: set[int] | None = None
    ) -> EstudianteAdminListResponse:
        q = filters.get("q")
        carrera_id = filters.get("carrera_id")
        condicion_filter = filters.get("estado_legajo")  # UI sigue enviando "estado_legajo" como key
        estado_academico = filters.get("estado_academico")
        anio_ingreso = filters.get("anio_ingreso")

        qs = (
            Estudiante.objects.select_related("persona", "user")
            .prefetch_related(
                "carreras",
                # Orden explícito por pk: hace que `est.carreras_detalle.first()`
                # (en el cálculo de condición) use la CACHE del prefetch en vez de
                # disparar una query por fila (N+1). Sigue eligiendo el mismo
                # registro que antes (el de menor pk = el que devolvía .first()).
                Prefetch(
                    "carreras_detalle",
                    queryset=EstudianteCarrera.objects.select_related("profesorado").order_by("pk"),
                ),
            )
            .order_by("persona__apellido", "persona__nombre", "persona__dni")
        )

        # 1. Base filter: Si hay restricciones de carrera, aplicarlas SIEMPRE
        if allowed_carrera_ids is not None:
            # Si el usuario eligió una carrera específica, debe estar dentro de sus permitidas
            if carrera_id:
                if carrera_id not in allowed_carrera_ids:
                    return EstudianteAdminListResponse(total=0, items=[])
                # Filtrar específicamente por esa carrera y opcionalmente por estado
                if estado_academico:
                    qs = qs.filter(
                        carreras_detalle__profesorado_id=carrera_id, carreras_detalle__estado_academico=estado_academico
                    )
                else:
                    qs = qs.filter(carreras__id=carrera_id)
            else:
                # "Todas": Pero solo dentro de sus permitidas
                if estado_academico:
                    # Debe tener al menos una de SUS carreras en el estado buscado
                    qs = qs.filter(
                        carreras_detalle__profesorado_id__in=allowed_carrera_ids,
                        carreras_detalle__estado_academico=estado_academico,
                    )
                else:
                    qs = qs.filter(carreras__id__in=allowed_carrera_ids)
        else:
            # 2. Lógica para Admins sin restricciones (ven todo)
            if carrera_id:
                if estado_academico:
                    qs = qs.filter(
                        carreras_detalle__profesorado_id=carrera_id, carreras_detalle__estado_academico=estado_academico
                    )
                else:
                    qs = qs.filter(carreras__id=carrera_id)
            elif estado_academico:
                qs = qs.filter(carreras_detalle__estado_academico=estado_academico)

        # 3. Filtros generales
        if q:
            q_clean = q.strip()
            qs = qs.filter(
                Q(persona__dni__icontains=q_clean)
                | Q(persona__nombre__icontains=q_clean)
                | Q(persona__apellido__icontains=q_clean)
                | Q(legajo__icontains=q_clean)
            )

        if anio_ingreso:
            if carrera_id:
                # Si filtran por carrera + año, chequeamos el año específico de ingreso en esa carrera
                qs = qs.filter(carreras_detalle__profesorado_id=carrera_id, carreras_detalle__anio_ingreso=anio_ingreso)
            else:
                # Si es genérico, chequeamos el año de ingreso base del alumno
                qs = qs.filter(anio_ingreso=anio_ingreso)

        qs = qs.distinct()

        if condicion_filter:
            # estado_legajo en EstudianteCarrera es COM/INC/PEN y se mantiene
            # actualizado por _recalcular_estado_legajo_ec cada vez que se edita
            # el legajo. Filtrar por él en SQL elimina el Caso B (materializar todo).
            qs = qs.filter(carreras_detalle__estado_legajo=condicion_filter.upper())

        total = qs.count()
        paginated = list(qs[offset : offset + limit] if limit else qs[offset:])
        checklist_map = _build_checklist_map([e.pk for e in paginated])

        items = []
        for est in paginated:
            user = est.user if est.user_id else None
            persona = est.persona
            condicion = _calcular_condicion_estudiante(est, checklist_map)
            # Obtener detalles de carrera para incluir el estado académico de cada una (filtrado por permisos)
            carreras_det = []
            carreras_nombres = []

            for cd in est.carreras_detalle.all():
                # 1. Filtro por permisos (si es bedel tiene restricted ids)
                if allowed_carrera_ids is not None and cd.profesorado_id not in allowed_carrera_ids:
                    continue

                # 2. Filtro por carrera seleccionada en el UI (si aplica)
                if carrera_id and cd.profesorado_id != int(carrera_id):
                    continue

                # 3. Filtro por año de ingreso (si aplica)
                if anio_ingreso and cd.anio_ingreso != int(anio_ingreso):
                    continue

                # 4. Filtro por estado académico (si aplica)
                if estado_academico and cd.estado_academico != estado_academico:
                    continue

                # 5. Filtro por estado de legajo (si aplica)
                if condicion_filter and cd.estado_legajo != condicion_filter.upper():
                    continue

                from apps.estudiantes.api.helpers.estudiante_admin import es_carrera_visible

                if not es_carrera_visible(est, cd.profesorado_id, cd.anio_ingreso, cd.estado_legajo):
                    continue

                carreras_det.append(
                    {
                        "profesorado_id": cd.profesorado_id,
                        "nombre": cd.profesorado.nombre,
                        "estado_academico": cd.estado_academico,
                        "estado_academico_display": cd.get_estado_academico_display(),
                        "condicion": condicion,
                    }
                )
                carreras_nombres.append(cd.profesorado.nombre)

            items.append(
                EstudianteAdminListItem(
                    dni=est.dni,
                    apellido=persona.apellido if persona else "",
                    nombre=persona.nombre if persona else "",
                    email=persona.email if persona else None,
                    telefono=est.telefono or None,
                    estado_legajo=est.estado_legajo,
                    estado_legajo_display=est.get_estado_legajo_display(),
                    carreras=carreras_nombres,
                    carreras_detalle=carreras_det,
                    legajo=est.legajo or None,
                    anio_ingreso=est.anio_ingreso,
                    activo=user.is_active if user else False,
                )
            )
        return EstudianteAdminListResponse(total=total, items=items)

    @staticmethod
    def reset_password(estudiante: Estudiante) -> str | None:
        """Resetea la contraseña del estudiante a pass{DNI}."""
        user = estudiante.user
        if not user:
            return None

        dni = estudiante.persona.dni if hasattr(estudiante, "persona") and estudiante.persona else user.username
        new_password = f"pass{dni}"
        user.set_password(new_password)
        user.save(update_fields=["password"])

        estudiante.must_change_password = True
        estudiante.save(update_fields=["must_change_password"])
        return new_password

    @staticmethod
    def get_unique_admission_years(allowed_carrera_ids: set[int] | None = None) -> list[int]:
        """Obtiene la lista de años de ingreso únicos presentes en la base de datos."""
        # Años de ingreso base de los estudiantes
        qs_est = Estudiante.objects.exclude(anio_ingreso__isnull=True)
        if allowed_carrera_ids is not None:
            qs_est = qs_est.filter(carreras__id__in=allowed_carrera_ids)
        years_est = set(qs_est.values_list("anio_ingreso", flat=True))

        # Años de ingreso específicos por carrera
        qs_carrera = EstudianteCarrera.objects.exclude(anio_ingreso__isnull=True)
        if allowed_carrera_ids is not None:
            qs_carrera = qs_carrera.filter(profesorado_id__in=allowed_carrera_ids)
        years_carrera = set(qs_carrera.values_list("anio_ingreso", flat=True))

        all_years = sorted(list(years_est.union(years_carrera)), reverse=True)
        # Asegurar que son ints y filtrar posibles nulos que se hayan colado
        return [int(y) for y in all_years if y is not None]
