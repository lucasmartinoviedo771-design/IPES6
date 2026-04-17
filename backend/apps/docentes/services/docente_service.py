from django.contrib.auth.models import User, Group
from django.db.models import Q
from ninja.errors import HttpError
from core.models import Docente, StaffAsignacion
from ..schemas import DocenteOut

class DocenteService:
    @staticmethod
    def get_user_for_docente(docente: Docente) -> User | None:
        candidates = [docente.dni]
        if docente.email:
            candidates.append(docente.email)
        for candidate in candidates:
            if not candidate:
                continue
            user = User.objects.filter(username__iexact=candidate).first()
            if user:
                return user
            user = User.objects.filter(email__iexact=candidate).first()
            if user:
                return user
        return None

    @staticmethod
    def ensure_user_for_docente(docente: Docente) -> tuple[User, bool, str | None]:
        """
        Garantiza que exista un usuario para el docente.
        - Username: DNI
        - Password inicial: pass + DNI
        """
        existing = DocenteService.get_user_for_docente(docente)
        if existing:
            updated = False
            update_fields = []
            email = docente.email or ""
            first_name = docente.nombre or ""
            last_name = docente.apellido or ""
            if existing.email != email:
                existing.email = email
                update_fields.append("email")
            if existing.first_name != first_name:
                existing.first_name = first_name
                update_fields.append("first_name")
            if existing.last_name != last_name:
                existing.last_name = last_name
                update_fields.append("last_name")
            if update_fields:
                existing.save(update_fields=update_fields)
            return existing, False, None

        dni = (docente.dni or "").strip()
        if not dni:
            raise HttpError(400, "El docente no tiene DNI cargado; no podemos generar un usuario.")

        username = dni
        temp_password = f"pass{dni}"
        user = User.objects.create_user(
            username=username,
            password=temp_password,
            email=docente.email or "",
            first_name=docente.nombre or "",
            last_name=docente.apellido or "",
        )
        return user, True, temp_password

    @staticmethod
    def ensure_docente_group(user: User):
        group, _ = Group.objects.get_or_create(name="docente")
        user.groups.add(group)

    @staticmethod
    def serialize_docente(docente: Docente, temp_password: str | None = None) -> DocenteOut:
        user = DocenteService.get_user_for_docente(docente)
        return DocenteOut(
            id=docente.id,
            nombre=docente.nombre,
            apellido=docente.apellido,
            dni=docente.dni,
            email=docente.email,
            telefono=docente.telefono,
            cuil=docente.cuil,
            fecha_nacimiento=docente.fecha_nacimiento,
            usuario=user.username if user else None,
            temp_password=temp_password,
        )
