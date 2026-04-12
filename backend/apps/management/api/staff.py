from typing import List
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User, Group
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import StaffAsignacion, Profesorado, Docente, Estudiante
from core.permissions import ensure_roles
from ..router import management_router
from core.schemas import AsignarRolIn, UserSchema, ForceResetPasswordIn

ALL_ROLES = {
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", 
    "tutor", "coordinador", "consulta", "estudiante", "docente"
}

@management_router.get("/staff", response=List[UserSchema], auth=JWTAuth())
def list_staff(request):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    users = User.objects.filter(is_active=True).prefetch_related("groups")
    return [
        UserSchema(
            id=u.id, 
            username=u.username, 
            first_name=u.first_name, 
            last_name=u.last_name, 
            groups=[g.name for g in u.groups.all()]
        ) for u in users if any(g.name in ALL_ROLES for g in u.groups.all())
    ]

@management_router.post("/staff/roles", response={200: dict, 400: dict}, auth=JWTAuth())
def manage_staff_role(request, payload: AsignarRolIn):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    user = get_object_or_404(User, id=payload.user_id)
    role = payload.role.lower()

    if role not in ALL_ROLES:
        return 400, {"message": f"Rol inválido: {role}"}

    group, _ = Group.objects.get_or_create(name=role)

    TURNOS_VALIDOS = {"manana", "tarde", "vespertino"}

    if payload.action == "assign":
        # --- COORDINADOR: exactamente 1 profesorado, sin turno ---
        if role == "coordinador":
            if len(payload.profesorado_ids) != 1:
                return 400, {"message": "Un coordinador debe tener exactamente un profesorado asignado."}
            ya_tiene = StaffAsignacion.objects.filter(user=user, rol="coordinador").exclude(
                profesorado_id=payload.profesorado_ids[0]
            ).exists()
            if ya_tiene:
                return 400, {"message": "Este coordinador ya tiene un profesorado asignado. Quitá el anterior antes de asignar uno nuevo."}

        # --- BEDEL: 1 o más profesorados, sin turno ---
        elif role == "bedel":
            if not payload.profesorado_ids:
                return 400, {"message": "Debe asignar al menos un profesorado al bedel."}

        # --- TUTOR: turno requerido, profesorado opcional, un solo registro por turno ---
        elif role == "tutor":
            if not payload.turno:
                return 400, {"message": "Debe especificar el turno del tutor (manana/tarde/vespertino)."}
            if payload.turno not in TURNOS_VALIDOS:
                return 400, {"message": f"Turno inválido: '{payload.turno}'. Opciones: manana, tarde, vespertino."}
            ya_tiene_turno = StaffAsignacion.objects.filter(user=user, rol="tutor", turno=payload.turno).exists()
            if ya_tiene_turno:
                return 400, {"message": f"Este tutor ya tiene una asignación para el turno {payload.turno}. Eliminá la existente antes de crear una nueva."}

        user.groups.add(group)

        if role == "tutor":
            if payload.profesorado_ids:
                for pid in payload.profesorado_ids:
                    StaffAsignacion.objects.get_or_create(
                        user=user, profesorado_id=pid, rol=role, turno=payload.turno,
                    )
            else:
                # Sin profesorado → cubre todos los del turno
                StaffAsignacion.objects.get_or_create(
                    user=user, profesorado=None, rol=role, turno=payload.turno,
                )
        else:
            for pid in payload.profesorado_ids:
                StaffAsignacion.objects.get_or_create(
                    user=user, profesorado_id=pid, rol=role,
                )
    else:
        # Desasignar
        if not payload.profesorado_ids:
            StaffAsignacion.objects.filter(user=user, rol=role).delete()
            user.groups.remove(group)
        else:
            StaffAsignacion.objects.filter(
                user=user, rol=role, profesorado_id__in=payload.profesorado_ids
            ).delete()
            # Si no quedan asignaciones, quitar el grupo
            if not StaffAsignacion.objects.filter(user=user, rol=role).exists():
                user.groups.remove(group)

    return 200, {"message": "Operación completada con éxito"}

@management_router.get("/staff/{user_id}/asignaciones", response=List[dict], auth=JWTAuth())
def list_user_assignments(request, user_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    user = get_object_or_404(User, id=user_id)
    asignaciones = StaffAsignacion.objects.filter(user=user).select_related("profesorado")
    return [
        {
            "id": a.id,
            "rol": a.rol,
            "turno": a.turno,
            "profesorado_id": a.profesorado_id,
            "profesorado_nombre": a.profesorado.nombre if a.profesorado_id else (
                f"Todos los profesorados del turno {a.get_turno_display()}" if a.turno else "Todos los profesorados"
            ),
        } for a in asignaciones
    ]


@management_router.post("/staff/force-password-reset", response={200: dict}, auth=JWTAuth())
def force_reset_password(request, payload: ForceResetPasswordIn):
    """Permite el reseteo administrativo forzado para dar acceso inmediato a un usuario."""
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    user = get_object_or_404(User, username=payload.username)
    new_pass = payload.new_password if payload.new_password and payload.new_password.strip() else "pass12346789"
    user.set_password(new_pass)
    user.is_active = True
    user.save()

    # Si es un perfil de estudiante, desactivamos el flag de cambio de contraseña
    estudiante = Estudiante.objects.filter(user=user).first()
    if estudiante:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    return {"message": f"Contraseña de {user.username} reseteada exitosamente."}
