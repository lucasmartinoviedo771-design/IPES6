import secrets
from typing import List

from django.contrib.auth.models import Group, User
from django.shortcuts import get_object_or_404
from ninja.errors import HttpError

from core.auth_ninja import JWTAuth
from core.models import Docente, Estudiante, Profesorado, StaffAsignacion, UserProfile
from core.permissions import ALL_ROLES, ROLE_ASSIGN_MATRIX, get_user_roles, require
from core.schemas import AsignarRolIn, ForceResetPasswordIn, UserSchema

from ..router import management_router

# "estudiante" es un rol de usuario final y "kiosk" una cuenta de dispositivo;
# ninguno de los dos es personal institucional. Un usuario que además de sus
# roles de gestión tenga una ficha de Estudiante (ej. cursa una certificación
# docente) igual debe aparecer si tiene algún otro rol de STAFF_ROLES; pero un
# estudiante puro o la cuenta del kiosco no deben listarse acá.
STAFF_ROLES = ALL_ROLES - {"estudiante", "kiosk"}


@management_router.get("/staff", response=list[UserSchema], auth=JWTAuth())
def list_staff(request):
    require(request.user, "asignar_roles")
    docentes_map = {d.persona.dni: d.persona for d in Docente.objects.select_related("persona").all() if d.persona}
    users = User.objects.filter(is_active=True).select_related("profile__persona").prefetch_related("groups")
    res = []
    for u in users:
        is_docente = u.username in docentes_map
        has_staff_role = any(g.name in STAFF_ROLES for g in u.groups.all())
        if has_staff_role or is_docente:
            persona = getattr(getattr(u, "profile", None), "persona", None) or docentes_map.get(u.username)
            first_name = persona.nombre if persona else u.first_name
            last_name = persona.apellido if persona else u.last_name
            res.append(
                UserSchema(
                    id=u.id,
                    username=u.username,
                    first_name=first_name,
                    last_name=last_name,
                    groups=[g.name for g in u.groups.all()],
                )
            )
    return res


@management_router.post("/staff/roles", response={200: dict, 400: dict, 403: dict}, auth=JWTAuth())
def manage_staff_role(request, payload: AsignarRolIn):
    require(request.user, "asignar_roles")
    user = get_object_or_404(User, id=payload.user_id)
    role = payload.role.lower()

    if role not in ALL_ROLES:
        return 400, {"message": f"Rol inválido: {role}"}

    operator_roles = get_user_roles(request.user)

    # 1. Anti-autoelevación: ningún usuario (salvo superusuario) puede modificarse roles a sí mismo
    if user.id == request.user.id and not request.user.is_superuser:
        return 403, {"message": "No está permitido modificar los propios roles."}

    # 2. Protección de cuentas superiores
    if user.is_superuser and not request.user.is_superuser:
        return 403, {"message": "No se pueden modificar roles de un superusuario."}

    if ("admin" in get_user_roles(user)) and not (request.user.is_superuser or "admin" in operator_roles):
        return 403, {"message": "No se pueden modificar roles de un administrador."}

    # 3. Aplicación estricta de la matriz de delegación de roles
    if not request.user.is_superuser:
        allowed_roles_to_assign = set()
        for op_role in operator_roles:
            allowed_roles_to_assign.update(ROLE_ASSIGN_MATRIX.get(op_role, []))
        if role not in allowed_roles_to_assign:
            return 403, {"message": f"Tu rol no tiene permisos para asignar o revocar el rol '{role}'."}

    group, _ = Group.objects.get_or_create(name=role)

    TURNOS_VALIDOS = {"manana", "tarde", "vespertino"}

    if payload.action == "assign":
        # --- COORDINADOR: exactamente 1 profesorado, sin turno ---
        if role == "coordinador":
            if len(payload.profesorado_ids) != 1:
                return 400, {"message": "Un coordinador debe tener exactamente un profesorado asignado."}
            ya_tiene = (
                StaffAsignacion.objects.filter(user=user, rol="coordinador")
                .exclude(profesorado_id=payload.profesorado_ids[0])
                .exists()
            )
            if ya_tiene:
                return 400, {
                    "message": "Este coordinador ya tiene un profesorado asignado. Quitá el anterior antes de asignar uno nuevo."
                }

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
                return 400, {
                    "message": f"Este tutor ya tiene una asignación para el turno {payload.turno}. Eliminá la existente antes de crear una nueva."
                }

        user.groups.add(group)

        if role == "tutor":
            if payload.profesorado_ids:
                for pid in payload.profesorado_ids:
                    StaffAsignacion.objects.get_or_create(
                        user=user,
                        profesorado_id=pid,
                        rol=role,
                        turno=payload.turno,
                    )
            else:
                # Sin profesorado → cubre todos los del turno
                StaffAsignacion.objects.get_or_create(
                    user=user,
                    profesorado=None,
                    rol=role,
                    turno=payload.turno,
                )
        else:
            for pid in payload.profesorado_ids:
                StaffAsignacion.objects.get_or_create(
                    user=user,
                    profesorado_id=pid,
                    rol=role,
                )
    else:
        # Desasignar
        if not payload.profesorado_ids:
            StaffAsignacion.objects.filter(user=user, rol=role).delete()
            user.groups.remove(group)
        else:
            StaffAsignacion.objects.filter(user=user, rol=role, profesorado_id__in=payload.profesorado_ids).delete()
            # Si no quedan asignaciones, quitar el grupo
            if not StaffAsignacion.objects.filter(user=user, rol=role).exists():
                user.groups.remove(group)

    return 200, {"message": "Operación completada con éxito"}


