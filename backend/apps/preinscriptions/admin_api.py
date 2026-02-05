from ninja import Router, Schema
from typing import List, Optional
from core.models import Preinscripcion, Estudiante, Profesorado, EstudianteCarrera
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db import transaction

router = Router()

class PreinscripcionOut(Schema):
    id: int
    dni: str
    nombre: str
    apellido: str
    email: Optional[str]
    telefono: Optional[str]
    carrera_nombre: str
    carrera_id: int
    anio: int
    estado: str
    estado_display: str

class PreinscripcionUpdateIn(Schema):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    carrera_id: Optional[int] = None
    anio: Optional[int] = None

@router.get("/list", response=List[PreinscripcionOut])
def list_preinscriptions(
    request,
    anio: Optional[int] = None,
    carrera_id: Optional[int] = None,
    search: Optional[str] = None
):
    qs = Preinscripcion.objects.all().select_related('estudiante__user', 'carrera')
    
    if anio:
        qs = qs.filter(anio=anio)
    if carrera_id:
        qs = qs.filter(carrera_id=carrera_id)
    if search:
        qs = qs.filter(
            Q(estudiante__dni__icontains=search) |
            Q(estudiante__user__first_name__icontains=search) |
            Q(estudiante__user__last_name__icontains=search)
        )
    
    res = []
    for p in qs:
        res.append({
            "id": p.id,
            "dni": p.estudiante.dni,
            "nombre": p.estudiante.user.first_name,
            "apellido": p.estudiante.user.last_name,
            "email": p.estudiante.user.email,
            "telefono": p.estudiante.telefono,
            "carrera_nombre": p.carrera.nombre,
            "carrera_id": p.carrera.id,
            "anio": p.anio,
            "estado": p.estado,
            "estado_display": p.get_estado_display()
        })
    return res

@router.delete("/{pre_id}")
def delete_preinscription(request, pre_id: int):
    pre = get_object_or_404(Preinscripcion, id=pre_id)
    pre.delete()
    return {"success": True}

@router.post("/{pre_id}/confirmar")
def confirm_preinscription(request, pre_id: int):
    pre = get_object_or_404(Preinscripcion, id=pre_id)
    
    with transaction.atomic():
        pre.estado = Preinscripcion.EstadoPreinscripcion.APROBADA
        pre.save()
        
        # Actualizar legajo del estudiante
        estudiante = pre.estudiante
        estudiante.estado_legajo = Estudiante.EstadoLegajo.COMPLETO
        estudiante.save()
        
        # Asegurar vinculación a carrera
        EstudianteCarrera.objects.get_or_create(
            estudiante=estudiante,
            profesorado=pre.carrera,
            defaults={"anio_ingreso": pre.anio}
        )
        
    return {"success": True}

@router.patch("/{pre_id}")
def update_preinscription(request, pre_id: int, data: PreinscripcionUpdateIn):
    pre = get_object_or_404(Preinscripcion, id=pre_id)
    estudiante = pre.estudiante
    user = estudiante.user
    
    with transaction.atomic():
        if data.nombre is not None:
            user.first_name = data.nombre
        if data.apellido is not None:
            user.last_name = data.apellido
        if data.email is not None:
            user.email = data.email
        user.save()
        
        if data.telefono is not None:
            estudiante.telefono = data.telefono
        estudiante.save()
        
        if data.carrera_id is not None:
            pre.carrera_id = data.carrera_id
        if data.anio is not None:
            pre.anio = data.anio
        pre.save()
        
    return {"success": True}
