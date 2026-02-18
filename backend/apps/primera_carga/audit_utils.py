from decimal import Decimal
from core.models import (
    Regularidad, 
    PlanillaRegularidadFila, 
    SystemLog, 
    ActaExamenEstudiante, 
    InscripcionMesa, 
    MesaExamen, 
    EquivalenciaDisposicionDetalle,
    ActaExamen
)

def verify_regularidad_consistency(planilla_fila: PlanillaRegularidadFila) -> None:
    """
    Checks if the Regularidad (Historial) matches the Planilla (Visual).
    If not, logs a SystemLog entry.
    """
    est = planilla_fila.estudiante
    if not est:
        return
        
    materia = planilla_fila.planilla.materia
    fecha = planilla_fila.planilla.fecha
    
    # We expect a regularidad record matching this student/subject AND date
    regs = Regularidad.objects.filter(estudiante=est, materia=materia, fecha_cierre=fecha)
    
    if not regs.exists():
        # Fallback to newest if date doesn't match exactly? No, if it's a planilla from a date, 
        # it MUST have a corresponding record on that date.
        SystemLog.objects.create(
            tipo="REGULARIDAD_MISMATCH",
            mensaje=f"MISSING REGULARIDAD: Student {est.dni} / Subject '{materia.nombre}' has Planilla ({fecha}) but NO history record on that date.",
            metadata={
                "dni": est.dni,
                "materia_id": materia.id,
                "fecha": str(fecha),
                "planilla_id": planilla_fila.planilla.id,
                "codigo": planilla_fila.planilla.codigo,
                "folio": planilla_fila.planilla.folio,
                "planilla_fila_id": planilla_fila.id,
            }
        )
        return

    target_reg = regs.first()
    
    # Check values
    mismatches = []
    
    # Situacion
    if target_reg.situacion != planilla_fila.situacion:
        mismatches.append(f"Situacion: Planilla='{planilla_fila.situacion}' vs Historial='{target_reg.situacion}'")
        
    # Nota
    nota_f = planilla_fila.nota_final
    nota_r = target_reg.nota_final_cursada
    
    nota_match = False
    if nota_f is None and nota_r is None:
        nota_match = True
    elif nota_f is not None and nota_r is not None:
            if int(nota_f) == int(nota_r):
                nota_match = True
    
    if not nota_match:
        mismatches.append(f"Nota: Planilla={nota_f} vs Historial={nota_r}")
        
    if mismatches:
        SystemLog.objects.create(
            tipo="REGULARIDAD_MISMATCH",
            mensaje=f"DISCREPANCY: Student {est.dni} / Subject '{materia.nombre}'. {'; '.join(mismatches)}",
            metadata={
                "dni": est.dni,
                "materia_id": materia.id,
                "fecha": str(fecha),
                "planilla_id": planilla_fila.planilla.id,
                "codigo": planilla_fila.planilla.codigo,
                "folio": planilla_fila.planilla.folio,
                "planilla_fila_id": planilla_fila.id,
                "discrepancies": mismatches
            }
        )

