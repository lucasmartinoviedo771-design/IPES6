from decimal import Decimal, InvalidOperation
from django.db.models import Q
from core.models import (
    ActaExamenAlumno,
    InscripcionMesa,
    Regularidad,
    Estudiante,
    Materia,
    EquivalenciaDisposicionDetalle,
)

def estudiante_tiene_materia_aprobada(estudiante: Estudiante, materia: Materia) -> bool:
    """
    Verifica si el estudiante ya tiene aprobada la materia indicada.
    Se considera aprobada si:
    1. Tiene una Regularidad con situación PROMOCIONADO o APROBADO (sin final).
    2. Tiene una InscripcionMesa con condición APROBADO.
    3. Tiene un ActaExamenAlumno con calificación >= 6 (numérica).
    4. Tiene una EquivalenciaDisposicionDetalle para esa materia.
    """
    # 1. Regularidades (Promoción o Aprobado directo)
    if Regularidad.objects.filter(
        estudiante=estudiante,
        materia=materia,
        situacion__in=[
            Regularidad.Situacion.PROMOCIONADO,
            Regularidad.Situacion.APROBADO,
        ],
    ).exists():
        return True

    # 2. Mesas de Examen (Finales aprobados)
    if InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia=materia,
        condicion=InscripcionMesa.Condicion.APROBADO,
    ).exists():
        return True

    # 3. Actas de Examen (Documento final)
    # Buscamos en actas donde el alumno tenga nota numérica >= 6.
    # Las notas no numéricas (AJ, AI) no son aprobados.
    actas_qs = ActaExamenAlumno.objects.filter(
        dni=estudiante.dni,
        acta__materia=materia
    )
    for acta_alumno in actas_qs:
        nota_str = acta_alumno.calificacion_definitiva
        try:
            valor = Decimal(nota_str.replace(",", "."))
            if valor >= 6:
                return True
        except (ValueError, InvalidOperation):
            pass

    # 4. Equivalencias (Disposiciones)
    # Aunque las equivalencias generan Actas, verificamos la disposición por si acaso.
    if EquivalenciaDisposicionDetalle.objects.filter(
        disposicion__estudiante=estudiante,
        materia=materia
    ).exists():
        return True

    return False
