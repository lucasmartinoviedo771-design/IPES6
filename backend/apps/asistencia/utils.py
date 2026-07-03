import math

from django.conf import settings

# Constantes de geolocalización de la institución
# Se pueden configurar en el .env (settings) o usar estos por defecto.
# Coordenadas por defecto (ejemplo: Buenos Aires, Obelisco)
INSTITUTE_LATITUDE = getattr(settings, "INSTITUTE_LATITUDE", -53.791367)
INSTITUTE_LONGITUDE = getattr(settings, "INSTITUTE_LONGITUDE", -67.714315)
# Tolerancia en metros
MAX_DISTANCE_METERS = getattr(settings, "MAX_DISTANCE_METERS", 100)


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcula la distancia en metros entre dos puntos GPS usando la fórmula de Haversine.
    """
    # Radio de la Tierra en metros
    R = 6371000.0

    # Convertir grados a radianes
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Fórmula de Haversine
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Distancia en metros
    distance = R * c
    return distance
