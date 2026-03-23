import { MateriaRow, FormState, PreferiblePlan } from "./types";
import {
  PedidoEquivalenciaPayload,
  PedidoEquivalenciaMateriaPayload,
} from "@/api/estudiantes";

export const FORMATO_OPTIONS = ["Asignatura", "Modulo", "Taller", "Seminario", "Laboratorio", "Otro"];
export const STAFF_ROLES = ["admin", "secretaria", "bedel"];
export const DNI_COMPLETO_LENGTH = 8;

export const buildEmptyMateria = (): MateriaRow => ({ nombre: "", formato: "", anio_cursada: "", nota: "" });

export const buildInitialForm = (): FormState => ({
  tipo: "",
  cicloLectivo: String(new Date().getFullYear()),
  profesoradoDestinoId: "",
  profesoradoDestinoNombre: "",
  planDestinoId: "",
  planDestinoResolucion: "",
  establecimientoOrigen: "",
  establecimientoLocalidad: "",
  establecimientoProvincia: "",
  profesoradoOrigenId: "",
  profesoradoOrigenNombre: "",
  planOrigenId: "",
  planOrigenResolucion: "",
});

export const preferPlan = <T extends PreferiblePlan>(planes: T[]): T | null => {
  if (!planes.length) return null;
  const vigente = planes.find((plan) => plan.vigente);
  if (vigente) return vigente;
  return [...planes].sort((a, b) => (b.anio_inicio || 0) - (a.anio_inicio || 0))[0] ?? null;
};

export const buildPayload = (form: FormState, materias: MateriaRow[]): PedidoEquivalenciaPayload => ({
  tipo: form.tipo as "ANEXO_A" | "ANEXO_B",
  ciclo_lectivo: form.cicloLectivo.trim() || undefined,
  profesorado_destino_id: form.profesoradoDestinoId ? Number(form.profesoradoDestinoId) : undefined,
  profesorado_destino_nombre: form.profesoradoDestinoNombre.trim() || undefined,
  plan_destino_id: form.planDestinoId ? Number(form.planDestinoId) : undefined,
  plan_destino_resolucion: form.planDestinoResolucion.trim() || undefined,
  profesorado_origen_nombre:
    form.tipo === "ANEXO_A" ? form.profesoradoOrigenNombre.trim() || undefined : undefined,
  plan_origen_resolucion:
    form.tipo === "ANEXO_A" ? form.planOrigenResolucion.trim() || undefined : undefined,
  establecimiento_origen:
    form.tipo === "ANEXO_B" ? form.establecimientoOrigen.trim() || undefined : undefined,
  establecimiento_localidad:
    form.tipo === "ANEXO_B" ? form.establecimientoLocalidad.trim() || undefined : undefined,
  establecimiento_provincia:
    form.tipo === "ANEXO_B" ? form.establecimientoProvincia.trim() || undefined : undefined,
  materias: materias
    .filter((item) => item.nombre.trim())
    .map<PedidoEquivalenciaMateriaPayload>((item) => ({
      nombre: item.nombre.trim(),
      formato: item.formato.trim() || undefined,
      anio_cursada: item.anio_cursada.trim() || undefined,
      nota: item.nota.trim() || undefined,
    })),
});
