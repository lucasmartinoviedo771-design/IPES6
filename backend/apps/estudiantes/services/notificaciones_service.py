from django.contrib.auth.models import User
from django.utils import timezone
from core.models import Conversation, ConversationParticipant, Message, MessageTopic, Estudiante, StaffAsignacion
from core.permissions import get_user_roles


def _get_tutores_estudiante(estudiante: Estudiante, turno_nombre: str | None = None):
    """
    Devuelve los Users tutores que corresponden al estudiante.

    Lógica de matching:
    - El tutor siempre tiene turno asignado.
    - Si el tutor tiene profesorado asignado → solo aplica a ese profesorado.
    - Si el tutor NO tiene profesorado → cubre todos los profesorados de su turno.
    - Si no se conoce el turno del estudiante → se incluyen todos los tutores del profesorado
      (con o sin turno específico) para no perder notificaciones.
    """
    TURNO_MAP = {
        "mañana": StaffAsignacion.Turno.MANANA,
        "tarde": StaffAsignacion.Turno.TARDE,
        "vespertino": StaffAsignacion.Turno.VESPERTINO,
    }
    turno_val = TURNO_MAP.get(turno_nombre.lower().strip(), None) if turno_nombre else None
    profes_ids = list(estudiante.carreras.values_list("id", flat=True))

    from django.db.models import Q
    # Tutores con profesorado asignado al estudiante
    q_con_prof = Q(profesorado_id__in=profes_ids)
    # Tutores sin profesorado (cubren todos los profesorados de su turno)
    q_sin_prof = Q(profesorado__isnull=True)

    asignaciones = StaffAsignacion.objects.filter(
        rol=StaffAsignacion.Rol.TUTOR,
    ).filter(q_con_prof | q_sin_prof).select_related("user")

    tutores = []
    for asig in asignaciones:
        if turno_val:
            # Si conocemos el turno del estudiante, filtramos por turno
            if asig.turno == turno_val:
                tutores.append(asig.user)
        else:
            # Sin info de turno: incluimos todos para no perder notificaciones
            tutores.append(asig.user)

    # Deduplicar
    seen = set()
    result = []
    for u in tutores:
        if u.id not in seen:
            seen.add(u.id)
            result.append(u)
    return result


