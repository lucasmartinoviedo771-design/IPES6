import logging

from core.models import Materia

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run():
    materias_actualizadas = 0
    todas_las_materias = Materia.objects.all()

    for materia in todas_las_materias:
        nombre_limpio = materia.nombre.strip()

        if nombre_limpio != materia.nombre:
            nombre_viejo = materia.nombre
            materia.nombre = nombre_limpio
            materia.save(update_fields=["nombre"])
            logger.info(f"Materia ID {materia.id} actualizada: '{nombre_viejo}' -> '{nombre_limpio}'")
            materias_actualizadas += 1

    logger.info(f"Proceso finalizado. Total de materias actualizadas: {materias_actualizadas}")


if __name__ == "__main__":
    run()
