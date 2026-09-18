"""Generación de PDF para la preinscripción con foto embebida."""

from __future__ import annotations

import base64
from datetime import datetime

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

from core.models import Persona, Preinscripcion

from .models_uploads import PreinscripcionArchivo


def _build_foto_dataurl(pre: Preinscripcion) -> str | None:
    """Devuelve la foto 4x4 como data URL, si existe."""
    dataurl = getattr(pre, "foto_4x4_dataurl", None)
    if isinstance(dataurl, str) and dataurl.strip():
        return dataurl

    extra = getattr(pre, "datos_extra", None)
    if isinstance(extra, dict):
        alt = extra.get("foto_dataUrl") or extra.get("foto_4x4_dataurl")
        if isinstance(alt, str) and alt.strip():
            return alt

    foto_archivo = (
        PreinscripcionArchivo.objects.filter(preinscripcion_id=pre.id, tipo__iexact="foto4x4")
        .order_by("-creado_en")
        .first()
    )
    if not foto_archivo:
        foto_archivo = (
            PreinscripcionArchivo.objects.filter(preinscripcion_id=pre.id, tipo__icontains="foto")
            .order_by("-creado_en")
            .first()
        )
    if not foto_archivo or not foto_archivo.archivo:
        return None

    mime = (foto_archivo.content_type or "").lower()
    if "png" in mime:
        mimetype = "image/png"
    elif "gif" in mime:
        mimetype = "image/gif"
    else:
        mimetype = "image/jpeg"

    with foto_archivo.archivo.open("rb") as fh:
        encoded = base64.b64encode(fh.read()).decode("ascii")
    return f"data:{mimetype};base64,{encoded}"


import os

from django.conf import settings
from weasyprint import HTML


def safe_weasyprint_url_fetcher(url, timeout=5, ssl_context=None):
    """
    Control de seguridad (F05 - Anti-SSRF y Path Traversal):
    Permite únicamente esquemas 'data:' (ej: data:image/png;base64,...) y archivos
    estáticos locales estrictamente acotados a logos institucionales y fotos de alumnos.
    Bloquea peticiones HTTP/HTTPS a localhost, redes internas o internet,
    y previene acceso a rutas hermanas o fuera del subdirectorio permitido usando is_relative_to.
    """
    from pathlib import Path

    import weasyprint

    url_str = str(url)
    if url_str.startswith("data:"):
        return weasyprint.default_url_fetcher(url, timeout=timeout, ssl_context=ssl_context)

    if url_str.startswith("file://"):
        file_path = url_str[7:]
        try:
            target = Path(file_path).resolve()
        except Exception:
            raise ValueError(f"Ruta de archivo inválida: {url}")

        allowed_dirs: list[Path] = []
        # Directorios específicos y acotados permitidos para recursos PDF:
        # 1. Logos oficiales institucionales
        logos_dir = (Path(settings.BASE_DIR) / "static" / "logos").resolve()
        if logos_dir.exists():
            allowed_dirs.append(logos_dir)
        backend_logos_dir = (Path(settings.BASE_DIR) / "backend" / "static" / "logos").resolve()
        if backend_logos_dir.exists():
            allowed_dirs.append(backend_logos_dir)
        # 2. Fotos de alumnos en media (subcarpeta fotos)
        if getattr(settings, "MEDIA_ROOT", None):
            media_fotos = (Path(settings.MEDIA_ROOT) / "fotos").resolve()
            if media_fotos.exists():
                allowed_dirs.append(media_fotos)

        is_allowed = any(target.is_relative_to(d) for d in allowed_dirs)
        if is_allowed and target.is_file():
            return weasyprint.default_url_fetcher(url, timeout=timeout, ssl_context=ssl_context)

    raise ValueError(f"Acceso a recurso externo denegado por seguridad: {url}")


