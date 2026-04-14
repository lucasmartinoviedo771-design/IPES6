from django.db.models import Q
from core.models import Estudiante, EstudianteCarrera
from apps.estudiantes.schemas import EstudianteAdminListItem, EstudianteAdminListResponse

class EstudianteService:
    @staticmethod
    def list_estudiantes_admin(filters: dict, limit: int = 50, offset: int = 0, allowed_carrera_ids: set[int] | None = None) -> EstudianteAdminListResponse:
        q = filters.get("q")
        carrera_id = filters.get("carrera_id")
        estado_legajo = filters.get("estado_legajo")
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

        if estado_legajo:
            qs = qs.filter(estado_legajo=estado_legajo.upper())

        total = qs.distinct().count()
        qs = qs.distinct()[offset : offset + limit] if limit else qs.distinct()[offset:]

        items = []
        for est in qs:
            user = est.user if est.user_id else None
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
                    "estado_legajo": cd.estado_legajo,
                    "estado_legajo_display": cd.get_estado_legajo_display()
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