class NotificacionesService:
    @staticmethod
    def _get_sistema_user():
        return User.objects.filter(username="sistema").first() or User.objects.filter(is_superuser=True).first()

    @staticmethod
    def _get_or_create_topic(name):
        topic, _ = MessageTopic.objects.get_or_create(name=name)
        return topic

    @staticmethod
    def enviar_notificacion(receptor: User, asunto: str, cuerpo: str, topic_name="Trámites", context_type=None, context_id=None, sender=None):
        """
        Envía un mensaje interno. Si ya existe una conversación abierta para el mismo
        pedido (context_type + context_id) y receptor, agrega el mensaje al hilo existente
        en vez de crear uno nuevo.
        """
        if not receptor: return

        sender = sender or NotificacionesService._get_sistema_user()
        now = timezone.now()

        # Buscar conversación existente para este pedido y este receptor
        conversation = None
        if context_type and context_id is not None:
            conversation = (
                Conversation.objects.filter(
                    context_type=context_type,
                    context_id=context_id,
                    participants__user=receptor,
                )
                .order_by("created_at")
                .first()
            )

        if conversation:
            # Reutilizar hilo: solo agregar nuevo mensaje
            Message.objects.create(conversation=conversation, author=sender, body=cuerpo)
            conversation.last_message_at = now
            conversation.save(update_fields=["last_message_at"])
            return conversation

        # Crear nueva conversación
        topic = NotificacionesService._get_or_create_topic(topic_name)
        conversation = Conversation.objects.create(
            topic=topic,
            created_by=sender,
            subject=asunto,
            context_type=context_type,
            context_id=context_id,
            status=Conversation.Status.OPEN,
            allow_student_reply=True
        )

        # Participante: Remitente
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=sender,
            role_snapshot="SISTEMA",
            can_reply=True,
            last_read_at=now
        )

        # Participante: Receptor
        roles = get_user_roles(receptor)
        role_pref = "estudiante" if "estudiante" in roles else (list(roles)[0] if roles else "")

        ConversationParticipant.objects.create(
            conversation=conversation,
            user=receptor,
            role_snapshot=role_pref,
            can_reply=True
        )

        # Mensaje inicial
        Message.objects.create(conversation=conversation, author=sender, body=cuerpo)

        conversation.last_message_at = now
        conversation.save(update_fields=["last_message_at"])

        return conversation

    @staticmethod
    def notificar_analitico_listo(pedido, accion: str = "confeccionado"):
        """
        Notifica al estudiante y tutores cuando el analítico fue confeccionado o entregado.
        accion: 'confeccionado' | 'entregado'
        """
        student_user = pedido.estudiante.user
        prof_nombre = pedido.profesorado.nombre if pedido.profesorado_id else "el profesorado"

        if accion == "entregado":
            asunto = "Tu Analítico fue entregado"
            cuerpo = (
                f"Hola {student_user.first_name},\n\n"
                f"Te informamos que tu analítico de {prof_nombre} ha sido entregado.\n\n"
                f"Cualquier consulta podés acercarte al Departamento de Títulos.\n\n"
                f"Saludos,\nDepartamento de Títulos - IPES"
            )
            asunto_staff = f"Analítico entregado: {student_user.get_full_name()} ({pedido.estudiante.dni})"
        else:
            asunto = "Tu Analítico está listo para retirar"
            cuerpo = (
                f"Hola {student_user.first_name},\n\n"
                f"Te informamos que tu analítico de {prof_nombre} solicitado el "
                f"{pedido.created_at.strftime('%d/%m/%Y')} ya fue confeccionado por el "
                f"Departamento de Títulos y se encuentra listo para retirar.\n\n"
                f"Saludos,\nDepartamento de Títulos - IPES"
            )
            asunto_staff = f"Analítico confeccionado: {student_user.get_full_name()} ({pedido.estudiante.dni})"

        # Notificar al estudiante
        NotificacionesService.enviar_notificacion(
            student_user, asunto, cuerpo, context_type="analitico", context_id=pedido.id
        )

        # Notificar a tutores del profesorado
        cuerpo_staff = (
            f"El analítico de {prof_nombre} del/la estudiante "
            f"{student_user.get_full_name()} (DNI {pedido.estudiante.dni}) "
            f"fue marcado como '{accion}' por el Departamento de Títulos."
        )
        tutores = _get_tutores_estudiante(pedido.estudiante)
        for tutor in tutores:
            NotificacionesService.enviar_notificacion(
                tutor, asunto_staff, cuerpo_staff, context_type="analitico", context_id=pedido.id
            )

    @staticmethod
    def notificar_cambio_comision(inscripcion):
        """Notifica al estudiante y tutores sobre el resultado del cambio de comisión."""
        student_user = inscripcion.estudiante.user
        estado_desc = inscripcion.get_cambio_comision_estado_display()
        asunto = f"Resultado de tu Solicitud de Cambio de Comisión: {estado_desc}"

        espacio = inscripcion.comision.materia.nombre if inscripcion.comision and inscripcion.comision.materia else "el espacio curricular"
        comision_nueva = inscripcion.comision.codigo if inscripcion.comision else "-"
        anio = inscripcion.comision.materia.anio_cursada if inscripcion.comision and inscripcion.comision.materia else "-"
        prof_nombre = inscripcion.comision.materia.plan_de_estudio.profesorado.nombre if inscripcion.comision and inscripcion.comision.materia else "-"
        disp = inscripcion.disposicion_numero or "S/N"

        if inscripcion.cambio_comision_estado == "APRO":
            cuerpo = (
                f"Hola {student_user.first_name},\n\n"
                f"Te informamos que se ha AUTORIZADO tu pedido de cambio de comisión para:\n\n"
                f"  Espacio curricular: {espacio}\n"
                f"  Año: {anio}º\n"
                f"  Profesorado: {prof_nombre}\n"
                f"  Nueva Comisión: {comision_nueva}\n"
                f"  Disposición Interna Nº: {disp}\n\n"
                f"El cambio ya se encuentra reflejado en tu trayectoria académica.\n\n"
                f"Saludos,\nSecretaría Académica - IPES"
            )
            asunto_staff = f"Cambio de comisión autorizado: {student_user.get_full_name()} ({inscripcion.estudiante.dni})"
            cuerpo_staff = (
                f"Se autorizó el cambio de comisión del/la estudiante "
                f"{student_user.get_full_name()} (DNI {inscripcion.estudiante.dni}).\n\n"
                f"  Espacio: {espacio} - {anio}º año\n"
                f"  Profesorado: {prof_nombre}\n"
                f"  Nueva Comisión: {comision_nueva}\n"
                f"  Disposición Interna Nº: {disp}"
            )
        else:
            cuerpo = (
                f"Hola {student_user.first_name},\n\n"
                f"Te informamos que tu pedido de cambio de comisión para '{espacio}' "
                f"del Profesorado {prof_nombre} ha sido RECHAZADO.\n\n"
                f"Para más información podés acercarte a bedelía o consultarlo con tu tutora.\n\n"
                f"Saludos,\nSecretaría Académica - IPES"
            )
            asunto_staff = f"Cambio de comisión rechazado: {student_user.get_full_name()} ({inscripcion.estudiante.dni})"
            cuerpo_staff = (
                f"Se rechazó el cambio de comisión del/la estudiante "
                f"{student_user.get_full_name()} (DNI {inscripcion.estudiante.dni}) "
                f"para '{espacio}' - {prof_nombre}."
            )

        # Notificar al estudiante
        NotificacionesService.enviar_notificacion(
            student_user, asunto, cuerpo, context_type="cambio_comision", context_id=inscripcion.id
        )

        # Notificar a tutores del profesorado
        tutores = _get_tutores_estudiante(inscripcion.estudiante)
        for tutor in tutores:
            NotificacionesService.enviar_notificacion(
                tutor, asunto_staff, cuerpo_staff, context_type="cambio_comision", context_id=inscripcion.id
            )

    @staticmethod
    def notificar_equivalencia_finalizada(pedido):
        """Notifica al estudiante y tutor sobre el otorgamiento de equivalencias."""
        student_user = pedido.estudiante.user
        asunto = f"Resultado de tu Trámite de Equivalencias: {pedido.resultado_final.upper()}"
        
        materias = pedido.materias.all()
        otorgadas = [m.nombre for m in materias if m.resultado == "otorgada"]
        rechazadas = [m.nombre for m in materias if m.resultado == "rechazada"]
        
        cuerpo = (
            f"Hola {student_user.first_name},\n\n"
            f"Te informamos que ha finalizado el trámite de equivalencias para el profesorado '{pedido.profesorado_destino_nombre}'.\n\n"
        )
        
        if otorgadas:
            cuerpo += "MATERIAS OTORGADAS:\n" + "\n".join([f"- {m}" for m in otorgadas]) + "\n\n"
        
        if rechazadas:
            cuerpo += "MATERIAS NO OTORGADAS:\n" + "\n".join([f"- {m}" for m in rechazadas]) + "\n\n"
            
        cuerpo += (
            f"Documento de referencia: {pedido.get_titulos_documento_tipo_display()} "
            f"Nº {pedido.titulos_disposicion_numero or pedido.titulos_nota_numero or 'S/D'}.\n\n"
            f"Ya podés consultar tu trayectoria académica actualizada.\n\n"
            f"Saludos,\nDepartamento de Títulos"
        )
        
        # Notificar al estudiante
        NotificacionesService.enviar_notificacion(student_user, asunto, cuerpo, context_type="equivalencia", context_id=pedido.id)
        
        # Notificar a tutores del profesorado
        asunto_staff = f"Equivalencia Finalizada: {student_user.get_full_name()} ({pedido.estudiante.dni})"
        tutores = _get_tutores_estudiante(pedido.estudiante)
        for tutor in tutores:
            NotificacionesService.enviar_notificacion(
                tutor, asunto_staff, cuerpo, context_type="equivalencia", context_id=pedido.id
            )
