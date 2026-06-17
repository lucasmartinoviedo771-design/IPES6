import os
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from core.models.base import Persona
from core.models.estudiantes import Estudiante, EstudianteCarrera
from core.models.carreras import Profesorado
from core.models import Docente, PlanillaRegularidadDocente, PlanillaRegularidadFila

class Command(BaseCommand):
    help = "Aplica de golpe las 4 reparaciones pedidas en DEV hacia PRODUCCIÓN."

    def handle(self, *args, **options):
        self.stdout.write("--- INICIANDO BARRIDO DE REPARACIONES ---")
        
        # 1. Ajustes específicos de Estudiantes
        self.stdout.write(">> 1. Arreglando 41737709, 40990008 y Antonela Garay")
        p1 = Persona.objects.filter(dni='41737709').first()
        if p1:
            p1.nombre = 'Brenda Natalia'
            p1.apellido = 'SÁNCHEZ'
            p1.save()
            if hasattr(p1, 'user') and p1.user:
                p1.user.first_name = p1.nombre
                p1.user.last_name = p1.apellido
                p1.user.save()

        p2 = Persona.objects.filter(dni='40990008').first()
        if p2:
            p2.nombre = 'Matías Sebastián'
            p2.apellido = 'PAULETTI'
            p2.save()
            if hasattr(p2, 'user') and p2.user:
                p2.user.first_name = p2.nombre
                p2.user.last_name = p2.apellido
                p2.user.save()

        p_32 = Persona.objects.filter(dni='32696384').first()
        if p_32:
            try:
                with transaction.atomic():
                    e_32 = getattr(p_32, 'estudiante_perfil', None)
                    if e_32: e_32.delete()
                    if hasattr(p_32, 'user') and p_32.user: p_32.user.delete()
                    p_32.delete()
            except Exception as e:
                self.stdout.write(f"Error eliminando duplicado 32696384: {e}")

        # 2. Mayúsculas
        self.stdout.write(">> 2. Pasando apellidos a MAYÚSCULA")
        for p in Persona.objects.all():
            if p.apellido and not p.apellido.isupper():
                p.apellido = p.apellido.upper()
                p.save()
                if hasattr(p, 'user') and p.user:
                    p.user.last_name = p.apellido
                    p.user.save()

        # 3. Docentes y Estudiantes Fantasmas
        self.stdout.write(">> 3. Arreglando docentes y estudiantes fantasmas de planillas")
        for d in PlanillaRegularidadDocente.objects.filter(docente__isnull=True):
            nombre_completo = d.nombre.strip() if d.nombre else ""
            if not nombre_completo: continue
            dni = d.dni
            if not dni:
                prefix = "DOC-HIS-"
                count = Persona.objects.filter(dni__startswith=prefix).count()
                seq = count + 1
                new_dni = f"{prefix}{seq:04d}"
                while Persona.objects.filter(dni=new_dni).exists():
                    seq += 1
                    new_dni = f"{prefix}{seq:04d}"
                dni = new_dni
                d.dni = dni
            
            last_name, first_name = [p.strip() for p in nombre_completo.split(",", 1)] if "," in nombre_completo else (nombre_completo, "-")
            persona_obj, _ = Persona.objects.update_or_create(dni=dni, defaults={"nombre": first_name, "apellido": last_name})
            docente_obj, _ = Docente.objects.get_or_create(persona=persona_obj)
            d.docente = docente_obj
            d.save()

        for f in PlanillaRegularidadFila.objects.filter(estudiante__isnull=True):
            nombre_completo = f.apellido_nombre.strip() if f.apellido_nombre else ""
            if not nombre_completo: continue
            dni = f.dni
            if not dni:
                prefix = f"HIS-{f.planilla.profesorado.id:02d}-"
                count = Estudiante.objects.filter(persona__dni__startswith=prefix).count()
                seq = count + 1
                new_dni = f"{prefix}{seq:04d}"
                while Estudiante.objects.filter(persona__dni=new_dni).exists():
                    seq += 1
                    new_dni = f"{prefix}{seq:04d}"
                dni = new_dni
                f.dni = dni

            last_name, first_name = [p.strip() for p in nombre_completo.split(",", 1)] if "," in nombre_completo else (nombre_completo, "-")
            user_obj = User.objects.filter(username=dni).first() or User.objects.create_user(username=dni, password=dni, first_name=first_name, last_name=last_name)
            persona_obj, _ = Persona.objects.update_or_create(dni=dni, defaults={"nombre": first_name, "apellido": last_name})
            est_obj, _ = Estudiante.objects.get_or_create(persona=persona_obj, defaults={"user": user_obj, "estado_legajo": Estudiante.EstadoLegajo.PENDIENTE})
            f.estudiante = est_obj
            f.save()

        # 4. Estados Académicos de Primaria
        self.stdout.write(">> 4. Aplicando lista de ACTIVOS/BAJA al Profesorado de Primaria")
        dnis_raw = """
        47185237
37515246
44949796
48056547
46182919
46049734
40494457
40000467
44996779
47904733
47818091
32527507
35709211
45273367
36552045
44137102
37173710
40844658
41631235
33564685
34484042
25706440
42222649
43074567
39999253
39999683
46653618
46554585
45022253
45878685
46860405
35885360
38786254
45618465
47935129
43790777
36281304
35480127
45273122
43623985
45.887.658
39392562
93920904
33940123
40000876
46554983
44658792
18843946
41951184
38786577
45367696
43002998
43520177
41402856
37909287
32607243
42650362
41903914
47357823
46810201
44577151
41402985
43478259
46228723
94660649
48118109
47934692
29178883
34151718
43795909
42072574
39876075
39999327
46666896
40986211
38088914
26976423
18887366
45618400
44051240
44748829
43111516
46554641
38780462
36113822
41402618
47927391
36878780
36867339
41402828
31410493
43691329
42830928
35549040
37908973
38593276
46554763
33639806
42707629
32877213
35885367
37188992
43273783
38780472
47144089
38785968
48118253
36337521
95258670
41486970
48354843
        """
        dnis_list = [d.replace(".", "").strip() for d in dnis_raw.splitlines() if d.strip()]
        
        # Enrolar Roxana Millapel (38785968) si es necesario a Primaria
        p_millapel = Persona.objects.filter(dni="38785968").first()
        primaria = Profesorado.objects.filter(nombre__icontains="primaria").first()
        if p_millapel and hasattr(p_millapel, 'estudiante_perfil') and primaria:
            EstudianteCarrera.objects.get_or_create(estudiante=p_millapel.estudiante_perfil, profesorado=primaria, defaults={"estado_academico": "ACT", "anio_ingreso": 2024})
        
        # Actualizamos todos a ACT, luego aplicamos bajas a primaria
        EstudianteCarrera.objects.all().update(estado_academico="ACT")
        
        if primaria:
            q_primaria = EstudianteCarrera.objects.filter(profesorado=primaria)
            q_primaria.exclude(estudiante__persona__dni__in=dnis_list).update(estado_academico="BAJ")
            q_primaria.filter(estudiante__persona__dni__in=dnis_list).update(estado_academico="ACT")

        self.stdout.write("--- LISTO: TODO REPARADO SEGÚN PARÁMETROS DE DEV ---")
