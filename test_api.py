import requests
import json

response = requests.post("http://localhost:8000/api/asistencia/docentes/kiosk-marcar-bulk", json={
    "dni": "28126358",
    "items": [{"id": 9999, "es_cargo": False}],
    "via": "docente"
})
print("Status:", response.status_code)
print("Response:", response.text)
