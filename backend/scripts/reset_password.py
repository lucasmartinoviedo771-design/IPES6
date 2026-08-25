import sys
import os
import django

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()

def reset_password(username_or_dni: str, new_password: str = None):
    u = User.objects.filter(username=username_or_dni).first()
    if not u:
        print(f"Error: Usuario con DNI/username '{username_or_dni}' no encontrado.")
        return

    password_to_set = new_password if new_password else username_or_dni
    u.password = make_password(password_to_set)
    u.save()
    print(f"Contraseña de '{username_or_dni}' reseteada exitosamente.")

    # Si es un perfil de estudiante, marcar cambio de clave obligatorio
    persona = getattr(u, 'persona', None)
    if persona and hasattr(persona, 'estudiante'):
        est = persona.estudiante
        est.must_change_password = True
        est.save()
        print("Flag 'must_change_password' activado en el legajo del estudiante.")

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        dni = sys.argv[1].strip()
        pwd = sys.argv[2].strip() if len(sys.argv) >= 3 else None
        reset_password(dni, pwd)
    else:
        print("Uso: python reset_password.py <DNI_O_USERNAME> [NUEVA_CONTRASENA]")