def verify_acta_consistency(acta_est: ActaExamenEstudiante) -> None:
    """
    Checks if the Trajectory (InscripcionMesa) matches the ActaExamen (Visual).
    """
    dni = acta_est.dni
    materia = acta_est.acta.materia
    fecha = acta_est.acta.fecha
    libro = acta_est.acta.libro
    folio = acta_est.acta.folio
    
    # Matching modality
    modMap = {ActaExamen.Tipo.REGULAR: MesaExamen.Modalidad.REGULAR, ActaExamen.Tipo.LIBRE: MesaExamen.Modalidad.LIBRE}
    modality = modMap.get(acta_est.acta.tipo)
    
    # Find the corresponding Mesa
    mesa = MesaExamen.objects.filter(materia=materia, fecha=fecha, modalidad=modality).first()
    if not mesa:
        return # Cannot verify if mesa doesn't exist (though it should have been created)

    # Find InscripcionMesa
    insc = InscripcionMesa.objects.filter(mesa=mesa, estudiante__dni=dni).first()
    
    if not insc:
        SystemLog.objects.create(
            tipo="ACTA_MISMATCH",
            mensaje=f"MISSING EXAM RECORD: Student {dni} / Subject '{materia.nombre}' has Acta entry but NO history record.",
            metadata={
                "dni": dni,
                "materia_id": materia.id,
                "acta_est_id": acta_est.id,
                "acta_id": acta_est.acta.id,
                "codigo": acta_est.acta.codigo,
                "fecha": str(fecha),
                "libro": libro,
                "folio": folio
            }
        )
        return

    mismatches = []
    
    # Precise mapping for absence types and grades
    nota_visual = acta_est.calificacion_definitiva.strip().upper()
    actual_cond = insc.condicion
    
    expected_cond = None
    cond_label = ""
    if nota_visual == "AJ":
        expected_cond = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
        cond_label = "AUSENTE JUSTIFICADO"
    elif nota_visual == "AI":
        expected_cond = InscripcionMesa.Condicion.AUSENTE
        cond_label = "AUSENTE INJUSTIFICADO"
    else:
        try:
            v = Decimal(nota_visual.replace(",", "."))
            expected_cond = InscripcionMesa.Condicion.APROBADO if v >= 6 else InscripcionMesa.Condicion.DESAPROBADO
            cond_label = "APROBADO" if v >= 6 else "DESAPROBADO"
        except:
            expected_cond = InscripcionMesa.Condicion.DESAPROBADO
            cond_label = "DESAPROBADO"

    if actual_cond != expected_cond:
        mismatches.append(f"Condicion: Acta='{nota_visual}' ({cond_label}) vs Historial='{actual_cond}'")

    # Nota comparison (only if numeric)
    nota_acta = None
    try:
        nota_acta = Decimal(nota_visual.replace(",", "."))
    except: pass
    
    nota_hist = insc.nota
    
    if nota_acta is not None and nota_acta != nota_hist:
        mismatches.append(f"Nota: Acta={nota_acta} vs Historial={nota_hist}")

    if mismatches:
        SystemLog.objects.create(
            tipo="ACTA_MISMATCH",
            mensaje=f"DISCREPANCY EXAM: Student {dni} / Subject '{materia.nombre}'. {'; '.join(mismatches)}",
            metadata={
                "dni": dni,
                "materia_id": materia.id,
                "acta_materia_nombre": materia.nombre,
                "acta_id": acta_est.acta.id,
                "codigo": acta_est.acta.codigo,
                "fecha": str(fecha),
                "acta_est_id": acta_est.id,
                "libro": libro,
                "folio": folio,
                "discrepancies": mismatches
            }
        )

def verify_equivalencia_consistency(eq_detalle: EquivalenciaDisposicionDetalle) -> None:
    """
    Checks if the Equivalency Disposition Detail matches the auto-generated Acta.
    """
    est = eq_detalle.disposicion.estudiante
    materia = eq_detalle.materia
    num_dispo = eq_detalle.disposicion.numero_disposicion
    
    # Equivalencies create an acta with code: EQUIV-{materia.id}-{estudiante.dni}-{numero_disposicion}
    codigo = f"EQUIV-{materia.id}-{est.dni}-{num_dispo}"
    
    acta_est = ActaExamenEstudiante.objects.filter(
        acta__codigo=codigo,
        dni=est.dni
    ).first()
    
    if not acta_est:
        SystemLog.objects.create(
            tipo="EQUIVALENCIA_MISMATCH",
            mensaje=f"MISSING EQUIVALENCY ACTA: Student {est.dni} / Subject '{materia.nombre}' has Disposicion but NO Acta record.",
            metadata={
                "dni": est.dni,
                "materia_id": materia.id,
                "eq_detalle_id": eq_detalle.id,
                "codigo_esperado": codigo
            }
        )
        return

    mismatches = []
    if acta_est.calificacion_definitiva != str(eq_detalle.nota):
        mismatches.append(f"Nota: Disposicion='{eq_detalle.nota}' vs Acta='{acta_est.calificacion_definitiva}'")
        
    if mismatches:
        SystemLog.objects.create(
            tipo="EQUIVALENCIA_MISMATCH",
            mensaje=f"DISCREPANCY EQUIVALENCY: Student {est.dni} / Subject '{materia.nombre}'. {'; '.join(mismatches)}",
            metadata={
                "dni": est.dni,
                "materia_id": materia.id,
                "eq_detalle_id": eq_detalle.id,
                "discrepancies": mismatches
            }
        )

