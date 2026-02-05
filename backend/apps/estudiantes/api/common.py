from collections.abc import Iterable
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.utils import timezone
from ninja.errors import HttpError
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate

from core.models import Estudiante, StaffAsignacion, VentanaHabilitacion
from core.permissions import ensure_roles

ADMIN_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}
TUTORIA_ROLES = {"admin", "secretaria", "tutor"}
EQUIVALENCIAS_REVIEW_ROLES = {"admin", "secretaria", "equivalencias"}
TITULOS_ROLES = {"admin", "secretaria", "titulos"}
EQUIVALENCIAS_STAFF_ROLES = ADMIN_ALLOWED_ROLES | TUTORIA_ROLES | EQUIVALENCIAS_REVIEW_ROLES | TITULOS_ROLES


def user_has_roles(user: User | None, roles: Iterable[str]) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser or user.is_staff:
        return True
    role_set = {role.lower() for role in roles}
    raw_groups = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    user_groups = set(raw_groups)
    if "estudiantes" in raw_groups:
        user_groups.add("estudiante")
    return bool(user_groups.intersection(role_set))


def ensure_admin(request) -> None:
    ensure_roles(request.user, ADMIN_ALLOWED_ROLES)


def resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
    if dni:
        return Estudiante.objects.filter(dni=dni).first()
    if isinstance(request.user, AnonymousUser):
        return None
    return getattr(request.user, "estudiante", None)


def require_estudiante_user(request) -> Estudiante:
    if isinstance(request.user, AnonymousUser):
        raise HttpError(403, "Debe iniciar sesión.")
    estudiante = getattr(request.user, "estudiante", None)
    if not estudiante:
        raise HttpError(403, "Disponible solo para estudiantes.")
    return estudiante


def ensure_estudiante_access(request, dni: str | None) -> None:
    if not dni:
        return
    solicitante = getattr(request.user, "estudiante", None)
    if solicitante and solicitante.dni != dni:
        ensure_roles(request.user, ADMIN_ALLOWED_ROLES)


def can_manage_equivalencias(user) -> bool:
    return user_has_roles(user, EQUIVALENCIAS_STAFF_ROLES)


def get_equivalencia_window() -> VentanaHabilitacion | None:
    today = timezone.now().date()
    return (
        VentanaHabilitacion.objects.filter(
            tipo=VentanaHabilitacion.Tipo.EQUIVALENCIAS,
            activo=True,
            desde__lte=today,
            hasta__gte=today,
        )
        .order_by("-desde")
        .first()
    )


MONTH_NAMES = {
    1: "enero",
    2: "febrero",
    3: "marzo",
    4: "abril",
    5: "mayo",
    6: "junio",
    7: "julio",
    8: "agosto",
    9: "septiembre",
    10: "octubre",
    11: "noviembre",
    12: "diciembre",
}


def resolve_logo_image(
    width: float,
    env_setting_name: str,
    fallback_names: list[str],
    placeholder_style: ParagraphStyle,
    placeholder_text: str,
):
    candidate_paths: list[Path] = []
    setting_value = getattr(settings, env_setting_name, None)
    if setting_value:
        candidate_paths.append(Path(setting_value))

    base_dir = Path(getattr(settings, "BASE_DIR", "."))
    search_roots = [
        base_dir,
        base_dir / "static",
        base_dir / "static" / "logos",
        base_dir / "docs",
    ]
    media_root = getattr(settings, "MEDIA_ROOT", "")
    if media_root:
        search_roots.append(Path(media_root))

    for root in search_roots:
        for name in fallback_names:
            candidate_paths.append(root / name)

    seen: set[Path] = set()
    for candidate in candidate_paths:
        path_candidate = candidate.expanduser()
        if path_candidate in seen:
            continue
        seen.add(path_candidate)
        if not path_candidate.exists():
            continue
        try:
            image = Image(str(path_candidate))
            if image.imageWidth:
                scale = width / float(image.imageWidth)
                image.drawWidth = width
                image.drawHeight = image.imageHeight * scale
            image.hAlign = "CENTER"
            return image
        except Exception:
            continue

    return Paragraph(f"[{placeholder_text}]", placeholder_style)


def build_certificate_header(doc: SimpleDocTemplate) -> list:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CertHeaderTitle",
        parent=styles["Normal"],
        fontSize=12,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.black,
    )
    subtitle_style = ParagraphStyle(
        "CertHeaderSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.black,
    )
    placeholder_style = ParagraphStyle(
        "CertHeaderPlaceholder",
        parent=styles["Normal"],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.grey,
    )

    logo_ministerio = resolve_logo_image(
        70.0,
        "PRIMERA_CARGA_PDF_LOGO_MINISTERIO",
        [
            "escudo_ministerio_tdf.png",
            "static/logos/escudo_ministerio_tdf.png",
            "logo_ministerio.png",
            "logos/logo_ministerio.png",
        ],
        placeholder_style,
        "MINISTERIO",
    )
    logo_ipes = resolve_logo_image(
        70.0,
        "PRIMERA_CARGA_PDF_LOGO_IPES",
        [
            "logo_ipes.png",
            "static/logos/logo_ipes.png",
            "logos/logo_ipes.png",
        ],
        placeholder_style,
        "IPES",
    )

    header = [logo_ministerio]
    header.append(Paragraph("GOBIERNO DE LA PROVINCIA DE TIERRA DEL FUEGO", title_style))
    header.append(Paragraph("Ministerio de Educación, Cultura, Ciencia y Tecnología", subtitle_style))
    header.append(logo_ipes)
    header.append(Paragraph("INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR PAULO FREIRE", subtitle_style))
    header.append(Paragraph("Río Grande, Tierra del Fuego, Antártida e Islas del Atlántico Sur", subtitle_style))

    return header


__all__ = [
    "ADMIN_ALLOWED_ROLES",
    "EQUIVALENCIAS_STAFF_ROLES",
    "EQUIVALENCIAS_REVIEW_ROLES",
    "MONTH_NAMES",
    "TITULOS_ROLES",
    "TUTORIA_ROLES",
    "user_has_roles",
    "ensure_admin",
    "resolve_estudiante",
    "require_estudiante_user",
    "ensure_estudiante_access",
    "can_manage_equivalencias",
    "get_equivalencia_window",
    "resolve_logo_image",
    "build_certificate_header",
]
