from django.contrib.auth.models import User
from core.models import PlanillaRegularidadFila
from django.db import transaction

print("STARTING SAFE DATA CORRECTION...")

# 1. OCAMPO
try:
    with transaction.atomic():
        dni_ocampo = '43115429'
        full_name_db = "OCAMPO, ERNESTO DANIEL"
        try:
            u = User.objects.get(username=dni_ocampo)
            u.first_name = 'ERNESTO DANIEL'
            u.last_name = 'OCAMPO'
            u.save()
            print(f"[OCAMPO] User updated.")
        except User.DoesNotExist:
             print(f"[OCAMPO] User not found.")
        
        updated_filas = PlanillaRegularidadFila.objects.filter(dni=dni_ocampo).update(apellido_nombre=full_name_db)
        print(f"[OCAMPO] Updated {updated_filas} filas.")
except Exception as e:
    print(f"[OCAMPO] Error: {e}")

# 2. GODOY
dni_godoy = '458887505'
try:
    # returns tuple (count, dict)
    deleted_filas = PlanillaRegularidadFila.objects.filter(dni=dni_godoy).delete()
    print(f"[GODOY] Deleted filas: {deleted_filas}")
except Exception as e:
    print(f"[GODOY] Error deleting filas: {e}")

try:
    u = User.objects.get(username=dni_godoy)
    u.delete()
    print(f"[GODOY] User deleted.")
except User.DoesNotExist:
    print(f"[GODOY] User not found.")
except Exception as e:
    print(f"[GODOY] Error deleting User: {e}")

# 3. GAMARRA
dni_gamarra = '320050168'
try:
    deleted_filas = PlanillaRegularidadFila.objects.filter(dni=dni_gamarra).delete()
    print(f"[GAMARRA] Deleted filas: {deleted_filas}")
except Exception as e:
    print(f"[GAMARRA] Error deleting filas: {e}")

try:
    u = User.objects.get(username=dni_gamarra)
    u.delete()
    print(f"[GAMARRA] User deleted.")
except User.DoesNotExist:
    print(f"[GAMARRA] User not found.")
except Exception as e:
    print(f"[GAMARRA] Error deleting User: {e}")

print("FINISHED.")
