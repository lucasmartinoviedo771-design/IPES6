import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.estudiantes.api.trayectoria_api import trayectoria_estudiante
from django.contrib.auth.models import User
from core.models import Estudiante

# Mock request object
class MockRequest:
    def __init__(self, user, dni):
        self.user = user
        self.query_params = {'dni': dni}
        self.method = 'GET'

# Get an admin user
admin = User.objects.filter(is_superuser=True).first()
if not admin:
    admin = User.objects.first()

try:
    print("Testing trayectoria_estudiante for DNI 34484042 as admin", admin.username)
    # The actual function expects 'dni' as a keyword argument from Ninja Router if defined in path or query
    # But here we are calling it directly.
    # Ninja's router call looks like: trajetória_estudiante(request, dni='34484042')
    res = trayectoria_estudiante(MockRequest(admin, '34484042'), dni='34484042')
    print("Result:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
