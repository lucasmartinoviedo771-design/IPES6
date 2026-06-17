import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User

from core.models import Estudiante, UserProfile

estudiantes_sin_persona = Estudiante.objects.filter(persona__isnull=True).count()
perfiles_sin_persona = UserProfile.objects.filter(persona__isnull=True).count()

print("--- RESULTADOS DIAGNOSTICO ---")
print(f"Estudiantes sin persona: {estudiantes_sin_persona}")
print(f"UserProfiles sin persona: {perfiles_sin_persona}")
