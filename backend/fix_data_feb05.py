from django.contrib.auth.models import User
from core.models import PlanillaRegularidadFila, Estudiante
from django.db import transaction

print("STARTING DATA CORRECTION...")

with transaction.atomic():
    # ---------------------------------------------------------
    # 1. OCAMPO, ERNESTO DANIEL (43115429)
    # ---------------------------------------------------------
    dni_ocampo = '43115429'
    new_first = 'ERNESTO DANIEL'
    new_last = 'OCAMPO'
    full_name_db = f"{new_last}, {new_first}" # "OCAMPO, ERNESTO DANIEL"
    
    # Update User
    try:
        u = User.objects.get(username=dni_ocampo)
        old_name = f"{u.last_name}, {u.first_name}"
        u.first_name = new_first
        u.last_name = new_last
        u.save()
        print(f"[OCAMPO] User updated: '{old_name}' -> '{new_last}, {new_first}'")
    except User.DoesNotExist:
        print(f"[OCAMPO] User {dni_ocampo} not found in auth_user")

    # Update PlanillaRegularidadFila (denormalized field)
    filas_ocampo = PlanillaRegularidadFila.objects.filter(dni=dni_ocampo)
    count_ocampo = filas_ocampo.count()
    if count_ocampo > 0:
        filas_ocampo.update(apellido_nombre=full_name_db)
        print(f"[OCAMPO] Updated {count_ocampo} rows in PlanillaRegularidadFila to '{full_name_db}'")
    else:
        print(f"[OCAMPO] No rows found in PlanillaRegularidadFila with DNI {dni_ocampo}")


    # ---------------------------------------------------------
    # 2. GODOY HOLZMANN (458887505) - DUPLICATE TO DELETE
    # ---------------------------------------------------------
    dni_godoy = '458887505'
    
    # Check/Delete from PlanillaRegularidadFila
    deleted_filas_godoy, _ = PlanillaRegularidadFila.objects.filter(dni=dni_godoy).delete()
    if deleted_filas_godoy > 0:
        print(f"[GODOY] Deleted {deleted_filas_godoy} rows from PlanillaRegularidadFila")
    
    # Delete User (cascades to Estudiante)
    try:
        u_godoy = User.objects.get(username=dni_godoy)
        u_godoy.delete()
        print(f"[GODOY] User {dni_godoy} deleted successfully")
    except User.DoesNotExist:
        print(f"[GODOY] User {dni_godoy} not found")
        

    # ---------------------------------------------------------
    # 3. GAMARRA (320050168) - WRONG DNI TO DELETE
    # ---------------------------------------------------------
    dni_gamarra = '320050168'
    
    # Check/Delete from PlanillaRegularidadFila
    deleted_filas_gamarra, _ = PlanillaRegularidadFila.objects.filter(dni=dni_gamarra).delete()
    if deleted_filas_gamarra > 0:
        print(f"[GAMARRA] Deleted {deleted_filas_gamarra} rows from PlanillaRegularidadFila")

    # Delete User
    try:
        u_gamarra = User.objects.get(username=dni_gamarra)
        u_gamarra.delete()
        print(f"[GAMARRA] User {dni_gamarra} deleted successfully")
    except User.DoesNotExist:
        print(f"[GAMARRA] User {dni_gamarra} not found")

print("DATA CORRECTION COMPLETED.")
