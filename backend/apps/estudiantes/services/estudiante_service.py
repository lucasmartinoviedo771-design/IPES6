from django.db.models import Q
from core.models import Estudiante, EstudianteCarrera, PreinscripcionChecklist
from apps.estudiantes.schemas import EstudianteAdminListItem, EstudianteAdminListResponse
from apps.estudiantes.api.helpers.estudiante_admin import _extract_documentacion, _determine_condicion

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
    doc_data = _extract_documentacion(est)
    checklist = checklist_map.get(est.pk)
    if checklist:
        for k in CHECKLIST_DOC_FIELDS:
            if doc_data.get(k) in (None, False, 0, ""):
                doc_data[k] = getattr(checklist, k, None)
    return _determine_condicion(doc_data)


class EstudianteService:
    @staticmethod
    def list_estudiantes_admin(filters: dict, limit: int = 50, offset: int = 0, allowed_carrera_ids: set[int] | None = None) -> EstudianteAdminListResponse:
        q = filters.get("q")
        carrera_id = filters.get("carrera_id")
        condicion_filter = filters.get("estado_legajo")  # UI sigue enviando "estado_legajo" como key
        estado_academico = filters.get("estado_academico")
        
        qs = (
            Estudiante.objects.select_related("persona", "user")
            .prefetch_related("carreras", "carreras_detalle", "carreras_detalle__profesorado")
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
                    qs = qs.filter(carreras_detalle__profesorado_id=carrera_id, carreras_detalle__estado_academico=estado_academico)
                else:
                    qs = qs.filter(carreras__id=carrera_id)
            else:
                # "Todas": Pero solo dentro de sus permitidas
                if estado_academico:
                    # Debe tener al menos una de SUS carreras en el estado buscado
                    qs = qs.filter(carreras_detalle__profesorado_id__in=allowed_carrera_ids, carreras_detalle__estado_academico=estado_academico)
                else:
                    qs = qs.filter(carreras__id__in=allowed_carrera_ids)
        else:
            # 2. Lógica para Admins sin restricciones (ven todo)
            if carrera_id:
                if estado_academico:
                    qs = qs.filter(carreras_detalle__profesorado_id=carrera_id, carreras_detalle__estado_academico=estado_academico)
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
                | Q(user__first_name__icontains=q_clean)
                | Q(user__last_name__icontains=q_clean)
                | Q(legajo__icontains=q_clean)
            )

        # Cargar checklists de preinscripción en bulk para evitar N+1
        qs_list = list(qs.distinct())
        est_ids = [e.pk for e in qs_list]
        checklists = (
            PreinscripcionChecklist.objects
            .filter(preinscripcion__alumno_id__in=est_ids)
            .order_by("-updated_at")
            .select_related("preinscripcion")
        )
        checklist_map: dict[int, PreinscripcionChecklist] = {}
        for cl in checklists:
            alumno_id = cl.preinscripcion.alumno_id
            if alumno_id not in checklist_map:
                checklist_map[alumno_id] = cl

        # Filtrar por condición en Python (calculado dinámicamente)
        CONDICION_TO_ESTADO = {
            "Regular": "COM",
            "Condicional": "INC",
            "Pendiente": "PEN",
        }
        if condicion_filter:
            condicion_filter_upper = condicion_filter.upper()
            # Aceptar tanto "COM/INC/PEN" (valores legacy del select) como "Regular/Condicional/Pendiente"
            qs_list = [
                e for e in qs_list
                if CONDICION_TO_ESTADO.get(_calcular_condicion_estudiante(e, checklist_map), "PEN") == condicion_filter_upper
            ]

        total = len(qs_list)
        paginated = qs_list[offset: offset + limit] if limit else qs_list[offset:]

        items = []
        for est in paginated:
            user = est.user if est.user_id else None
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

                carreras_det.append({
                    "profesorado_id": cd.profesorado_id,
                    "nombre": cd.profesorado.nombre,
                    "estado_academico": cd.estado_academico,
                    "estado_academico_display": cd.get_estado_academico_display(),
                    "condicion": condicion,
                })
                carreras_nombres.append(cd.profesorado.nombre)

            items.append(
                EstudianteAdminListItem(
                    dni=est.dni,
                    apellido=user.last_name if user else "",
                    nombre=user.first_name if user else "",
                    email=user.email if user else None,
                    telefono=est.telefono or None,
                    estado_legajo=est.estado_legajo,
                    estado_legajo_display=est.get_estado_legajo_display(),
                    carreras=carreras_nombres,
                    carreras_detalle=carreras_det,
                    legajo=est.legajo or None,
                    activo=user.is_active if user else False,
                )
            )
        return EstudianteAdminListResponse(total=total, items=items)
    @staticmethod
    def reset_password(estudiante: Estudiante) -> bool:
        """Resetea la contraseña del estudiante al formato 'pass' + DNI."""
        user = estudiante.user
        if not user:
            return False
        
        new_password = f"pass{estudiante.dni}"
        user.set_password(new_password)
        user.save(update_fields=["password"])
        
        estudiante.must_change_password = True
        estudiante.save(update_fields=["must_change_password"])
        return True
