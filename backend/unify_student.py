import os
import sys
import django

# Setup Django environment
sys.path.append("/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction

from core.models.base import Persona
from core.models.estudiantes import Estudiante
from core.models.actas import ActaExamenEstudiante
from core.models.regularidades import Regularidad, PlanillaRegularidadFila, PlanillaCursadaFila
from core.models.inscripciones import InscripcionMateriaEstudiante
from core.models.mesas import InscripcionMesa
from apps.asistencia.models import AsistenciaEstudiante

User = get_user_model()


def unify_student(dni_source: str, dni_target: str):
    """
    Unifica dos registros de estudiante cuando por error histórico o cambio de DNI
    la trayectoria de un alumno quedó repartida o asociada a un DNI erróneo.

    :param dni_source: DNI erróneo o que se va a dar de baja (origen).
    :param dni_target: DNI correcto y definitivo del estudiante (destino).
    """
    print(f"\n=======================================================")
    print(f" Iniciando unificación: {dni_source} -> {dni_target}")
    print(f"=======================================================")

    p_src = Persona.objects.filter(dni=dni_source).first()
    p_tgt = Persona.objects.filter(dni=dni_target).first()
    e_src = Estudiante.objects.filter(persona=p_src).first()
    e_tgt = Estudiante.objects.filter(persona=p_tgt).first()
    u_src = User.objects.filter(username=dni_source).first()
    u_tgt = User.objects.filter(username=dni_target).first()

    if not p_src and not e_src and not ActaExamenEstudiante.objects.filter(dni=dni_source).exists() and not PlanillaRegularidadFila.objects.filter(dni=dni_source).exists():
        print(f"Error: No se encontró ningún registro asociado al DNI de origen {dni_source}.")
        return

    with transaction.atomic():
        # Caso A: No existe el estudiante target todavía (solo se cambia el DNI)
        if not p_tgt and not e_tgt:
            print(f"No existe registro previo en {dni_target}. Actualizando DNI en Persona y User...")
            if p_src:
                p_src.dni = dni_target
                p_src.save()
            if u_src:
                u_src.username = dni_target
                u_src.save()
            e_tgt = e_src
        # Caso B: Existen ambos registros y hay que fusionar
        else:
            print(f"Fusionando registros de {dni_source} en {dni_target}...")
            
            if e_src and e_tgt:
                # 1. Carreras
                for c in e_src.carreras.all():
                    if not e_tgt.carreras.filter(id=c.id).exists():
                        print(f"  + Agregando carrera {c.nombre}")
                        e_tgt.carreras.add(c)

                # 2. Regularidades
                for r in Regularidad.objects.filter(estudiante=e_src):
                    if Regularidad.objects.filter(estudiante=e_tgt, materia=r.materia).exists():
                        print(f"  * Conflicto en Regularidad {r.materia.nombre}. Se conserva la existente.")
                        r.delete()
                    else:
                        r.estudiante = e_tgt
                        r.save()
                        print(f"  + Regularidad movida: {r.materia.nombre} ({r.situacion})")

                # 3. Inscripciones a materias
                for ins in InscripcionMateriaEstudiante.objects.filter(estudiante=e_src):
                    if InscripcionMateriaEstudiante.objects.filter(estudiante=e_tgt, materia=ins.materia, anio=ins.anio).exists():
                        print(f"  * Conflicto en Inscripción {ins.materia.nombre} ({ins.anio}). Se conserva la existente.")
                        ins.delete()
                    else:
                        ins.estudiante = e_tgt
                        ins.save()
                        print(f"  + Inscripción a materia movida: {ins.materia.nombre}")

                # 4. Inscripciones a mesas de examen
                for im in InscripcionMesa.objects.filter(estudiante=e_src):
                    if InscripcionMesa.objects.filter(estudiante=e_tgt, mesa=im.mesa).exists():
                        print(f"  * Conflicto en Inscripción a Mesa {im.mesa}. Se conserva la existente.")
                        im.delete()
                    else:
                        im.estudiante = e_tgt
                        im.save()
                        print(f"  + Inscripción a mesa movida: {im.mesa}")

                # 5. Asistencias
                asist_count = AsistenciaEstudiante.objects.filter(estudiante=e_src).update(estudiante=e_tgt)
                print(f"  + Asistencias actualizadas: {asist_count}")

                # 6. Planillas de Cursada
                pcf_count = PlanillaCursadaFila.objects.filter(estudiante=e_src).update(estudiante=e_tgt)
                print(f"  + PlanillaCursadaFila actualizadas: {pcf_count}")

                # 7. Planillas de Regularidad (FK)
                prf_fk_count = PlanillaRegularidadFila.objects.filter(estudiante=e_src).update(estudiante=e_tgt)
                print(f"  + PlanillaRegularidadFila (FK) actualizadas: {prf_fk_count}")

                # Eliminar registros viejos
                e_src.delete()
                if p_src:
                    p_src.delete()
                if u_src:
                    u_src.delete()
                print("  + Registros de origen eliminados.")

        # 8. Actualizar DNI en Actas de Examen cargadas históricas
        actas_updated = ActaExamenEstudiante.objects.filter(dni=dni_source).update(dni=dni_target)
        print(f"  + Actas de Examen actualizadas (DNI {dni_source} -> {dni_target}): {actas_updated}")

        # 9. Actualizar DNI en Planillas de Regularidad históricas (por texto de DNI)
        prf_dni_updated = PlanillaRegularidadFila.objects.filter(dni=dni_source).update(dni=dni_target, estudiante=e_tgt)
        print(f"  + Planillas de Regularidad históricas actualizadas (DNI {dni_source} -> {dni_target}): {prf_dni_updated}")

    print("=======================================================")
    print(" Unificación completada exitosamente.")
    print("=======================================================\n")


if __name__ == "__main__":
    if len(sys.argv) == 3:
        src = sys.argv[1].strip()
        tgt = sys.argv[2].strip()
        unify_student(src, tgt)
    else:
        print("Uso: python unify_student.py <DNI_ORIGEN> <DNI_DESTINO>")
