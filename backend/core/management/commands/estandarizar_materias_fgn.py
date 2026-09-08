"""
Estandariza nombres de materias de Formación General.

Los cambios de comisión buscan la materia equivalente POR NOMBRE EXACTO, así que
un espacio escrito de dos formas distintas entre profesorados queda invisible: un
estudiante de Primaria no puede pasarse a la comisión de Inicial de la misma
materia porque, para el sistema, no es la misma.

Este comando unifica esas escrituras. Todos los casos son diferencias de tilde,
mayúscula, coma o espacio: ningún plan de estudios se distingue por eso. Los
espacios de Formación Específica NO se tocan, porque ahí las diferencias de
nombre sí pueden responder a planes distintos.

Se identifica cada materia por NOMBRE + PROFESORADO, nunca por id: los ids
difieren entre entornos y renombrarían la materia equivocada. Si un caso no
aparece, o aparece más de una vez, se informa y no se toca nada.

Uso:
    manage.py estandarizar_materias_fgn --dry-run   # informa sin escribir
    manage.py estandarizar_materias_fgn
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import ActaExamen, Materia, Regularidad

# (nombre actual, pista del profesorado, nombre nuevo, tipo_formacion nuevo o None)
CAMBIOS = [
    # --- Historia y Política Educacional ---
    ("Historia y PolÍtica Educacional", "Matemática", "Historia y Política Educacional", None),
    ("Historia y Politica de la Educación", "Lengua y Literatura", "Historia y Política Educacional", None),
    # --- Historia Social Argentina y Latinoamericana ---
    (
        "Historia Social, Argentina y Latinoamericana",
        "Certificación",
        "Historia Social Argentina y Latinoamericana",
        None,
    ),
    ("Historia Argentina y Latinoamerica", "Especial", "Historia Social Argentina y Latinoamericana", None),
    # --- Introducción a la Filosofía ---
    ("Introducción a la Filosofia", "Historia", "Introducción a la Filosofía", None),
    # --- EDI: Políticas de Inclusión en Educación (tenía 4 escrituras) ---
    ("EDI: Politicas de Inclusión en Educación", "Geografía", "EDI: Políticas de Inclusión en Educación", None),
    (
        "EDI: Politicas de Inclusión en Educación",
        "Lengua y Literatura",
        "EDI: Políticas de Inclusión en Educación",
        None,
    ),
    ("EDI: Políticas de inclusión en Educación", "Inicial", "EDI: Políticas de Inclusión en Educación", None),
    ("EDI: Políticas de inclusión en educación", "Biología", "EDI: Políticas de Inclusión en Educación", None),
    # --- EDI: Espacio de Definición Institucional ---
    ("EDI: Espacio de definición Institucional", "Especial", "EDI: Espacio de Definición Institucional", None),
    # --- Proyectos Educativos con TIC ---
    ("Proyectos Educativos con Tic", "Primaria", "Proyectos Educativos con TIC", None),
    ("Proyectos educativos con TIC", "Geografía", "Proyectos Educativos con TIC", None),
    # --- Formación Ética y Ciudadana: además pasa a Formación General ---
    # En Primaria figuraba como específica; en Inicial y Especial, como general.
    # Al ser general entra en los cambios de comisión.
    ("Formación Ética Y Ciudadana", "Primaria", "Formación Ética y Ciudadana", "FGN"),
]


class Command(BaseCommand):
    help = "Unifica la escritura de las materias de Formación General para que los cambios de comisión las encuentren."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra lo que haría sin escribir en la base.",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        if dry:
            self.stdout.write(self.style.WARNING("MODO SIMULACIÓN: no se escribe nada.\n"))

        aplicados, ya_estaban, problemas = 0, 0, []

        with transaction.atomic():
            for nombre_actual, pista_prof, nombre_nuevo, tipo_nuevo in CAMBIOS:
                etiqueta = f"'{nombre_actual}' ({pista_prof})"

                # La comparación se hace en Python, no en la base: la collation de
                # MySQL (utf8mb4_0900_ai_ci) ignora tildes y mayúsculas, así que un
                # filter(nombre="...PolÍtica...") tambien devuelve "...Política...".
                # Con eso no se puede saber si el cambio ya se aplicó.
                del_profesorado = list(
                    Materia.objects.filter(
                        nombre__iexact=nombre_actual,
                        plan_de_estudio__profesorado__nombre__icontains=pista_prof,
                    ).select_related("plan_de_estudio__profesorado")
                )
                candidatas = [m for m in del_profesorado if m.nombre == nombre_actual]

                if not candidatas:
                    # Nadie conserva la escritura vieja: o ya se aplicó, o no existe.
                    # Se busca el nombre nuevo aparte, porque en los casos donde
                    # cambia la redacción (no solo la tilde) no aparece en la
                    # consulta anterior.
                    ya = [
                        m
                        for m in Materia.objects.filter(
                            nombre__iexact=nombre_nuevo,
                            plan_de_estudio__profesorado__nombre__icontains=pista_prof,
                        )
                        if m.nombre == nombre_nuevo
                    ]
                    if tipo_nuevo:
                        ya = [m for m in ya if m.tipo_formacion == tipo_nuevo]
                    if ya:
                        ya_estaban += 1
                        self.stdout.write(f"  ya estaba   {etiqueta}")
                    else:
                        problemas.append(f"NO ENCONTRADA: {etiqueta}")
                        self.stdout.write(self.style.ERROR(f"  NO EXISTE   {etiqueta}"))
                    continue

                if len(candidatas) > 1:
                    # Ambiguo: se prefiere no tocar nada antes que renombrar la equivocada.
                    detalle = ", ".join(f"#{m.id} ({m.plan_de_estudio.resolucion})" for m in candidatas)
                    problemas.append(f"AMBIGUA ({len(candidatas)} coincidencias): {etiqueta} -> {detalle}")
                    self.stdout.write(self.style.ERROR(f"  AMBIGUA     {etiqueta}: {detalle}"))
                    continue

                m = candidatas[0]
                regs = Regularidad.objects.filter(materia=m).count()
                actas = ActaExamen.objects.filter(materia=m).count()
                extra = f", tipo_formacion {m.tipo_formacion} -> {tipo_nuevo}" if tipo_nuevo else ""
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  {'simular' if dry else 'aplicar'}     #{m.id} {m.plan_de_estudio.profesorado.nombre[:34]}\n"
                        f"                '{nombre_actual}'\n"
                        f"             -> '{nombre_nuevo}'{extra}  (regularidades {regs}, actas {actas})"
                    )
                )
                if not dry:
                    m.nombre = nombre_nuevo
                    campos = ["nombre"]
                    if tipo_nuevo:
                        m.tipo_formacion = tipo_nuevo
                        campos.append("tipo_formacion")
                    m.save(update_fields=campos)
                aplicados += 1

            if dry:
                transaction.set_rollback(True)

        self.stdout.write("")
        self.stdout.write(f"aplicados: {aplicados} | ya estaban: {ya_estaban} | con problemas: {len(problemas)}")
        for p in problemas:
            self.stdout.write(self.style.ERROR(f"   {p}"))

        # Control final: que no queden dos escrituras del mismo nombre en Formación General.
        import re
        import unicodedata
        from collections import defaultdict

        def norm(s: str) -> str:
            s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
            return " ".join(re.sub(r"[^a-z0-9 ]", " ", s.lower()).split())

        por_nombre = defaultdict(set)
        for m in Materia.objects.filter(tipo_formacion="FGN"):
            por_nombre[norm(m.nombre)].add(m.nombre)
        restantes = {k: sorted(v) for k, v in por_nombre.items() if len(v) > 1}

        self.stdout.write("")
        if restantes:
            self.stdout.write(self.style.ERROR(f"Formación General AÚN con escrituras distintas: {len(restantes)}"))
            for v in restantes.values():
                self.stdout.write(self.style.ERROR(f"   {v}"))
        else:
            self.stdout.write(self.style.SUCCESS("Formación General: sin escrituras duplicadas."))
