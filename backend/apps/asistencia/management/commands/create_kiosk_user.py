from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Crea o actualiza el usuario kiosk para la pantalla de asistencia."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Nombre de usuario (ej. kiosk-asistencia)")
        parser.add_argument("--password", required=True, help="Contraseña a asignar")
        parser.add_argument("--email", default="", help="Correo opcional")

    def handle(self, *args, **options):
        username = options["username"].strip()
        password = options["password"]
        email = options["email"].strip()

        if not username or len(password) < 4:
            raise CommandError("Debe indicar un username y una contraseña mínima de 4 caracteres.")

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={"email": email})
        user.set_password(password)
        user.is_active = True
        user.is_staff = False
        user.is_superuser = False
        if email:
            user.email = email
        user.save()

        group, _ = Group.objects.get_or_create(name="kiosk")
        user.groups.set([group])

        self.stdout.write(self.style.SUCCESS(f"Usuario '{username}' {'creado' if created else 'actualizado'} correctamente."))
