from __future__ import annotations

from collections import OrderedDict
from typing import Dict, Iterable, List, Tuple, Type

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Model

from core.models import (
    Conversation,
    Estudiante,
    InscripcionMateriaAlumno,
    MesaExamen,
    PedidoAnalitico,
    Preinscripcion,
    PreinscripcionChecklist,
    Regularidad,
    VentanaHabilitacion,
)
from apps.preinscriptions.models_uploads import PreinscripcionArchivo


class Command(BaseCommand):
    """
    Removes operational data (students, preinscripciones, inscripciones, mesas, etc.)
    while keeping structural entities such as Profesorados, Planes, Materias,
    Correlatividades, Docentes and auth Groups.
    """

    help = (
        "Limpia datos operativos (estudiantes, preinscripciones, inscripciones, mesas, conversaciones, etc.) "
        "preservando la estructura académica. Utilice --dry-run para previsualizar y --force para ejecutar."
    )

    TARGET_MODELS: Tuple[Tuple[str, Type[Model]], ...] = (
        ("preinscripcion_archivos", PreinscripcionArchivo),
        ("conversaciones", Conversation),
        ("mesas_examen", MesaExamen),
        ("pedidos_analitico", PedidoAnalitico),
        ("regularidades", Regularidad),
        ("inscripciones_materia", InscripcionMateriaAlumno),
        ("preinscripciones", Preinscripcion),
        ("preinscripcion_checklists", PreinscripcionChecklist),
        ("ventanas_habilitacion", VentanaHabilitacion),
        ("estudiantes", Estudiante),
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántos registros se eliminarían sin modificar la base.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Ejecuta la limpieza. Úselo solo después de realizar un respaldo.",
        )

    def handle(self, *args, dry_run: bool = False, force: bool = False, **options):
        if dry_run and force:
            raise CommandError("Use --dry-run o --force, pero no ambos a la vez.")
        if not dry_run and not force:
            raise CommandError("Indique --dry-run para previsualizar o --force para ejecutar la limpieza.")

        self.stdout.write(self.style.WARNING("Calculando registros a limpiar..."))
        stats, student_user_ids = self._collect_stats()

        self.stdout.write("")  # separación visual
        for label, count in stats.items():
            self.stdout.write(f"- {label}: {count}")
        self.stdout.write(f"- usuarios_alumno: {self._count_student_users(student_user_ids)}")
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry-run completo. No se eliminaron datos."))
            return

        self.stdout.write(self.style.WARNING("Ejecutando limpieza. Esta acción es irreversible..."))
        with transaction.atomic():
            self._purge_data(student_user_ids)
        self.stdout.write(self.style.SUCCESS("Limpieza finalizada correctamente."))

    # ------------------------------------------------------------------ helpers
    def _collect_stats(self) -> Tuple[Dict[str, int], List[int]]:
        stats: "OrderedDict[str, int]" = OrderedDict()
        for label, model in self.TARGET_MODELS:
            stats[label] = model.objects.count()
        student_user_ids = list(Estudiante.objects.values_list("user_id", flat=True))
        return stats, student_user_ids

    @staticmethod
    def _count_student_users(user_ids: Iterable[int]) -> int:
        if not user_ids:
            return 0
        return User.objects.filter(id__in=list(user_ids)).count()

    def _purge_data(self, student_user_ids: List[int]) -> None:
        # 1) PreinscripcionArchivo (no tiene FK real, se elimina primero).
        self._delete_queryset(PreinscripcionArchivo, "preinscripcion_archivos")

        # 2) Conversaciones -> cascada a mensajes, participantes y auditoría.
        self._delete_queryset(Conversation, "conversaciones")

        # 3) Mesas (cascada a inscripciones de mesa) y otros registros operativos.
        self._delete_queryset(MesaExamen, "mesas_examen")
        self._delete_queryset(PedidoAnalitico, "pedidos_analitico")
        self._delete_queryset(Regularidad, "regularidades")
        self._delete_queryset(InscripcionMateriaAlumno, "inscripciones_materia")
        self._delete_queryset(PreinscripcionChecklist, "preinscripcion_checklists")
        self._delete_queryset(Preinscripcion, "preinscripciones")
        self._delete_queryset(VentanaHabilitacion, "ventanas_habilitacion")

        # 4) Estudiantes y sus usuarios asociados.
        self._delete_queryset(Estudiante, "estudiantes")
        if student_user_ids:
            deleted, _ = User.objects.filter(id__in=student_user_ids).delete()
            self.stdout.write(self.style.NOTICE(f"  • usuarios_alumno eliminados: {deleted}"))

    def _delete_queryset(self, model: Type[Model], label: str) -> None:
        deleted, _ = model.objects.all().delete()
        self.stdout.write(self.style.NOTICE(f"  • {label} eliminados: {deleted}"))
