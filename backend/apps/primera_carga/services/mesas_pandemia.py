"""
Servicio para la carga histórica de Notas de Mesa (Pandemia / Histórico).

Crea una MesaExamen + InscripcionMesa por cada fila, con validación mínima:
- Solo verifica que la materia no esté ya aprobada para el estudiante
  (o que si está aprobada, sea con una fecha POSTERIOR a la mesa que se intenta cargar).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth.models import User
from django.db import transaction

from core.models import (
    Docente,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Profesorado,
)


def _parse_nota(raw: str | None) -> tuple[str, float | None]:
    """
    Convierte el texto de nota del PDF a (condicion, nota_decimal).

    Valores reconocidos:
      - 'AUSENTE' / 'AUS' →  AUS, None
      - 'LIBRE'           →  AUS, None  (ausente libre)
      - número (ej. '7', '6.5') → APR si ≥4, DES si <4
    """
    if not raw:
        return InscripcionMesa.Condicion.AUSENTE, None

    texto = str(raw).strip().upper()

    if texto in ("AUSENTE", "AUS", "LIBRE", "AUS.", "ABSENT"):
        return InscripcionMesa.Condicion.AUSENTE, None

    # Intentar parsear como número
    texto_num = texto.replace(",", ".")
    try:
        valor = float(texto_num)
        if valor >= 6:
            return InscripcionMesa.Condicion.APROBADO, valor
        else:
            return InscripcionMesa.Condicion.DESAPROBADO, valor
    except ValueError:
        # No se reconoce → tratar como ausente con advertencia
        return InscripcionMesa.Condicion.AUSENTE, None


def _ya_aprobada_con_fecha_posterior(estudiante: Estudiante, materia: Materia, fecha_mesa: date) -> bool:
    """
    Devuelve True si el estudiante tiene la materia aprobada EN UNA FECHA POSTERIOR
    a la mesa que se intenta ingresar (lo cual impediría cargar esta nota).

    Lógica: si existe InscripcionMesa aprobada con fecha >= fecha_mesa → bloquear.
    """
    return InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia=materia,
        condicion=InscripcionMesa.Condicion.APROBADO,
        mesa__fecha__gt=fecha_mesa,
    ).exists()


def _materia_ya_aprobada(estudiante: Estudiante, materia: Materia) -> bool:
    """Verifica si la materia está aprobada (por cualquier InscripcionMesa aprobada)."""
    return InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia=materia,
        condicion=InscripcionMesa.Condicion.APROBADO,
    ).exists()


def registrar_mesa_pandemia(
    *,
    user: User,
    profesorado_id: int,
    materia_id: int,
    fecha: date,
    tipo: str = MesaExamen.Tipo.EXTRAORDINARIA,
    docente_nombre: str = "",
    folio: str = "",
    libro: str = "",
    observaciones: str = "",
    filas: list[dict],
    dry_run: bool = False,
) -> dict:
    """
    Crea/reutiliza una MesaExamen para la materia+fecha+tipo dados,
    y registra las InscripcionMesa de cada fila.

    Cada fila debe tener:
      - "apellido_nombre": str
      - "dni": str (puede estar vacío → se skipea con advertencia)
      - "nota_raw": str  ("7", "AUSENTE", "LIBRE", etc.)
      - "comision_obs": str  (texto libre para el campo comisión/otro profesorado)

    Parámetros:
      dry_run: si es True, hace rollback al final (para previsualizar).
    """
    try:
        profesorado = Profesorado.objects.get(pk=profesorado_id)
    except Profesorado.DoesNotExist:
        raise ValueError("El profesorado especificado no existe.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio__profesorado").get(pk=materia_id)
    except Materia.DoesNotExist:
        raise ValueError("La materia especificada no existe.")

    if not filas:
        raise ValueError("Debe ingresar al menos una fila de estudiantes.")

    results: list[dict] = []
    warnings: list[str] = []

    def _do_work():
        # --- Obtener o crear la MesaExamen ---
        mesa, mesa_created = MesaExamen.objects.get_or_create(
            materia=materia,
            tipo=tipo,
            fecha=fecha,
            defaults={
                "modalidad": MesaExamen.Modalidad.REGULAR,
                "aula": "",
                "cupo": 0,
            },
        )

        # Si la mesa ya existía y tiene docente presidente, no sobreescribimos
        if mesa_created and docente_nombre:
            docente_obj = Docente.objects.filter(
                persona__apellido__icontains=docente_nombre.split()[0] if docente_nombre else ""
            ).first()
            mesa.docente_presidente = docente_obj
            mesa.aula = ""
            mesa.save(update_fields=["docente_presidente"])

        for idx, fila in enumerate(filas, start=1):
            dni = (fila.get("dni") or "").strip()
            apellido_nombre = (fila.get("apellido_nombre") or "").strip()
            nota_raw = (fila.get("nota_raw") or "").strip()
            comision_obs = (fila.get("comision_obs") or "").strip()
            fila_obs = (fila.get("observaciones") or "").strip()

            if not dni:
                warnings.append(f"[Fila {idx}] Sin DNI – se omitió ({apellido_nombre or 'sin nombre'}).")
                results.append({"fila": idx, "apellido_nombre": apellido_nombre, "estado": "omitida", "mensaje": "Sin DNI"})
                continue

            # Buscar estudiante
            estudiante = Estudiante.objects.filter(persona__dni=dni).first()
            if not estudiante:
                warnings.append(f"[Fila {idx}] No se encontró estudiante con DNI {dni}.")
                results.append({"fila": idx, "dni": dni, "apellido_nombre": apellido_nombre, "estado": "error", "mensaje": "Estudiante no encontrado"})
                continue

            condicion, nota_val = _parse_nota(nota_raw)

            # Validación: ¿ya aprobada la materia con fecha POSTERIOR a esta mesa?
            if condicion == InscripcionMesa.Condicion.APROBADO:
                if _ya_aprobada_con_fecha_posterior(estudiante, materia, fecha):
                    warnings.append(f"[Fila {idx}] DNI {dni}: la materia ya fue aprobada en fecha posterior a {fecha}. Se omite.")
                    results.append({"fila": idx, "dni": dni, "apellido_nombre": apellido_nombre, "estado": "omitida", "mensaje": "Materia ya aprobada en fecha posterior"})
                    continue

            # — No validamos si ya está aprobada en fecha anterior:
            #   estamos cargando un historial, puede existir una nota previa.
            #   Pero si YA está aprobada en ESTA misma mesa, actualizamos.

            obs_completa = " | ".join(filter(None, [
                docente_nombre and f"Docente: {docente_nombre}",
                comision_obs and f"Comisión orig.: {comision_obs}",
                fila_obs,
                observaciones,
            ]))

            insc, created = InscripcionMesa.objects.get_or_create(
                mesa=mesa,
                estudiante=estudiante,
                defaults={
                    "estado": InscripcionMesa.Estado.INSCRIPTO,
                    "condicion": condicion,
                    "nota": Decimal(str(nota_val)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP) if nota_val is not None else None,
                    "folio": folio or "",
                    "libro": libro or "",
                    "observaciones": obs_completa,
                },
            )

            if not created:
                # Actualizar si ya existía
                insc.condicion = condicion
                insc.nota = Decimal(str(nota_val)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP) if nota_val is not None else None
                insc.folio = folio or insc.folio
                insc.libro = libro or insc.libro
                insc.observaciones = obs_completa or insc.observaciones
                insc.save()

            estado_str = {
                InscripcionMesa.Condicion.APROBADO: "aprobado",
                InscripcionMesa.Condicion.DESAPROBADO: "desaprobado",
                InscripcionMesa.Condicion.AUSENTE: "ausente",
            }.get(condicion, condicion)

            results.append({
                "fila": idx,
                "dni": dni,
                "apellido_nombre": apellido_nombre,
                "nota_raw": nota_raw,
                "condicion": condicion,
                "nota": float(nota_val) if nota_val is not None else None,
                "estado": estado_str,
                "inscripcion_id": insc.id,
                "mesa_id": mesa.id,
                "actualizada": not created,
            })

        return mesa

    if dry_run:
        with transaction.atomic():
            _do_work()
            transaction.set_rollback(True)
    else:
        with transaction.atomic():
            _do_work()

    errores = [r for r in results if r.get("estado") == "error"]
    return {
        "ok": True,
        "dry_run": dry_run,
        "mesa_id": None,  # no disponible en dry_run
        "materia_nombre": materia.nombre,
        "fecha": str(fecha),
        "tipo": tipo,
        "total_filas": len(filas),
        "procesadas": len([r for r in results if r.get("estado") not in ("omitida", "error")]),
        "omitidas": len([r for r in results if r.get("estado") == "omitida"]),
        "errores_count": len(errores),
        "warnings": warnings,
        "results": results,
    }
