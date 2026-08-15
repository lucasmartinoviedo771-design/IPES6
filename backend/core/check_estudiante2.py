import os
import sys

import django

if sys.path[0] == '/app/core':
    sys.path.pop(0)
if '/app' not in sys.path:
    sys.path.insert(0, '/app')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.estudiantes.api.horarios_api import materias_plan
from core.models import Estudiante


class DummyUser:
    def __init__(self, est):
        self.estudiante = est
        self.roles = ['admin']
        self.is_superuser = True
        self.is_authenticated = True

class DummyRequest:
    def __init__(self, est):
        self.user = DummyUser(est)

# Test with the DNI from the screenshot
est = Estudiante.objects.get(persona__dni='43967212')
req = DummyRequest(est)

print("Calling materias_plan without plan_id...")
try:
    materias = materias_plan(req, dni=est.persona.dni)
    if isinstance(materias, tuple):
        print("ERROR:", materias)
    else:
        print(f"Success! Got {len(materias)} materias.")
except Exception as e:
    import traceback
    traceback.print_exc()
