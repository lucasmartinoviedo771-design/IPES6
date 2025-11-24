
import pytest
from django.contrib.auth.models import User, Group
from types import SimpleNamespace
from apps.alumnos import carga_notas_api
from ninja.errors import HttpError

@pytest.mark.django_db
def test_obtener_acta_metadata_bedel_access():
    # Create Bedel Group
    bedel_group, _ = Group.objects.get_or_create(name="bedel")
    
    # Create Bedel User
    bedel_user = User.objects.create(username="bedel_user")
    bedel_user.groups.add(bedel_group)
    
    # Create Request
    request = SimpleNamespace(user=bedel_user)
    
    # Call API
    response = carga_notas_api.obtener_acta_metadata(request)
    
    # Check Response
    assert response.ok is True
    assert response.data is not None

@pytest.mark.django_db
def test_obtener_acta_metadata_student_denied():
    # Create Student User (no admin/bedel/secretaria group)
    student_user = User.objects.create(username="student_user")
    
    # Create Request
    request = SimpleNamespace(user=student_user)
    
    # Call API - Should raise AppError 403
    from apps.common.errors import AppError
    with pytest.raises(AppError) as excinfo:
        carga_notas_api.obtener_acta_metadata(request)
    
    assert excinfo.value.status_code == 403

@pytest.mark.django_db
def test_crear_acta_examen_bedel_access():
    # Create Bedel Group
    bedel_group, _ = Group.objects.get_or_create(name="bedel")
    
    # Create Bedel User
    bedel_user = User.objects.create(username="bedel_user")
    bedel_user.groups.add(bedel_group)
    
    # Create Request
    request = SimpleNamespace(user=bedel_user)
    
    # Create Dummy Payload (invalid but enough to pass auth)
    # We expect 400 or 404 because IDs don't exist, but NOT 403
    from datetime import date
    payload = carga_notas_api.ActaCreateIn(
        tipo="REG",
        profesorado_id=999,
        materia_id=999,
        fecha=date.today(),
        folio="123",
        docentes=[],
        alumnos=[]
    )
    
    # Call API
    # It should return 404 because profesorado doesn't exist, but that means it passed Auth
    status, response = carga_notas_api.crear_acta_examen(request, payload)
    
    assert status == 404 or status == 400
    # If it was 403, it would have raised HttpError or returned 403
