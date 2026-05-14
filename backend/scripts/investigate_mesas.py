
import os
import django
import sys

# Setup django
sys.path.append('/home/ipesrg/sistema-gestion/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import MesaExamen
from django.utils import timezone

now = timezone.now()
print(f"Current time: {now}")

mesas_futuras = MesaExamen.objects.filter(fecha__gte=now.date()).order_by('fecha')
print(f"Total future mesas: {mesas_futuras.count()}")

for mesa in mesas_futuras:
    print(f"ID: {mesa.id} | Codigo: {mesa.codigo} | Materia: {mesa.materia.nombre if mesa.materia else 'N/A'} | Fecha: {mesa.fecha} | Tipo: {mesa.tipo} | Creada: {mesa.created_at}")
