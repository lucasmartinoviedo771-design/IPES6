from django.conf import settings
from django.core.management.base import BaseCommand

REQUIRED_VARS = ("SECRET_KEY",)

RATE_LIMIT_VARS = (
    "LOGIN_RATE_LIMIT_ATTEMPTS",
    "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
)


class Command(BaseCommand):
    help = "Verifica que las variables de entorno críticas estén configuradas."

    def handle(self, *args, **options):
        missing = []
        warnings = []

        if settings.IS_PROD:
            for var in REQUIRED_VARS:
                value = getattr(settings, var, None)
                if not value or value == "dev-insecure-change-me":
                    missing.append(var)
        else:
            self.stdout.write(self.style.WARNING("IS_PROD es False; validación estricta omitida."))

        for var in RATE_LIMIT_VARS:
            value = getattr(settings, var, None)
            if value is None:
                missing.append(var)
            else:
                try:
                    ivalue = int(value)
                    if ivalue <= 0:
                        warnings.append(f"{var} tiene un valor no positivo ({value}).")
                except (TypeError, ValueError):
                    warnings.append(f"{var} debe ser entero, se obtuvo {value!r}.")

        if settings.IS_PROD and settings.DEBUG:
            warnings.append("DEBUG está habilitado en producción.")

        if missing:
            self.stderr.write(self.style.ERROR("Variables faltantes o inválidas:"))
            for var in sorted(set(missing)):
                self.stderr.write(f"  - {var}")
            raise SystemExit(1)

        if warnings:
            self.stdout.write(self.style.WARNING("Advertencias:"))
            for warn in warnings:
                self.stdout.write(f"  - {warn}")

        self.stdout.write(self.style.SUCCESS("check_env completado sin errores críticos."))
