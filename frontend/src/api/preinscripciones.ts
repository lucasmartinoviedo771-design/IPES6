import { client } from "@/api/client";
import dayjs from "dayjs";

const d = (s?: string) => (s ? dayjs(s).format("YYYY-MM-DD") : null);

export function mapFormToPayload(v: any) {
  return {
    // personales
    apellido: v.apellido, nombres: v.nombres, dni: v.dni, cuil: v.cuil,
    fecha_nacimiento: d(v.fecha_nacimiento),
    nacionalidad: v.nacionalidad, estado_civil: v.estado_civil,
    localidad_nac: v.localidad_nac, provincia_nac: v.provincia_nac, pais_nac: v.pais_nac,
    domicilio: v.domicilio,
    // contacto
    email: v.email, tel_movil: v.tel_movil, tel_fijo: v.tel_fijo,
    emergencia_telefono: v.emergencia_telefono,
    emergencia_parentesco: v.emergencia_parentesco,
    // laborales
    trabaja: !!v.trabaja, empleador: v.empleador, horario: v.horario, dom_trabajo: v.dom_trabajo,
    // estudios
    sec_titulo: v.sec_titulo, sec_establecimiento: v.sec_establecimiento,
    sec_fecha_egreso: d(v.sec_fecha_egreso),
    sec_localidad: v.sec_localidad, sec_provincia: v.sec_provincia, sec_pais: v.sec_pais,
    sup1_titulo: v.sup1_titulo, sup1_establecimiento: v.sup1_establecimiento,
    sup1_fecha_egreso: d(v.sup1_fecha_egreso),
    // carrera (opcional en pre)
    carrera_id: v.carrera_id ?? null,
  };
}

export const crearPreinscripcion = (formData: FormData) =>
  client.post("/preinscripciones", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const obtenerPreinscripcion = (id: number) =>
  client.get(`/preinscriptions/${id}`).then(r => r.data);

export const obtenerPorCodigo = (codigo: string) =>
  client.get(`/preinscriptions/by-code/${encodeURIComponent(codigo)}`).then(r => r.data);

export const patchPreByCodigo = (codigo: string, values: any) =>
  client.patch(`/preinscriptions/by-code/${encodeURIComponent(codigo)}`, mapFormToPayload(values)).then(r => r.data);

export const confirmarPreinscripcionById = (id: number, data: any) =>
  client.post(`/preinscriptions/${id}/confirmar`, data).then(r => r.data);

export const crearInscripcion = (preId: number, carreraId: number, periodo = "2025") =>
  client.post(`/inscripciones`, { preinscripcion: preId, carrera: carreraId, periodo }).then(r => r.data);

export const listarCarreras = () =>
  client.get(`/carreras`).then(r => r.data);

export const listarPreinscripciones = (params: { q?: string; limit?: number; offset?: number; include_inactivas?: boolean }) =>
  client.get<PreinscripcionDTO[] | { results: PreinscripcionDTO[] }>("/preinscriptions/", { params }).then(r => (Array.isArray(r.data) ? { results: r.data } : r.data));

export const activarPreinscripcion = (id: number) =>
  client.post(`/preinscriptions/${id}/activar`).then(r => r.data);

// Descarga del comprobante PDF: la ruta NO cuelga de /api, es servidor Django raíz
export const descargarPdf = (id: number) => {
  // Normalizar base quitando sufijo /api si está presente
  const raw = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
  const base = raw.replace(/\/api\/?$/, "");
  const url = `${base}/preinscripciones/${id}/pdf`;
  window.open(url, "_blank");
};

// New types and functions for PreConfirmEditor

export type PreEstado = "borrador" | "enviada" | "observada" | "confirmada" | "rechazada";

export interface PreinscripcionDTO {
  id: number;
  codigo: string;          // PRE-2024-001
  estado: PreEstado;
  fecha: string;
  activa?: boolean;
      alumno: {
      dni: string;
      nombre: string;
      apellido: string;
      email: string;
      telefono?: string;
      domicilio?: string;
      fecha_nacimiento?: string;
      cuil?: string;
    };  carrera: { id: number; nombre: string };
  // ...otros campos que ya tengas
}

export async function apiGetPreinscripcionByCodigo(codigo: string) {
  const { data } = await client.get<PreinscripcionDTO>(`/preinscriptions/by-code/${encodeURIComponent(codigo)}`);
  return data;
}

export async function apiUpdatePreinscripcion(codigo: string, payload: Partial<PreinscripcionDTO>) {
  const { data } = await client.put(`/preinscriptions/by-code/${encodeURIComponent(codigo)}`, payload);
  return data;
}

export async function apiConfirmarPreinscripcion(codigo: string, payload?: any) {
  const { data } = await client.post(`/preinscriptions/by-code/${encodeURIComponent(codigo)}/confirmar`, payload ?? {});
  return data;
}

export async function apiObservarPreinscripcion(codigo: string, motivo: string) {
  const { data } = await client.post(`/preinscriptions/by-code/${encodeURIComponent(codigo)}/observar`, { motivo });
  return data;
}

export async function apiRechazarPreinscripcion(codigo: string, motivo: string) {
  const { data } = await client.post(`/preinscriptions/by-code/${encodeURIComponent(codigo)}/rechazar`, { motivo });
  return data;
}

export async function apiCambiarCarrera(codigo: string, carrera_id: number) {
  const { data } = await client.post(`/preinscriptions/by-code/${encodeURIComponent(codigo)}/cambiar-carrera`, { carrera_id });
  return data;
}
export const eliminarPreinscripcion = (id: number) => client.delete(`/preinscriptions/${id}`).then(r => r.status === 204);
