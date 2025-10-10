from ninja import Router
from django.db import connection

router = Router(tags=["health"])

@router.get("/health")
def health(request):
    # Check DB with a trivial query
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
            row = c.fetchone()
            db_ok = (row == (1,))
    except Exception:
        db_ok = False

    return {
        "ok": db_ok,          # True si la DB respondió
        "service": "IPES API",
        "version": "1.0.0",   # si tenés versionado, reemplaza
    }
