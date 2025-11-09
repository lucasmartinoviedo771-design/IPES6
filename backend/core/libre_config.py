from __future__ import annotations

import unicodedata
from collections.abc import Mapping, Sequence


def _normalize(value: str) -> str:
    """Normalize strings to compare ignoring accents, dots, and extra spaces."""
    cleaned = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = cleaned.replace(".", " ").replace("-", " ").replace("_", " ")
    cleaned = cleaned.replace("º", "o").replace("°", "o")
    cleaned = "".join(char.lower() if char.isalnum() or char.isspace() else " " for char in cleaned)
    return " ".join(cleaned.split())


_RAW_ALLOWED: Mapping[str, Sequence[Sequence[str]]] = {
    "educacion inicial": [
        ["Pedagogia"],
        ["Psicologia Educacional"],
        ["Practicas del Lenguaje"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Historia y Politica Educacional"],
        ["Formacion Etica y Ciudadana"],
        ["Filosofia de la Educacion"],
        ["Sociologia de la Educacion"],
    ],
    "educacion especial": [
        ["Pedagogia"],
        ["Psicologia Educacional"],
        ["Historia Argentina y Latinoamericana"],
        ["Bases Neuropsicobiologicas del Desarrollo"],
        ["Filosofia de la Educacion"],
        ["Historia y Politica Educacional"],
        ["Sociologia de la Educacion"],
    ],
    "educacion primaria": [
        ["Practicas del Lenguaje"],
        ["Ciencias Naturales"],
        ["Introduccion a la Filosofia"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Pedagogia"],
        ["Psicologia de la Educacion"],
        ["Ciencias Sociales"],
        ["Historia y Politica de la Educacion", "Historia y Politica Educacional"],
        ["Filosofia de la Educacion"],
        ["Formacion Etica y Ciudadana"],
        ["Sociologia de la Educacion"],
    ],
    "educacion secundaria en biologia": [
        ["Introduccion a la Biologia"],
        ["Pedagogia"],
        ["Introduccion a la Filosofia"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Quimica General e Inorganica"],
        ["Quimica Organica"],
        ["Ciencia de la Tierra"],
        ["Psicologia de la Educacion", "Psicologia Educacional"],
        ["Biologia Celular y Molecular"],
        ["Historia y Politica Educacional", "Historia y Politica de la Educacion"],
        ["Microbiologia y Micologia"],
        ["Anatomia y Fisiologia"],
        ["Filosofia de la Educacion"],
        ["Ecologia"],
        ["Genetica"],
        ["Evolucion"],
        ["Sociologia de la Educacion"],
        ["Diversidad Vegetal"],
        ["Diversidad Animal"],
    ],
    "educacion secundaria en matematica": [
        ["Pedagogia"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Introduccion a la Filosofia"],
        ["Algebra I"],
        ["Geometria I a", "Geometria Ia"],
        ["Psicologia Educacional", "Psicologia de la Educacion"],
        ["Pre-calculo I", "Precalculo I"],
        ["Pre-calculo II", "Precalculo II"],
        ["Algebra II"],
        ["Historia y Politica Educacional", "Historia y Politica de la Educacion"],
        ["Analisis I"],
        ["Algebra III"],
        ["Geometria II"],
        ["Probabilidad y Estadistica"],
        ["Filosofia de la Educacion"],
        ["Analisis II"],
        ["Sociologia de la Educacion"],
        ["Geometria I b", "Geometria Ib"],
        ["Calculo Numerico"],
        ["Geometria III"],
        ["Analisis III"],
    ],
    "educacion secundaria en lengua y literatura": [
        ["Pedagogia"],
        ["Gramatica I"],
        ["Historia del Arte"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Introduccion a la Filosofia"],
        ["Introduccion a las Ciencias del Lenguaje"],
        ["Sociolinguistica"],
        ["Linguistica del Texto"],
        ["Gramatica II"],
        ["Literatura en Lengua Espanola I"],
        ["Literatura en Lengua Extranjera I"],
        ["Teoria Literaria"],
        ["Psicologia de la Educacion", "Psicologia Educacional"],
        ["Psicolinguistica"],
        ["Historia y Politica de la Educacion Argentina"],
        ["Filosofia de la Educacion"],
        ["Sociologia de la Educacion"],
        ["Historia de la Lengua Espanola"],
        ["Semiotica"],
        ["Logica"],
        ["Semantica y Pragmatica"],
    ],
    "educacion secundaria en historia": [
        ["Introduccion a la Filosofia"],
        ["Pedagogia"],
        ["Mundo Antiguo"],
        ["Psicologia de la Educacion", "Psicologia Educacional"],
        ["Teoria Social y Politica"],
        ["Filosofia de la Educacion"],
        ["Historia y Politica Educacional", "Historia y Politica de la Educacion"],
        ["Sociologia de la Educacion"],
    ],
    "educacion secundaria en geografia": [
        ["Introduccion a la Filosofia"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Pedagogia"],
        ["Psicologia Educacional", "Psicologia de la Educacion"],
        ["Geomorfologia"],
        ["Historia y Politica Educacional", "Historia y Politica de la Educacion"],
        ["Ecologia y Biogeografia"],
        ["Filosofia de la Educacion"],
        ["Sociologia de la Educacion"],
        ["Proceso de Construccion del Territorio"],
        ["Geografia de las Redes y de la Circulacion"],
    ],
    "certificacion docente para profesionales": [
        ["Pedagogia"],
        ["Historia Social Argentina y Latinoamericana"],
        ["Psicologia Educacional", "Psicologia de la Educacion"],
        ["Historia y Politica Educacional", "Historia y Politica de la Educacion"],
        ["Sujeto de la Educacion I", "Sujeto de la Educa I"],
        ["Sujeto de la Educacion II"],
    ],
}


def _build_allowed() -> list[dict[str, set[str]]]:
    compiled: list[dict[str, set[str]]] = []
    for key, materias in _RAW_ALLOWED.items():
        compiled.append(
            {
                "slug": _normalize(key),
                "materias": {_normalize(alias) for aliases in materias for alias in aliases},
            }
        )
    return compiled


_ALLOWED_PROFESORADOS = _build_allowed()


def _find_profesorado_entry(nombre: str | None):
    if not nombre:
        return None
    normalized = _normalize(nombre)
    for entry in _ALLOWED_PROFESORADOS:
        if entry["slug"] in normalized:
            return entry
    return None


def materia_permite_mesa_libre(materia) -> bool:
    """Return True if the materia can open Libre exam mesas."""
    if materia is None or getattr(materia, "plan_de_estudio", None) is None:
        return False
    plan = materia.plan_de_estudio
    profesorado = getattr(plan, "profesorado", None)
    entry = _find_profesorado_entry(getattr(profesorado, "nombre", None))
    if not entry:
        return False
    materia_nombre = _normalize(getattr(materia, "nombre", ""))
    return materia_nombre in entry["materias"]


def profesorado_libre_materias(profesorado_nombre: str | None) -> set[str]:
    """Helper for introspection/testing."""
    entry = _find_profesorado_entry(profesorado_nombre)
    if not entry:
        return set()
    return set(entry["materias"])


def materias_libres_for_profesorado(profesorado_nombre: str | None) -> set[str]:
    """Alias kept for backwards compat / readability."""
    return profesorado_libre_materias(profesorado_nombre)


def normalizer(value: str) -> str:
    """Expose normalizer for tests."""
    return _normalize(value)
