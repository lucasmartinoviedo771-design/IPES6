from django.db.models import Q
from core.models import Estudiante, EstudianteCarrera
from apps.estudiantes.schemas import EstudianteAdminListItem, EstudianteAdminListResponse

class EstudianteService:
    @staticmethod
    def list_estudiantes_admin(filters: dict, limit: int = 50, offset: int = 0) -> EstudianteAdminListResponse:
        q = filters.get("q")
        carrera_id = filters.get("carrera_id")
        estado_legajo = filters.get("estado_legajo")
        estado_academico = filters.get("estado_academico")
        
        qs = (
            Estudiante.objects.select_related("persona", "user")
            .prefetch_related("carreras")
            .order_by("persona__apellido", "persona__nombre", "persona__dni")
        )
        
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
            
        if carrera_id:
            if estado_academico:
                qs = qs.filter(carreras_detalle__profesorado_id=carrera_id, carreras_detalle__estado_academico=estado_academico)
            else:
                qs = qs.filter(carreras__id=carrera_id)
        elif estado_academico:
            qs = qs.filter(carreras_detalle__estado_academico=estado_academico)

        if estado_legajo:
            qs = qs.filter(estado_legajo=estado_legajo.upper())

        total = qs.distinct().count()
        qs = qs.distinct()[offset : offset + limit] if limit else qs.distinct()[offset:]

        items = []
        for est in qs:
            user = est.user if est.user_id else None
            # Obtener detalles de carrera para incluir el estado académico de cada una
            carreras_det = []
            for cd in est.carreras_detalle.all():
                carreras_det.append({
                    "nombre": cd.profesorado.nombre,
                    "estado_academico": cd.estado_academico,
                    "estado_academico_display": cd.get_estado_academico_display()
                })

            items.append(
                EstudianteAdminListItem(
                    dni=est.dni,
                    apellido=user.last_name if user else "",
                    nombre=user.first_name if user else "",
                    email=user.email if user else None,
                    telefono=est.telefono or None,
                    estado_legajo=est.estado_legajo,
                    estado_legajo_display=est.get_estado_legajo_display(),
                    carreras=[c.nombre for c in est.carreras.all()],
                    carreras_detalle=carreras_det,
                    legajo=est.legajo or None,
                    activo=user.is_active if user else False,
                )
            )
        return EstudianteAdminListResponse(total=total, items=items)
