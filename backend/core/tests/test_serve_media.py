import os

import pytest
from django.conf import settings
from django.contrib.auth.models import Group, User

from apps.preinscriptions.models_uploads import PreinscripcionArchivo
from core.models import (
    Conversation,
    ConversationParticipant,
    Docente,
    Estudiante,
    Materia,
    Message,
    Persona,
    PlanDeEstudio,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    Preinscripcion,
    Profesorado,
    RegularidadFormato,
    RegularidadPlantilla,
    StaffAsignacion,
    UserProfile,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def media_setup(tmp_path, settings):
    # Override MEDIA_ROOT using pytest tmp_path
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


class TestServeMedia:
    def test_unauthenticated_blocked(self, client, media_setup):
        response = client.get("/media/some_file.pdf")
        assert response.status_code == 401

    def test_authenticated_arbitrary_file_blocked_fail_close(self, client, media_setup):
        user = User.objects.create_user(username="testuser", password="password")
        client.force_login(user)

        file_path = os.path.join(settings.MEDIA_ROOT, "some_file.pdf")
        with open(file_path, "wb") as f:
            f.write(b"content")

        response = client.get("/media/some_file.pdf")
        assert response.status_code == 403

    def test_authenticated_admin_allowed_arbitrary_file(self, client, media_setup):
        admin_user = User.objects.create_superuser(username="adminuser", password="password")
        client.force_login(admin_user)

        file_path = os.path.join(settings.MEDIA_ROOT, "some_file.pdf")
        with open(file_path, "wb") as f:
            f.write(b"content")

        response = client.get("/media/some_file.pdf")
        assert response.status_code == 200

    def test_preinscripciones_access(self, client, media_setup):
        # Create profesorados for FK references
        prof1 = Profesorado.objects.create(nombre="Prof 1", duracion_anios=4)
        prof2 = Profesorado.objects.create(nombre="Prof 2", duracion_anios=4)

        # Create student 1
        p1 = Persona.objects.create(dni="11111111", nombre="Alumno", apellido="Uno")
        u1 = User.objects.create_user(username="11111111")
        g_est, _ = Group.objects.get_or_create(name="estudiante")
        u1.groups.add(g_est)
        est1 = Estudiante.objects.create(user=u1, persona=p1)
        pre1 = Preinscripcion.objects.create(alumno=est1, codigo="PRE-001", anio=2026, carrera=prof1)

        # Create student 2
        p2 = Persona.objects.create(dni="22222222", nombre="Alumno", apellido="Dos")
        u2 = User.objects.create_user(username="22222222")
        u2.groups.add(g_est)
        est2 = Estudiante.objects.create(user=u2, persona=p2)
        pre2 = Preinscripcion.objects.create(alumno=est2, codigo="PRE-002", anio=2026, carrera=prof2)

        # Create preinscripcion file for student 1
        rel_path = "preinscripciones/2026/06/14/dni.pdf"
        file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(b"student1_dni_content")

        PreinscripcionArchivo.objects.create(
            preinscripcion_id=pre1.id,
            tipo="dni",
            archivo=rel_path,
            nombre_original="dni.pdf",
            tamano=len("student1_dni_content"),
            content_type="application/pdf",
        )

        # Student 1 requesting their own file -> 200
        client.force_login(u1)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200
        assert b"student1_dni_content" in b"".join(response.streaming_content)

        # Student 2 requesting Student 1's file -> 403
        client.force_login(u2)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403

        # Bedel (assigned to carrera 1) requesting -> 200
        bedel_user = User.objects.create_user(username="bedeluser")
        g_bedel, _ = Group.objects.get_or_create(name="bedel")
        bedel_user.groups.add(g_bedel)
        StaffAsignacion.objects.create(user=bedel_user, rol="bedel", profesorado=prof1)

        client.force_login(bedel_user)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200

        # Bedel (not assigned to carrera 1) requesting -> 403
        bedel_user_2 = User.objects.create_user(username="bedeluser2")
        bedel_user_2.groups.add(g_bedel)
        StaffAsignacion.objects.create(user=bedel_user_2, rol="bedel", profesorado=prof2)

        client.force_login(bedel_user_2)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403

    def test_planillas_regularidad_access(self, client, media_setup):
        formato = RegularidadFormato.objects.create(slug="formato", nombre="Formato")
        plantilla = RegularidadPlantilla.objects.create(formato=formato, dictado="1C", nombre="Plantilla")
        prof = Profesorado.objects.create(nombre="Profesorado", duracion_anios=4)
        plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="123", anio_inicio=2026)
        materia = Materia.objects.create(plan_de_estudio=plan, nombre="Materia", anio_cursada=1, formato="ASI")

        rel_path = "planillas_regularidad/2026/06/14/planilla.pdf"
        file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(b"planilla_content")

        planilla = PlanillaRegularidad.objects.create(
            codigo="PLAN-123",
            numero=1,
            anio_academico=2026,
            profesorado=prof,
            materia=materia,
            plantilla=plantilla,
            formato=formato,
            dictado="1C",
            fecha="2026-06-14",
            pdf=rel_path,
        )

        # Docente assigned to this planilla
        doc_user = User.objects.create_user(username="docenteuser")
        g_docente, _ = Group.objects.get_or_create(name="docente")
        doc_user.groups.add(g_docente)
        persona_doc = Persona.objects.create(dni="99999999", nombre="Docente", apellido="Asignado")
        UserProfile.objects.create(user=doc_user, persona=persona_doc)
        docente = Docente.objects.create(persona=persona_doc)
        PlanillaRegularidadDocente.objects.create(
            planilla=planilla, docente=docente, nombre="Docente Asignado", rol="profesor"
        )

        # Docente not assigned
        doc_user_2 = User.objects.create_user(username="docenteuser2")
        doc_user_2.groups.add(g_docente)
        persona_doc2 = Persona.objects.create(dni="88888888", nombre="Docente2", apellido="NoAsignado")
        UserProfile.objects.create(user=doc_user_2, persona=persona_doc2)
        Docente.objects.create(persona=persona_doc2)

        # Student
        student_user = User.objects.create_user(username="studentuser")
        g_estudiante, _ = Group.objects.get_or_create(name="estudiante")
        student_user.groups.add(g_estudiante)

        # Docente assigned -> 200
        client.force_login(doc_user)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200

        # Docente not assigned -> 403
        client.force_login(doc_user_2)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403

        # Student -> 403
        client.force_login(student_user)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403

    def test_mensajes_access(self, client, media_setup):
        u_sender = User.objects.create_user(username="sender")
        u_recipient = User.objects.create_user(username="recipient")
        u_other = User.objects.create_user(username="other")

        conv = Conversation.objects.create(subject="Consulta")
        ConversationParticipant.objects.create(conversation=conv, user=u_sender)
        ConversationParticipant.objects.create(conversation=conv, user=u_recipient)

        rel_path = "mensajes/2026/06/14/adjunto.pdf"
        file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(b"message_attachment")

        Message.objects.create(conversation=conv, author=u_sender, body="Hola", attachment=rel_path)

        # Participant -> 200
        client.force_login(u_recipient)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200

        # Author -> 200
        client.force_login(u_sender)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200

        # Non-participant -> 403
        client.force_login(u_other)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403

    def test_foto_perfil_estudiante_access(self, client, media_setup):
        """Estudiante puede ver su propia foto; otro usuario recibe 403.

        Anti-drift: serve_media verifica propiedad vía estudiante_perfil (no user_profile).
        Si alguien cambia ese camino, este test lo detecta antes de llegar a producción.
        """
        dni = "33333333"
        rel_path = f"personas/fotos/foto_{dni}.jpg"
        file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(b"fake_jpeg_content")

        # Crear Persona → Estudiante → User (camino correcto, NO via UserProfile)
        persona = Persona.objects.create(dni=dni, nombre="Ana", apellido="García")
        user = User.objects.create_user(username=dni, password="pass")
        g_est, _ = Group.objects.get_or_create(name="estudiante")
        user.groups.add(g_est)
        Estudiante.objects.create(user=user, persona=persona)

        # Otro usuario sin relación con esa Persona
        other_user = User.objects.create_user(username="otro_user", password="pass")
        other_user.groups.add(g_est)

        # El propio estudiante → 200
        client.force_login(user)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 200

        # Otro estudiante → 403
        client.force_login(other_user)
        response = client.get(f"/media/{rel_path}")
        assert response.status_code == 403
