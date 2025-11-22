import { client } from "@/api/client";
import dayjs from "dayjs";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
}

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
  client.get(`/preinscripciones/${id}`).then(r => r.data);

export const obtenerPorCodigo = (codigo: string) =>
  client.get(`/preinscripciones/by-code/${encodeURIComponent(codigo)}`).then(r => r.data);

export const patchPreByCodigo = (codigo: string, values: any) =>
  client.patch(`/preinscripciones/by-code/${encodeURIComponent(codigo)}`, mapFormToPayload(values)).then(r => r.data);

export const confirmarPreinscripcionById = (id: number, data: any) =>
  client.post(`/preinscripciones/${id}/confirmar`, data).then(r => r.data);

export const crearInscripcion = (preId: number, carreraId: number, periodo = "2025") =>
  client.post(`/inscripciones`, { preinscripcion: preId, carrera: carreraId, periodo }).then(r => r.data);

export const listarCarreras = () =>
  client.get(`/carreras/`).then(r => r.data);

export const listarPreinscripciones = (params: { q?: string; limit?: number; offset?: number; include_inactivas?: boolean }) =>
  client.get<PreinscripcionDTO[] | { results: PreinscripcionDTO[] }>("/preinscripciones/", { params }).then(r => (Array.isArray(r.data) ? { results: r.data } : r.data));

export const activarPreinscripcion = (id: number) =>
  client.post(`/preinscripciones/${id}/activar`).then(r => r.data);

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
    nombres?: string;
    nombre?: string;
    apellido: string;
    email: string;
    telefono?: string;
    domicilio?: string;
    fecha_nacimiento?: string;
    cuil?: string;
  };
  carrera: { id: number; nombre: string; es_certificacion_docente?: boolean };
  // ...otros campos que ya tengas
}

export async function apiGetPreinscripcionByCodigo(codigo: string) {
  const { data } = await client.get<PreinscripcionDTO>(`/preinscripciones/by-code/${encodeURIComponent(codigo)}`);
  return data;
}

export type PreinscripcionUpdatePayload = {
  carrera_id?: number;
  alumno?: {
    dni: string;
    nombres: string;
    apellido: string;
    cuil?: string | null;
    fecha_nacimiento?: string | null;
    email?: string | null;
    telefono?: string | null;
    domicilio?: string | null;
  };
  datos_extra?: Record<string, unknown>;
};

export async function apiUpdatePreinscripcion(codigo: string, payload: PreinscripcionUpdatePayload) {
  const { data } = await client.put(`/preinscripciones/by-code/${encodeURIComponent(codigo)}`, payload);
  return data;
}

export async function apiConfirmarPreinscripcion(codigo: string, payload?: any) {
  const { data } = await client.post(`/preinscripciones/by-code/${encodeURIComponent(codigo)}/confirmar`, payload ?? {});
  return data;
}

export async function listarPreinscripcionesAlumno(dni: string) {
  const { data } = await client.get<PreinscripcionDTO[]>(`/preinscripciones/alumno/${encodeURIComponent(dni)}`);
  return data;
}

export async function agregarCarreraPreinscripcion(codigo: string, carreraId: number, anio?: number) {
  const payload: { carrera_id: number; anio?: number } = { carrera_id: carreraId };
  if (typeof anio === "number" && Number.isFinite(anio) && anio > 0) {
    payload.anio = anio;
  }
  const { data } = await client.post<ApiResponse<PreinscripcionDTO>>(
    `/preinscripciones/by-code/${encodeURIComponent(codigo)}/carreras`,
    payload,
  );
  return data;
}

export async function apiObservarPreinscripcion(codigo: string, motivo: string) {
  const { data } = await client.post(`/preinscripciones/by-code/${encodeURIComponent(codigo)}/observar`, { motivo });
  return data;
}

export async function apiRechazarPreinscripcion(codigo: string, motivo: string) {
  const { data } = await client.post(`/preinscripciones/by-code/${encodeURIComponent(codigo)}/rechazar`, { motivo });
  return data;
}

export async function apiCambiarCarrera(codigo: string, carrera_id: number) {
  const { data } = await client.post(`/preinscripciones/by-code/${encodeURIComponent(codigo)}/cambiar-carrera`, { carrera_id });
  return data;
}
export const eliminarPreinscripcion = (id: number) => client.delete(`/preinscripciones/${id}`).then(r => r.status === 204);

// Checklist (documentación) helpers
export interface ChecklistDTO {
  dni_legalizado: boolean;
  fotos_4x4: boolean;
  certificado_salud: boolean;
  folios_oficio: number; // cantidad

  titulo_secundario_legalizado: boolean;
  certificado_titulo_en_tramite: boolean;
  analitico_legalizado: boolean;
  certificado_alumno_regular_sec: boolean;

  adeuda_materias: boolean;
  adeuda_materias_detalle?: string;
  escuela_secundaria?: string;

  es_certificacion_docente?: boolean;
  titulo_terciario_univ?: boolean;
  incumbencia?: boolean;
  estado_legajo?: string;
  curso_introductorio_aprobado?: boolean;
}

export const apiGetChecklist = async (preId: number) => {
  const { data } = await client.get<ChecklistDTO>(`/preinscripciones/${preId}/checklist`);
  return data;
};

export const apiPutChecklist = async (preId: number, payload: ChecklistDTO) => {
  const { data } = await client.put<ChecklistDTO>(`/preinscripciones/${preId}/checklist`, payload);
  return data;
};

// Archivos/documentos de preinscripción (subida y listado)
export type PreDocItem = {
  id: number;
  tipo: string;
  nombre_original: string;
  tamano: number;
  content_type: string;
  url?: string;
  creado_en: string;
};

export const apiListPreDocs = async (preId: number): Promise<PreDocItem[]> => {
  const token = localStorage.getItem("token");
  const { data } = await client.get<{ count: number; results: PreDocItem[] }>(`/preinscripciones/${preId}/documentos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.results || [];
};

export const apiUploadPreDoc = async (preId: number, tipo: string, file: File) => {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append('file', file);
  const { data } = await client.post(`/preinscripciones/${preId}/documentos?tipo=${tipo}`, form, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};
