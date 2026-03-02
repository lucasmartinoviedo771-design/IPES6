import os
import django
import sys
from pathlib import Path

# Configurar Django
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from core.models import Docente
from django.db import transaction

def sync_user_names():
    print("Iniciando sincronización de nombres de usuarios desde la tabla Docentes...")
    
    docentes = Docente.objects.all()
    docente_map = {d.dni: d for d in docentes}
    
    users_to_update = User.objects.filter(first_name="", last_name="")
    count = 0
    
    with transaction.atomic():
        for u in users_to_update:
            if u.username in docente_map:
                doc = docente_map[u.username]
                u.first_name = doc.nombre[:30]
                u.last_name = doc.apellido[:30]
                u.save()
                count += 1
                if count % 100 == 0:
                    print(f"Procesados {count} usuarios...")
                    
    print(f"Sincronización completada. Se actualizaron {count} usuarios.")

if __name__ == "__main__":
    sync_user_names()
