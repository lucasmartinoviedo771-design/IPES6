#!/usr/bin/env python3
"""
Script: audit_student_inscriptions.py
Descripción:
    Consulta las inscripciones a materias de un estudiante por DNI y audita:
    - Materias y comisiones a las que está inscripto.
    - Fecha y hora exacta de inscripción (con zona horaria de Argentina).
    - Quién realizó la inscripción (operador/usuario auditor).
    - Historial de movimientos asociados (bajas, cambios de comisión, etc.).

Uso:
    docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/audit_student_inscriptions.py <DNI>
"""

import os
import sys
import zoneinfo

sys.path.append("/app")
sys.path.append("/home/ipesrg/sistema-gestion/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.contrib.auth.models import User
from core.models.estudiantes import Estudiante
from core.models.inscripciones import InscripcionMateriaEstudiante

TZ_ARG = zoneinfo.ZoneInfo("America/Argentina/Ushuaia")


def auditar_estudiante(dni: str):
    print(f"\n============================================================")
    print(f" AUDITORÍA DE INSCRIPCIONES A MATERIAS - DNI: {dni}")
    print(f"============================================================")

    # Buscar usuario / estudiante
    user = User.objects.filter(username=dni).first()
    if not user:
        # Intentar buscar por persona si username difiere
        estudiante = Estudiante.objects.filter(persona__numero_documento=dni).first()
        if estudiante and estudiante.user:
            user = estudiante.user
        else:
            print(f"❌ No se encontró ningún usuario/estudiante con DNI: {dni}")
            return

    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        print(f"⚠️ El usuario {user.username} ({user.first_name} {user.last_name}) existe pero no tiene perfil de Estudiante.")
        return

    print(f"\n👤 ESTUDIANTE:")
    print(f"  • Nombre y Apellido: {user.first_name} {user.last_name}")
    print(f"  • DNI: {user.username}")
    print(f"  • Legajo: {estudiante.legajo or 'Sin legajo asignado'}")
    print(f"  • Email: {user.email or 'Sin email'}")

    carreras = estudiante.carreras_detalle.select_related("profesorado").all()
    if carreras.exists():
        print(f"  • Carreras asociadas:")
        for ec in carreras:
            print(f"      - {ec.profesorado.nombre} (Cohorte: {ec.cohorte or ec.anio_ingreso or 'S/D'} | Estado: {ec.get_estado_academico_display()})")

    inscripciones = (
        InscripcionMateriaEstudiante.objects.filter(estudiante=estudiante)
        .select_related("materia", "comision")
        .order_by("-anio", "-created_at")
    )

    total = inscripciones.count()
    print(f"\n📚 INSCRIPCIONES A MATERIAS ({total} registros):")
    if total == 0:
        print("  (No posee inscripciones a materias registradas)")
        return

    for idx, ins in enumerate(inscripciones, 1):
        dt_local = ins.created_at.astimezone(TZ_ARG) if ins.created_at else None
        dt_str = dt_local.strftime("%d/%m/%Y %H:%M:%S hs") if dt_local else "Desconocida"
        comision_str = str(ins.comision) if ins.comision else "Sin comisión asignada"

        print(f"\n  [{idx}] {ins.materia.nombre}")
        print(f"      • Comisión: {comision_str}")
        print(f"      • Ciclo Lectivo / Año: {ins.anio}")
        print(f"      • Estado actual: {ins.get_estado_display()}")
        print(f"      • Registrado el: {dt_str} (Hora Argentina)")

        movimientos = ins.movimientos.all().order_by("fecha_hora")
        if movimientos.exists():
            print(f"      • Historial de Movimientos / Auditoría:")
            for mov in movimientos:
                mov_dt = mov.fecha_hora.astimezone(TZ_ARG) if mov.fecha_hora else None
                mov_dt_str = mov_dt.strftime("%d/%m/%Y %H:%M:%S hs") if mov_dt else "Desconocida"

                # Buscar datos del operador
                op_nombre = "Sistema / Desconocido"
                if mov.operador:
                    op_user = User.objects.filter(username=mov.operador).first()
                    if op_user:
                        op_nombre = f"{op_user.first_name} {op_user.last_name} (DNI/Usuario: {op_user.username})"
                    else:
                        op_nombre = f"Operador DNI {mov.operador}"

                detalle = f" | Motivo/Detalle: {mov.motivo_detalle}" if mov.motivo_detalle else ""
                print(f"          - [{mov.get_tipo_display()}] el {mov_dt_str} por {op_nombre}{detalle}")
        else:
            print(f"      • Historial de Movimientos: Sin movimientos de auditoría registrados.")

    print(f"\n============================================================\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python audit_student_inscriptions.py <DNI>")
        sys.exit(1)

    dni_param = sys.argv[1].strip()
    auditar_estudiante(dni_param)
