
import os
import django
import sys

# Setup django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import MesaExamen
from django.utils import timezone

now = timezone.now()
print(f"Current time: {now}")

# Buscamos mesas con fecha >= hoy
mesas_futuras = MesaExamen.objects.filter(fecha__gte=now.date()).order_by('fecha')
print(f"Total future mesas: {mesas_futuras.count()}")

for mesa in mesas_futuras:
    inscriptos_count = mesa.inscripciones.count()
    materia_nombre = mesa.materia.nombre if mesa.materia else "N/A"
    print(f"ID: {mesa.id} | Codigo: {mesa.codigo} | Materia: {materia_nombre} | Fecha: {mesa.fecha} | Tipo: {mesa.tipo} | Inscriptos: {inscriptos_count} | Creada: {mesa.created_at}")
