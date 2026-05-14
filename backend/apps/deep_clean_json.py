from core.models import Estudiante, Preinscripcion, Persona

def deep_clean_json():
    # Campos que ya tienen columna propia en Estudiante o Persona
    REDUNDANT_KEYS = [
        "dni_legalizado", "fotos_4x4", "certificado_salud", "folios_oficio", "folios_oficio_ok",
        "titulo_secundario_legalizado", "certificado_titulo_en_tramite", "analitico_legalizado",
        "articulo_7", "adeuda_materias", "adeuda_materias_detalle", "escuela_secundaria",
        "certificado_alumno_regular_sec", "es_certificacion_docente", "titulo_terciario_univ",
        "incumbencia", "curso_introductorio_aprobado", "libreta_entregada",
        "trabaja", "empleador", "horario_trabajo", "domicilio_trabajo",
        "cud_informado", "condicion_salud_informada", "condicion_salud_detalle",
        "sec_titulo", "sec_establecimiento", "sec_fecha_egreso", "sec_localidad", "sec_provincia", "sec_pais",
        "sup1_titulo", "sup1_establecimiento", "sup1_fecha_egreso", "sup1_localidad", "sup1_provincia", "sup1_pais",
        "nacionalidad", "estado_civil", "genero", "localidad_nac", "provincia_nac", "pais_nac",
        "tel_fijo", "tel_movil", "emergencia_telefono", "emergencia_parentesco",
        "dni", "nombres", "apellido", "nombre", "email", "telefono", "domicilio", "fecha_nacimiento", "cuil"
    ]

    print("Iniciando limpieza profunda de campos JSON...")

    # 1. Limpiar Estudiante.datos_extra
    est_count = 0
    for est in Estudiante.objects.all():
        if not isinstance(est.datos_extra, dict):
            continue
            
        changed = False
        # Eliminar diccionario de documentación si existe
        if "documentacion" in est.datos_extra:
            del est.datos_extra["documentacion"]
            changed = True
            
        # Eliminar cualquier otra clave redundante en la raíz
        for key in REDUNDANT_KEYS:
            if key in est.datos_extra:
                del est.datos_extra[key]
                changed = True
        
        if changed:
            est.save(update_fields=["datos_extra"])
            est_count += 1

    # 2. Limpiar Preinscripcion.datos_extra
    pre_count = 0
    for pre in Preinscripcion.objects.all():
        if not isinstance(pre.datos_extra, dict):
            continue
            
        changed = False
        # Eliminar claves redundantes
        for key in REDUNDANT_KEYS:
            if key in pre.datos_extra:
                del pre.datos_extra[key]
                changed = True
        
        # También buscar dentro de 'estudiante' si existe como sub-diccionario
        if "estudiante" in pre.datos_extra and isinstance(pre.datos_extra["estudiante"], dict):
            est_sub = pre.datos_extra["estudiante"]
            for key in REDUNDANT_KEYS:
                if key in est_sub:
                    del est_sub[key]
                    changed = True
            if not est_sub:
                del pre.datos_extra["estudiante"]
        
        if changed:
            pre.save(update_fields=["datos_extra"])
            pre_count += 1

    print(f"Limpieza finalizada. Estudiantes afectados: {est_count}, Preinscripciones afectadas: {pre_count}")

if __name__ == "__main__":
    import django
    django.setup()
    deep_clean_json()
