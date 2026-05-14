from core.models import Estudiante, PreinscripcionChecklist

def sync_all():
    fields = [
        "dni_legalizado", "fotos_4x4", "certificado_salud", "folios_oficio",
        "titulo_secundario_legalizado", "certificado_titulo_en_tramite",
        "analitico_legalizado", "certificado_alumno_regular_sec",
        "adeuda_materias", "adeuda_materias_detalle", "escuela_secundaria",
        "es_certificacion_docente", "titulo_terciario_univ", "incumbencia",
        "curso_introductorio_aprobado", "libreta_entregada", "articulo_7"
    ]
    
    # 1. Sync Checklist -> Estudiante for any discrepancies
    # We prioritize Checklist if it has data and Estudiante doesn't (legacy migration)
    # But since user said "Ficha is correct", we'll sync Estudiante -> Checklist
    
    count_cl = 0
    count_extra = 0
    
    for est in Estudiante.objects.all():
        # Update checklists from student
        checklists = PreinscripcionChecklist.objects.filter(preinscripcion__alumno=est)
        for cl in checklists:
            cl_changed = False
            for f in fields:
                if hasattr(cl, f) and hasattr(est, f):
                    v_est = getattr(est, f)
                    v_cl = getattr(cl, f)
                    if v_est != v_cl:
                        setattr(cl, f, v_est)
                        cl_changed = True
            if cl_changed:
                cl.save()
                count_cl += 1
        
        # Update datos_extra from student fields
        extra_changed = False
        if not isinstance(est.datos_extra, dict):
            est.datos_extra = {}
        if "documentacion" not in est.datos_extra:
            est.datos_extra["documentacion"] = {}
        
        for f in fields:
            val = getattr(est, f, None)
            if val is not None:
                if est.datos_extra["documentacion"].get(f) != val:
                    est.datos_extra["documentacion"][f] = val
                    extra_changed = True
        
        if extra_changed:
            est.save()
            count_extra += 1
            
    print(f"Synchronized {count_cl} checklists and {count_extra} student datos_extra dicts")

if __name__ == "__main__":
    import django
    django.setup()
    sync_all()
