import json
from core.models import *
from apps.estudiantes.api.horarios_api import get_horarios_materia
est = Estudiante.objects.filter(persona__dni='41951184').first()
m = Materia.objects.filter(nombre__icontains='Actos Escolares', plan_de_estudio__profesorado__nombre__icontains='Primaria').first()
print('Materia:', m.nombre, 'ID:', m.id)
print('Tipo Formación:', m.tipo_formacion)
print('Horarios:', json.dumps(get_horarios_materia(m.id)))