def preinscripcion_pdf(request, preinscripcion_id: int | None = None, pk: int | None = None, **kwargs):
    """Genera el PDF de la preinscripción con control de autorización estricto y anti-SSRF."""
    from django.http import HttpResponseForbidden

    from core.auth_ninja import JWTAuth
    from core.permissions import ensure_profesorado_access, get_user_roles

    pid = preinscripcion_id or pk or kwargs.get("preinscripcion_id") or kwargs.get("pk")
    pre = get_object_or_404(Preinscripcion, pk=pid)

    # 1. Control de autorización (F04)
    user = getattr(request, "user", None)
    if not (user and user.is_authenticated):
        user = JWTAuth()(request)

    autorizado = False
    if user and user.is_authenticated:
        is_owner = (user.username == getattr(getattr(pre.alumno, "persona", None), "dni", None)) or (
            user.id == getattr(pre.alumno, "user_id", None)
        )
        if is_owner or user.is_superuser:
            autorizado = True
        else:
            roles = get_user_roles(user)
            is_staff = bool(roles & {"admin", "secretaria", "bedel", "coordinador", "attp", "jefa_aaee"})
            if is_staff:
                # Comprobar alcance por carrera para operadores de staff (F04)
                try:
                    ensure_profesorado_access(user, pre.carrera_id)
                    autorizado = True
                except Exception:
                    autorizado = False

    # 2. Descarga con token firmado criptográficamente (F04: NO se admite código predecible)
    if not autorizado:
        token_query = request.GET.get("token")
        if token_query:
            from django.core import signing

            try:
                data = signing.loads(token_query, max_age=86400, salt="preinscripcion_pdf_download")
                if data.get("pre_id") == pre.id:
                    autorizado = True
            except Exception:
                pass

    if not autorizado:
        return HttpResponseForbidden(
            "Acceso denegado: se requiere usuario autenticado con permisos en la carrera o un token firmado válido para descargar este comprobante."
        )

    # Mapeo de datos para la plantilla (usando el mismo esquema que el frontend)
    # Intentamos obtener datos del estudiante vinculado o de los datos_extra del formulario
    extra = getattr(pre, "datos_extra", {}) or {}
    estudiante = getattr(pre, "alumno", None)
    persona = getattr(estudiante, "persona", None) if estudiante else None

    # Formatear el CUIL de forma amigable (XX-XXXXXXXX-X) si tiene 11 dígitos
    raw_cuil = (persona.cuil if persona else None) or pre.cuil or extra.get("cuil")
    formatted_cuil = None
    if raw_cuil:
        cleaned_cuil = "".join(c for c in str(raw_cuil) if c.isdigit())
        if len(cleaned_cuil) == 11:
            formatted_cuil = f"{cleaned_cuil[:2]}-{cleaned_cuil[2:10]}-{cleaned_cuil[10]}"
        else:
            formatted_cuil = raw_cuil

    # Obtener el display amigable para el estado civil
    raw_ec = (persona.estado_civil if persona else None) or extra.get("estado_civil")
    display_ec = dict(Persona.EstadoCivil.choices).get(raw_ec, raw_ec) if raw_ec else None

    v = {
        "apellido": (persona.apellido if persona else extra.get("apellido") or "").upper(),
        "nombres": persona.nombre if persona else extra.get("nombres"),
        "dni": persona.dni if persona else extra.get("dni"),
        "cuil": formatted_cuil,
        "fecha_nacimiento": persona.fecha_nacimiento.strftime("%d/%m/%Y")
        if (persona and persona.fecha_nacimiento)
        else extra.get("fecha_nacimiento"),
        "nacionalidad": (persona.nacionalidad if persona else None) or extra.get("nacionalidad"),
        "estado_civil": display_ec,
        "localidad_nac": (persona.localidad_nac if persona else None) or extra.get("localidad_nac"),
        "provincia_nac": (persona.provincia_nac if persona else None) or extra.get("provincia_nac"),
        "pais_nac": (persona.pais_nac if persona else None) or extra.get("pais_nac"),
        "domicilio": persona.domicilio if persona else extra.get("domicilio"),
        "email": (persona.email if persona else None) or extra.get("email"),
        "tel_movil": persona.telefono if persona else extra.get("tel_movil"),
        "emergencia_telefono": (persona.telefono_emergencia if persona else None) or extra.get("emergencia_telefono"),
        "emergencia_parentesco": (persona.parentesco_emergencia if persona else None)
        or extra.get("emergencia_parentesco"),
        "trabaja": extra.get("trabaja"),
        "horario_trabajo": extra.get("horario_trabajo"),
        "empleador": extra.get("empleador"),
        "domicilio_trabajo": extra.get("domicilio_trabajo"),
        "sec_titulo": extra.get("sec_titulo"),
        "sec_establecimiento": extra.get("sec_establecimiento"),
        "sec_fecha_egreso": extra.get("sec_fecha_egreso"),
        "sec_localidad": extra.get("sec_localidad"),
        "sec_provincia": extra.get("sec_provincia"),
        "sec_pais": extra.get("sec_pais"),
        "sup1_titulo": extra.get("sup1_titulo"),
        "sup1_establecimiento": extra.get("sup1_establecimiento"),
        "sup1_fecha_egreso": extra.get("sup1_fecha_egreso"),
        "cud_informado": extra.get("cud_informado"),
        "condicion_salud_informada": extra.get("condicion_salud_informada"),
        "condicion_salud_detalle": extra.get("condicion_salud_detalle"),
        "consentimiento_datos": extra.get("consentimiento_datos", True),
    }

    # Obtener el checklist guardado en la BD si existe para reflejar el estado actual
    try:
        cl = pre.checklist
    except Exception:
        cl = None

    if pre.carrera and pre.carrera.es_certificacion_docente:
        checklist_items = [
            {"label": "Fotocopia legalizada DNI", "checked": cl.dni_legalizado if cl else False},
            {"label": "2 fotos carnet 4x4", "checked": cl.fotos_4x4 if cl else False},
            {"label": "Certificado Buena Salud", "checked": cl.certificado_salud if cl else False},
            {"label": "3 Folios Oficio", "checked": cl.folios_oficio if cl else False},
            {"label": "Título Terciario/Universitario", "checked": cl.titulo_terciario_univ if cl else False},
            {"label": "Incumbencias", "checked": cl.incumbencia if cl else False},
        ]
    else:
        checklist_items = [
            {"label": "Fotocopia legalizada DNI", "checked": cl.dni_legalizado if cl else False},
            {"label": "Copia legalizada Analítico", "checked": cl.analitico_legalizado if cl else False},
            {"label": "2 fotos carnet 4x4", "checked": cl.fotos_4x4 if cl else False},
            {"label": "Título Secundario", "checked": cl.titulo_secundario if cl else False},
            {"label": "Certificado Alumno Regular", "checked": cl.certificado_alumno_regular if cl else False},
            {"label": "Certificado Título en Trámite", "checked": cl.titulo_en_tramite if cl else False},
            {"label": "Certificado Buena Salud", "checked": cl.certificado_salud if cl else False},
            {"label": "3 Folios Oficio", "checked": cl.folios_oficio if cl else False},
        ]

    # Rutas para recursos estáticos (Encabezado Universal)
    logo_left_path = os.path.join(settings.BASE_DIR, "static/logos/escudo_ministerio_tdf.png")
    logo_right_path = os.path.join(settings.BASE_DIR, "static/logos/logo_ipes.jpg")

    # Si la ruta base no funciona (Docker etc), intentamos alternativa
    if not os.path.exists(logo_left_path):
        logo_left_path = os.path.join(settings.BASE_DIR, "backend/static/logos/escudo_ministerio_tdf.png")
        logo_right_path = os.path.join(settings.BASE_DIR, "backend/static/logos/logo_ipes.jpg")

    context = {
        "v": v,
        "carrera_nombre": pre.carrera.nombre if pre.carrera else "Carrera no especificada",
        "checklist_items": checklist_items,
        "logo_left_path": logo_left_path,
        "logo_right_path": logo_right_path,
        "photo_url": _build_foto_dataurl(pre),
    }

    html = render_to_string("core/preinscripcion_premium.html", context)

    # Generación del PDF con WeasyPrint usando url_fetcher seguro (Anti-SSRF)
    pdf_content = HTML(string=html, url_fetcher=safe_weasyprint_url_fetcher).write_pdf()

    response = HttpResponse(pdf_content, content_type="application/pdf")
    filename = f"Preinscripcion_{v['apellido']}_{v['dni']}.pdf".replace(" ", "_")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response
