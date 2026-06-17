import os

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse


PUBLIC_PREFIXES = ()

def serve_media(request, path):
    media_root = os.path.realpath(settings.MEDIA_ROOT)
    file_path = os.path.realpath(os.path.join(media_root, path))

    # Anti path-traversal
    if not file_path.startswith(media_root + os.sep):
        raise Http404

    # Enforce authentication for all media access
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    if not os.path.isfile(file_path):
        raise Http404

    # Import authorization helpers and models locally to avoid any potential circular imports
    from core.permissions import get_user_roles, allowed_profesorados
    from core.models import Preinscripcion, PlanillaRegularidad, Message, ConversationParticipant

    # 1. Access control by file path prefix
    if path.startswith("preinscripciones/"):
        from .models_uploads import PreinscripcionArchivo
        doc = PreinscripcionArchivo.objects.filter(archivo=path).first()
        if not doc:
            raise Http404
        preins = Preinscripcion.objects.select_related("alumno").filter(id=doc.preinscripcion_id).first()
        if not preins:
            raise Http404

        # Superusers are allowed
        if request.user.is_superuser:
            pass
        else:
            roles = get_user_roles(request.user)
            # Staff admin/secretaria have total access
            if roles.intersection({"admin", "secretaria"}):
                pass
            # Student can only access their own preinscription files
            elif "estudiante" in roles and preins.alumno and preins.alumno.user_id == request.user.id:
                pass
            # Bedeles/coordinadores can only access within their assigned profesorados
            elif roles.intersection({"bedel", "coordinador"}):
                allowed = allowed_profesorados(request.user)
                if allowed is not None and preins.carrera_id not in allowed:
                    return HttpResponse(status=403)
            else:
                return HttpResponse(status=403)

    elif path.startswith("planillas_regularidad/"):
        planilla = PlanillaRegularidad.objects.filter(pdf=path).first()
        if not planilla:
            raise Http404

        # Superusers are allowed
        if request.user.is_superuser:
            pass
        else:
            roles = get_user_roles(request.user)
            # Staff admin/secretaria/bedel are allowed
            if roles.intersection({"admin", "secretaria", "bedel"}):
                pass
            # Docente assigned to this planilla is allowed
            elif "docente" in roles and planilla.docentes.filter(docente__persona__user_profile__user=request.user).exists():
                pass
            else:
                return HttpResponse(status=403)

    elif path.startswith("mensajes/"):
        msg = Message.objects.filter(attachment=path).first()
        if not msg:
            raise Http404

        # Superusers are allowed
        if request.user.is_superuser:
            pass
        else:
            roles = get_user_roles(request.user)
            # Staff admin/secretaria are allowed
            if roles.intersection({"admin", "secretaria"}):
                pass
            # Author of the message is allowed
            elif msg.author_id == request.user.id:
                pass
            # Conversation participants are allowed
            elif ConversationParticipant.objects.filter(conversation=msg.conversation, user=request.user).exists():
                pass
            else:
                return HttpResponse(status=403)

    elif path.startswith("personas/fotos/"):
        # Foto de perfil: el propio estudiante puede ver la suya; staff tienen acceso total
        if request.user.is_superuser:
            pass
        else:
            roles = get_user_roles(request.user)
            if roles.intersection({"admin", "secretaria", "bedel", "coordinador", "docente"}):
                pass
            else:
                # Verificar que la foto pertenece al usuario autenticado
                from core.models import Persona
                filename = os.path.basename(path)
                try:
                    dni = filename.split("_", 1)[1].rsplit(".", 1)[0]
                except IndexError:
                    return HttpResponse(status=403)

                persona = Persona.objects.filter(dni=dni).first()
                if not persona:
                    return HttpResponse(status=403)

                # Camino 1: estudiante (Persona → Estudiante → User)
                estudiante_perfil = getattr(persona, "estudiante_perfil", None)
                if estudiante_perfil and estudiante_perfil.user_id == request.user.id:
                    pass  # OK
                # Camino 2: staff/docente (Persona → UserProfile → User)
                elif hasattr(persona, "user_profile") and persona.user_profile.user_id == request.user.id:
                    pass  # OK
                else:
                    return HttpResponse(status=403)

    else:
        # Default Fail-Close: Only superusers and admin/secretaria can access other paths
        roles = get_user_roles(request.user)
        if not (request.user.is_superuser or roles.intersection({"admin", "secretaria"})):
            return HttpResponse(status=403)

    return FileResponse(open(file_path, "rb"))
