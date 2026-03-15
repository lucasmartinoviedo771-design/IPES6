from .utils import (
    obtener_regularidad_metadata as _obtener_regularidad_metadata_legacy,
    _regularidad_metadata_for_user,
)
from .planillas import (
    crear_planilla_regularidad,
    obtener_planilla_regularidad_detalle,
    actualizar_planilla_regularidad,
)
from .importacion import (
    process_estudiantes_csv,
    process_folios_finales_csv,
    process_equivalencias_csv,
    crear_estudiante_manual,
    registrar_regularidad_individual_historica,
)

# Alias para mantener compatibilidad con el código que importaba desde services.py antes
def obtener_regularidad_metadata(user, include_all=False):
    return _regularidad_metadata_for_user(user, include_all=include_all)
