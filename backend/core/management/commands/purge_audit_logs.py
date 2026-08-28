import gzip
import json
import os
from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import AuditLog


class Command(BaseCommand):
    help = "Purga y archiva registros antiguos de audit_log conservando una ventana rodante (por defecto 730 días / 2 años)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=730,
            help="Días de antigüedad a conservar (default: 730 días = 2 años lectivos).",
        )
        parser.add_argument(
            "--archive-dir",
            type=str,
            default=None,
            help="Directorio de almacenamiento de archivos comprimidos .json.gz (por defecto: /app/logs/archives o settings.LOG_DIR/archives).",
        )
        parser.add_argument(
            "--no-archive",
            action="store_true",
            help="Purgar directamente sin generar archivo comprimido de respaldo previo.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simular la operación mostrando cuántos registros se procesarían sin modificar la base de datos ni escribir archivos.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        archive_dir = options["archive_dir"]
        no_archive = options["no_archive"]
        dry_run = options["dry_run"]

        # Determinar directorio de almacenamiento por defecto
        if not archive_dir:
            # En Docker el volumen está montado en /app/logs
            base_logs = getattr(settings, "LOG_DIR", "/app/logs")
            archive_dir = os.path.join(base_logs, "archives")

        cutoff_date = timezone.now() - timedelta(days=days)
        self.stdout.write(self.style.NOTICE(f"[*] Fecha de corte (antigüedad > {days} días): {cutoff_date.isoformat()}"))

        qs = AuditLog.objects.filter(timestamp__lt=cutoff_date).order_by("timestamp")
        total_count = qs.count()

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS(f"[OK] No hay registros de auditoría con más de {days} días de antigüedad. Nada para purgar."))
            return

        self.stdout.write(self.style.WARNING(f"[!] Se encontraron {total_count} registros para purgar/archivar."))

        if dry_run:
            first_log = qs.first()
            last_log = qs.last()
            self.stdout.write(self.style.NOTICE(f"[DRY-RUN] Registro más antiguo: {first_log.timestamp} | Más reciente de la tanda: {last_log.timestamp}"))
            self.stdout.write(self.style.SUCCESS("[DRY-RUN] Simulación completada. No se modificó la base de datos ni se crearon archivos."))
            return

        # Paso 1: Archivar en .json.gz a menos que se especifique --no-archive
        if not no_archive:
            os.makedirs(archive_dir, exist_ok=True)
            timestamp_str = timezone.now().strftime("%Y%m%d_%H%M%S")
            archive_filename = f"audit_log_archive_prior_{cutoff_date.strftime('%Y%m%d')}_{timestamp_str}.json.gz"
            archive_path = os.path.join(archive_dir, archive_filename)

            self.stdout.write(self.style.NOTICE(f"[*] Exportando y comprimiendo {total_count} registros a {archive_path}..."))

            with gzip.open(archive_path, "wt", encoding="utf-8") as gz_file:
                chunk_size = 1000
                for i in range(0, total_count, chunk_size):
                    batch = qs[i:i + chunk_size]
                    for log in batch:
                        item = {
                            "id": log.id,
                            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                            "usuario_id": log.usuario_id,
                            "nombre_usuario": log.nombre_usuario,
                            "roles": log.roles,
                            "accion": log.accion,
                            "tipo_accion": log.tipo_accion,
                            "detalle_accion": log.detalle_accion,
                            "entidad_afectada": log.entidad_afectada,
                            "id_entidad": log.id_entidad,
                            "resultado": log.resultado,
                            "ip_origen": log.ip_origen,
                            "session_id": log.session_id,
                            "request_id": log.request_id,
                            "payload": log.payload,
                        }
                        gz_file.write(json.dumps(item, ensure_ascii=False) + "\n")

            file_size_kb = round(os.path.getsize(archive_path) / 1024, 2)
            self.stdout.write(self.style.SUCCESS(f"[OK] Respaldo comprimido creado exitosamente: {archive_path} ({file_size_kb} KB)"))

        # Paso 2: Purgar registros de la base de datos de manera atómica
        self.stdout.write(self.style.NOTICE(f"[*] Eliminando {total_count} registros de la tabla audit_log..."))
        deleted_count, _ = qs.delete()

        self.stdout.write(self.style.SUCCESS(f"[OK] Operación completada. Se eliminaron {deleted_count} registros de la base de datos."))
