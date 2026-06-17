import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Estudiante, UserProfile
from django.contrib.auth.models import User

estudiantes_sin_persona = Estudiante.objects.filter(persona__isnull=True).count()
perfiles_sin_persona = UserProfile.objects.filter(persona__isnull=True).count()

print(f"--- RESULTADOS DIAGNOSTICO ---")
print(f"Estudiantes sin persona: {estudiantes_sin_persona}")
print(f"UserProfiles sin persona: {perfiles_sin_persona}")
