import re


def normalizar_apellido(apellido: str | None) -> str:
    """
    Normaliza el apellido para que quede SIEMPRE en MAYÚSCULAS completas.
    Elimina espacios redundantes.
    Ej: "alvarado henke" -> "ALVARADO HENKE"
    """
    if not apellido:
        return ""
    # Limpiar espacios múltiples y pasar a mayúsculas
    return " ".join(apellido.strip().split()).upper()


def normalizar_nombres(nombre: str | None) -> str:
    """
    Normaliza el/los nombres para que cada palabra comience en Mayúscula y el resto en minúscula.
    Conserva preposiciones o partículas comunes y maneja acentos.
    Ej: "facundo adrian" -> "Facundo Adrian"
        "MARÍA JOSÉ" -> "María José"
    """
    if not nombre:
        return ""

    palabras = nombre.strip().split()
    resultado = []

    # Lista de partículas que suelen ir en minúscula en nombres intermedios salvo que sea la primera palabra
    particulas_minus = {"de", "del", "la", "las", "los", "y", "e", "da", "di", "van", "von"}

    for i, p in enumerate(palabras):
        p_lower = p.lower()
        if i > 0 and p_lower in particulas_minus:
            resultado.append(p_lower)
        else:
            # Capitalizar la primera letra respetando caracteres con tildes / ñ
            resultado.append(p_lower.capitalize())

    return " ".join(resultado)
