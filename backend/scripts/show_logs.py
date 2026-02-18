from core.models import SystemLog
from django.db.models import Count

total = SystemLog.objects.filter(resuelto=False).count()
print(f'Total alertas activas: {total}')
print()

por_tipo = SystemLog.objects.filter(resuelto=False).values('tipo').annotate(cnt=Count('id')).order_by('-cnt')
for t in por_tipo:
    print(f"  {t['tipo']}: {t['cnt']}")

print()
print('=== DETALLE ===')
for log in SystemLog.objects.filter(resuelto=False).order_by('tipo', 'id'):
    print(f"[{log.tipo}] {log.mensaje}")
    if log.metadata:
        dni = log.metadata.get('dni','')
        codigo = log.metadata.get('codigo','')
        planilla_id = log.metadata.get('planilla_id','')
        acta_id = log.metadata.get('acta_id','')
        discs = log.metadata.get('discrepancies', [])
        print(f"  DNI={dni} | Planilla={planilla_id} ({codigo}) | Acta={acta_id}")
        for d in discs:
            print(f"  -> {d}")
    print()
