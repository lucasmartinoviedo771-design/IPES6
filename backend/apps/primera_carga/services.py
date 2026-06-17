from .services.utils import (
    obtener_regularidad_metadata,
    obtener_docentes_metadata,
    obtener_estudiantes_metadata,
)
from .services.planillas import (
    crear_planilla_regularidad,
    obtener_planilla_regularidad_detalle,
    actualizar_planilla_regularidad,
)
from .services.importacion import (
    process_estudiantes_csv,
    process_folios_finales_csv,
    process_equivalencias_csv,
    crear_estudiante_manual,
    registrar_regularidad_individual_historica,
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
