
import os
import django
import sys

# Setup django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import MesaExamen, ActaExamen, InscripcionMesa
from django.utils import timezone

now = timezone.now()
mesas_futuras = MesaExamen.objects.filter(fecha__year=2026).order_by('fecha')

print(f"{'Mesa ID':<8} | {'Tipo':<4} | {'Fecha':<12} | {'Materia':<40} | {'Inscriptos':<10} | {'Actas con esa fecha'}")
print("-" * 100)

for m in mesas_futuras:
    inscriptos = m.inscripciones.count()
    actas = ActaExamen.objects.filter(fecha=m.fecha, materia=m.materia)
    actas_info = ", ".join([str(a.id) for a in actas])
    materia_nombre = (m.materia.nombre[:37] + '...') if m.materia and len(m.materia.nombre) > 40 else (m.materia.nombre if m.materia else "N/A")
    print(f"{m.id:<8} | {m.tipo:<4} | {str(m.fecha):<12} | {materia_nombre:<40} | {inscriptos:<10} | {actas_info}")
