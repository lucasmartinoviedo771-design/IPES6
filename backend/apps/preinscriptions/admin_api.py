"""
API administrativa para la gestión de Preinscripciones.
Permite a bedeles y administradores listar, filtrar, modificar y confirmar
las solicitudes de ingreso de nuevos estudiantes al instituto.
"""

from typing import List, Optional

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from core.models import Estudiante, EstudianteCarrera, Preinscripcion

from .router import preins_admin_router as router


class PreinscripcionOut(Schema):
    """Estructura de salida para el listado administrativo de preinscripciones."""

    id: int
    dni: str
    nombre: str
    apellido: str
    email: str | None
    telefono: str | None
    carrera_nombre: str
    carrera_id: int
    anio: int
    estado: str
    estado_display: str


class PreinscripcionUpdateIn(Schema):
    """Datos permitidos para la edición manual de una solicitud por parte de gestión."""

    nombre: str | None = None
    apellido: str | None = None
    email: str | None = None
    telefono: str | None = None
    carrera_id: int | None = None
    anio: int | None = None


@router.get("/list", response=list[PreinscripcionOut])
def list_preinscriptions(request, anio: int | None = None, carrera_id: int | None = None, search: str | None = None):
    """
    Lista y filtra todas las preinscripciones registradas.
    Optimiza la consulta mediante select_related para evitar el problema N+1 en las relaciones.
    """
    qs = Preinscripcion.objects.all().select_related("alumno", "alumno__persona", "carrera")

    # Aplicación de filtros según criterios de búsqueda
    if anio:
        qs = qs.filter(anio=anio)
    if carrera_id:
        qs = qs.filter(carrera_id=carrera_id)
    if search:
        qs = qs.filter(
            Q(alumno__persona__dni__icontains=search)
            | Q(alumno__persona__nombre__icontains=search)
            | Q(alumno__persona__apellido__icontains=search)
        )

    # Mapeo manual a la estructura de salida para facilitar el consumo del frontend
    res = []
    for p in qs:
        res.append(
            {
                "id": p.id,
                "dni": p.alumno.dni,
                "nombre": p.alumno.nombre,
                "apellido": p.alumno.apellido,
                "email": p.alumno.email,
                "telefono": p.alumno.telefono,
                "carrera_nombre": p.carrera.nombre,
                "carrera_id": p.carrera.id,
                "anio": p.anio,
                "estado": p.estado,
                "estado_display": p.get_estado_display(),
            }
        )
    return res


@router.delete("/{pre_id}")
def delete_preinscription(request, pre_id: int):
    """Elimina una solicitud de preinscripción (acción destructiva)."""
    pre = get_object_or_404(Preinscripcion, id=pre_id)
    pre.delete()
    return {"success": True}


@router.post("/{pre_id}/confirmar")
def confirm_preinscription(request, pre_id: int):
    """
    Promueve una preinscripción al estado 'APROBADA' y activa al alumno en el sistema.

    Efectos secundarios atómicos:
    1. Cambia el estado de la preinscripción.
    2. Marca el legajo del estudiante como COMPLETO.
    3. Vincula formalmente al estudiante con la carrera solicitada (EstudianteCarrera).
    """
    pre = get_object_or_404(Preinscripcion, id=pre_id)

    with transaction.atomic():
        pre.estado = Preinscripcion.EstadoPreinscripcion.APROBADA
        pre.save()

        # Activación del legajo del estudiante
        estudiante = pre.alumno
        estudiante.estado_legajo = Estudiante.EstadoLegajo.COMPLETO
        estudiante.save()

        # Creación del vínculo académico formal si no existe
        EstudianteCarrera.objects.get_or_create(
            estudiante=estudiante, profesorado=pre.carrera, defaults={"anio_ingreso": pre.anio}
        )

    return {"success": True}


@router.patch("/{pre_id}")
def update_preinscription(request, pre_id: int, data: PreinscripcionUpdateIn):
    """Actualiza parcialmente los datos de una solicitud y del usuario asociado."""
    pre = get_object_or_404(Preinscripcion, id=pre_id)
    estudiante = pre.alumno
    user = estudiante.user

    with transaction.atomic():
        # Actualización de datos de identidad (Persona)
        persona = estudiante.persona
        if persona:
            if data.nombre is not None:
                persona.nombre = data.nombre.strip()
            if data.apellido is not None:
                persona.apellido = data.apellido.strip()
            if data.email is not None:
                persona.email = data.email.strip()
            persona.save()

        # Actualización de contacto (Estudiante)
        if data.telefono is not None:
            estudiante.telefono = data.telefono
        estudiante.save()

        # Actualización de datos académicos de la preinscripción
        if data.carrera_id is not None:
            pre.carrera_id = data.carrera_id
        if data.anio is not None:
            pre.anio = data.anio
        pre.save()

    return {"success": True}
