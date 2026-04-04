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

@management_router.post("/staff/roles", response={200: dict}, auth=JWTAuth())
def manage_staff_role(request, payload: AsignarRolIn):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    user = get_object_or_404(User, id=payload.user_id)
    role = payload.role.lower()
    
    if role not in ALL_ROLES:
        raise HttpError(400, f"Rol inválido: {role}")
        
    group, _ = Group.objects.get_or_create(name=role)
    
    if payload.action == "assign":
        user.groups.add(group)
        # Asignar profesorados
        for pid in payload.profesorado_ids:
            StaffAsignacion.objects.get_or_create(user=user, profesorado_id=pid, rol=role)
    else:
        user.groups.remove(group)
        if not payload.profesorado_ids:
            StaffAsignacion.objects.filter(user=user, rol=role).delete()
        else:
            StaffAsignacion.objects.filter(user=user, rol=role, profesorado_id__in=payload.profesorado_ids).delete()
            
    return {"message": "Operación completada con éxito"}

@management_router.get("/staff/{user_id}/asignaciones", response=List[dict], auth=JWTAuth())
def list_user_assignments(request, user_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "jefa_aaee"})
    user = get_object_or_404(User, id=user_id)
    asignaciones = StaffAsignacion.objects.filter(user=user).select_related("profesorado")
    return [
        {
            "id": a.id,
            "rol": a.rol,
            "profesorado_id": a.profesorado_id,
            "profesorado_nombre": a.profesorado.nombre
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