@management_router.get("/staff/{user_id}/asignaciones", response=list[dict], auth=JWTAuth())
def list_user_assignments(request, user_id: int):
    require(request.user, "asignar_roles")
    user = get_object_or_404(User, id=user_id)
    asignaciones = StaffAsignacion.objects.filter(user=user).select_related("profesorado")
    return [
        {
            "id": a.id,
            "rol": a.rol,
            "turno": a.turno,
            "profesorado_id": a.profesorado_id,
            "profesorado_nombre": a.profesorado.nombre
            if a.profesorado_id
            else (f"Todos los profesorados del turno {a.get_turno_display()}" if a.turno else "Todos los profesorados"),
        }
        for a in asignaciones
    ]


@management_router.post("/staff/force-password-reset", response={200: dict, 400: dict, 403: dict}, auth=JWTAuth())
def force_reset_password(request, payload: ForceResetPasswordIn):
    """Permite el reseteo administrativo forzado respetando jerarquía y previniendo escalación."""
    require(request.user, "resetear_password_docente")
    user = get_object_or_404(User, username=payload.username)

    # 1. Superusuarios solo pueden ser reseteados por otros superusuarios
    if user.is_superuser and not request.user.is_superuser:
        return 403, {"message": "No se puede restablecer la contraseña de un superusuario."}

    target_roles = get_user_roles(user)
    operator_roles = get_user_roles(request.user)
    is_admin = request.user.is_superuser or ("admin" in operator_roles)

    # 2. Cuentas de administradores solo pueden ser reseteadas por administradores o superusuarios
    if ("admin" in target_roles) and not is_admin:
        return 403, {"message": "No se puede restablecer la contraseña de un administrador."}

    # 3. Operadores no administradores (ej: attp) solo pueden resetear docentes/estudiantes
    if not is_admin:
        roles_gestion_protegidos = {"secretaria", "rectorado", "jefa_aaee", "jefes"}
        if target_roles & roles_gestion_protegidos:
            return 403, {"message": "No tenés autorización para restablecer contraseñas de cuentas de gestión."}

    from django.conf import settings
    from django.core.exceptions import ValidationError
    from django.core.mail import send_mail
    from django.core.validators import validate_email

    from core.models import Persona
    from core.persona_utils import get_persona_email

    email_destino = get_persona_email(user)
    if not email_destino:
        supplied_email = (payload.email or "").strip().lower()
        if not supplied_email:
            return 400, {
                "message": f"El usuario {user.username} no posee correo electrónico registrado. Ingrese un correo para enviarle las credenciales y guardarlo en el sistema.",
                "requires_email": True,
            }
        try:
            validate_email(supplied_email)
        except ValidationError:
            return 400, {
                "message": "El correo electrónico ingresado no tiene un formato válido.",
                "requires_email": True,
            }

        persona = (
            getattr(getattr(user, "profile", None), "persona", None)
            or getattr(getattr(user, "estudiante", None), "persona", None)
            or getattr(getattr(user, "docente", None), "persona", None)
            or Persona.objects.filter(dni=user.username).first()
        )
        if persona:
            persona.email = supplied_email
            persona.save(update_fields=["email"])
        else:
            persona = Persona.objects.create(
                dni=user.username,
                nombre=user.first_name or "Usuario",
                apellido=user.last_name or "",
                email=supplied_email,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.persona_id != persona.id:
            profile.persona = persona
            profile.save(update_fields=["persona"])

        user.email = supplied_email
        user.save(update_fields=["email"])
        email_destino = supplied_email

    using_default = not (payload.new_password and payload.new_password.strip())
    if using_default:
        # Generar contraseña temporal aleatoria segura en lugar de contraseña predecible fija
        new_pass = secrets.token_urlsafe(9)
    else:
        new_pass = payload.new_password

    user.set_password(new_pass)
    user.is_active = True
    user.save()

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.must_change_password = using_default
    profile.save(update_fields=["must_change_password"])

    email_enviado = False
    try:
        send_mail(
            subject="IPES Paulo Freire - Contraseña de acceso restablecida",
            message=(
                f"Hola {user.first_name or user.username},\n\n"
                f"Se ha restablecido administrativamente la contraseña de tu cuenta institucional.\n\n"
                f"Tu contraseña temporal de acceso es:\n"
                f"{new_pass}\n\n"
                f"Al iniciar sesión, el sistema te solicitará definir tu nueva contraseña personal obligatoriamente.\n\n"
                f"Acceso a la plataforma: {getattr(settings, 'FRONTEND_URL', 'https://ipes.edu.ar')}\n\n"
                f"Si no solicitaste este cambio, por favor comunicate a la brevedad con Bedelía o Secretaría."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@ipes.edu.ar"),
            recipient_list=[email_destino],
            fail_silently=True,
        )
        email_enviado = True
    except Exception:
        pass

    if email_enviado:
        msg = f"Contraseña de {user.username} reseteada exitosamente y enviada a su correo ({email_destino})."
    else:
        msg = (
            f"Contraseña de {user.username} reseteada exitosamente. Contraseña temporal generada: {new_pass}"
            if using_default
            else f"Contraseña de {user.username} reseteada exitosamente."
        )

    return 200, {
        "message": msg,
        "temp_password": new_pass if using_default else None,
        "email_enviado": email_enviado,
        "email_destino": email_destino,
    }
