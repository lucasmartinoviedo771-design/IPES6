import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()
username = "kiosco"
password = "Kiosco_Password2026!"

try:
    user = User.objects.get(username=username)
    user.set_password(password)
    user.save()
    print("User updated")
except User.DoesNotExist:
    user = User.objects.create_user(username=username, password=password)
    print("User created")

group, _ = Group.objects.get_or_create(name="kiosk")
user.groups.add(group)
print(f"User {username} added to group kiosk")
