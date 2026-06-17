from .services.importacion import (
    crear_estudiante_manual,
    process_equivalencias_csv,
    process_estudiantes_csv,
    process_folios_finales_csv,
    registrar_regularidad_individual_historica,
)
from .services.planillas import (
    actualizar_planilla_regularidad,
    crear_planilla_regularidad,
    obtener_planilla_regularidad_detalle,
)
from .services.utils import (
    obtener_docentes_metadata,
    obtener_estudiantes_metadata,
    obtener_regularidad_metadata,
)

# Mantener compatibilidad con imports directos si los hubiera
__all__ = [
    "obtener_regularidad_metadata",
    "obtener_docentes_metadata",
    "obtener_estudiantes_metadata",
    "crear_planilla_regularidad",
    "obtener_planilla_regularidad_detalle",
    "actualizar_planilla_regularidad",
    "process_estudiantes_csv",
    "process_folios_finales_csv",
    "process_equivalencias_csv",
    "crear_estudiante_manual",
    "registrar_regularidad_individual_historica",
]
