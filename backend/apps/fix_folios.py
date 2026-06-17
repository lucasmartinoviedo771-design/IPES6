from core.models import Estudiante
from django.db import connection

def fix_folios():
    with connection.cursor() as cursor:
        print("Fixing folios_oficio values...")
        cursor.execute("UPDATE core_estudiante SET folios_oficio = 1 WHERE folios_oficio > 1")
        cursor.execute("UPDATE core_estudiante SET folios_oficio = 0 WHERE folios_oficio IS NULL")
        print("Done.")

if __name__ == "__main__":
    import django
    django.setup()
    fix_folios()
