# apps/carreras/views.py
from django.db import connection
from django.http import JsonResponse


def carreras_json(request):
    """Fallback sin NinjaAPI: GET /api/carreras -> [{id, nombre}] desde core_profesorado"""
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT id, nombre FROM core_profesorado ORDER BY nombre ASC")
            rows = cur.fetchall()
        data = [{"id": r[0], "nombre": r[1]} for r in rows]
        return JsonResponse(data, safe=False, status=200)
    except Exception as e:
        return JsonResponse({"detail": str(e)}, status=500)
