import os
import sys

import django

if sys.path[0] == '/app/core':
    sys.path.pop(0)
if '/app' not in sys.path:
    sys.path.insert(0, '/app')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.estudiantes.api.helpers.misc_utils import _tiene_aprobacion_valida
from core.models import Correlatividad, Estudiante, Materia

try:
    est = Estudiante.objects.get(persona__dni='40739608')
    mat_patagonico = Materia.objects.filter(nombre__icontains='Territorio Patagónico').first()
    reqs = Correlatividad.objects.filter(materia_origen=mat_patagonico, tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR)
    faltan = []
    for req in reqs:
        if not _tiene_aprobacion_valida(est, req.materia_correlativa):
            faltan.append(req.materia_correlativa.nombre)
    print('=== FALTANTES ===')
    for f in faltan:
        print(f)
    print('=================')
except Exception as e:
    print(f'ERROR: {e}')
