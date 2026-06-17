"""
Repara ActaExamenDocente faltantes en actas creadas antes del fix del 2026-05-07.

El bug: crear_acta_examen nunca persistía los docentes en ActaExamenDocente.
La fuente de verdad para recuperarlos es la MesaExamen vinculada, que sí guardaba
el tribunal (docente_presidente, docente_vocal1, docente_vocal2).

Uso:
    python manage.py reparar_docentes_actas            # dry-run (solo muestra)
    python manage.py reparar_docentes_actas --commit   # aplica los cambios
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models.actas import ActaExamen, ActaExamenDocente
from core.models.mesas import MesaExamen


class Command(BaseCommand):
    help = "Reconstruye ActaExamenDocente desde MesaExamen para actas que no tienen docentes registrados."

    def add_arguments(self, parser):
        parser.add_argument(
            "--commit",
            action="store_true",
            default=False,
            help="Aplica los cambios. Sin este flag corre en dry-run.",
        )

    def handle(self, *args, **options):
        commit = options["commit"]

        if not commit:
            self.stdout.write(self.style.WARNING("=== DRY-RUN: no se escribirá nada. Usá --commit para aplicar. ==="))

        # Actas sin ningún ActaExamenDocente asociado
        actas_sin_docentes = (
            ActaExamen.objects.prefetch_related("docentes")
            .filter(docentes__isnull=True)
            .select_related("materia", "profesorado")
            .order_by("id")
        )

        total = actas_sin_docentes.count()
        self.stdout.write(f"\nActas sin docentes: {total}")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("No hay actas que reparar."))
            return

        reparadas = 0
        sin_mesa = 0
        sin_docentes_en_mesa = 0

        for acta in actas_sin_docentes:
            modalidad = (
                MesaExamen.Modalidad.LIBRE if acta.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR
            )
            mesa = (
                MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=modalidad)
                .select_related(
                    "docente_presidente__persona",
                    "docente_vocal1__persona",
                    "docente_vocal2__persona",
                )
                .first()
            )

            if not mesa:
                sin_mesa += 1
                self.stdout.write(f"  [SIN MESA] Acta {acta.id} ({acta.codigo}) - {acta.materia} / {acta.fecha}")
                continue

            tribunal = [
                (mesa.docente_presidente, ActaExamenDocente.Rol.PRESIDENTE, 0),
                (mesa.docente_vocal1, ActaExamenDocente.Rol.VOCAL1, 1),
                (mesa.docente_vocal2, ActaExamenDocente.Rol.VOCAL2, 2),
            ]

            docentes_a_crear = [(doc, rol, orden) for doc, rol, orden in tribunal if doc is not None]

            if not docentes_a_crear:
                sin_docentes_en_mesa += 1
                self.stdout.write(
                    f"  [MESA SIN DOCENTES] Acta {acta.id} ({acta.codigo}) - mesa {mesa.id} no tiene docentes asignados"
                )
                continue

            self.stdout.write(f"  [OK] Acta {acta.id} ({acta.codigo}) - {acta.materia} / {acta.fecha}")
            for doc, rol, _orden in docentes_a_crear:
                nombre_completo = f"{doc.apellido}, {doc.nombre}".strip(", ")
                self.stdout.write(
                    f"       → {ActaExamenDocente.Rol(rol).label}: {nombre_completo} (DNI: {doc.dni or '-'})"
                )

            if commit:
                with transaction.atomic():
                    for doc, rol, orden in docentes_a_crear:
                        nombre_completo = f"{doc.apellido}, {doc.nombre}".strip(", ")
                        ActaExamenDocente.objects.create(
                            acta=acta,
                            docente=doc,
                            nombre=nombre_completo,
                            dni=doc.dni or "",
                            rol=rol,
                            orden=orden,
                        )

            reparadas += 1

        self.stdout.write("")
        self.stdout.write("Resumen:")
        self.stdout.write(f"  Actas procesadas para reparar : {reparadas}")
        self.stdout.write(f"  Sin mesa vinculada            : {sin_mesa}")
        self.stdout.write(f"  Mesa sin docentes asignados   : {sin_docentes_en_mesa}")

        if commit:
            self.stdout.write(self.style.SUCCESS(f"\n✓ {reparadas} actas reparadas exitosamente."))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "\nDRY-RUN completado. Para aplicar: python manage.py reparar_docentes_actas --commit"
                )
            )
