import { client } from "@/api/client";
import { toast } from "@/utils/toast";
import { Carrera, PreinscripcionOut } from "@/types/preinscripcion";
import dayjs from "dayjs";

async function tryGet(path: string): Promise<Carrera[] | null> {
  try {
    const res = await client.get(path, { validateStatus: () => true });
    const { status, data } = res;
    void 0;
    if (status >= 200 && status < 300) {
      if (Array.isArray(data?.data)) return data.data as Carrera[]; // {ok,message,data:[...]}
      if (Array.isArray(data)) return data as Carrera[]; // array plano
      return [];
    }
    return null; // permite que probemos la siguiente ruta
  } catch (_e) {
    void 0;
    return null;
  }
}

export async function listarCarreras(): Promise<Carrera[]> {
  // Usamos el endpoint público de preinscripciones
  const out = await tryGet("/preinscripciones/carreras?vigentes=true");
  return out ?? [];
}

interface NinjaErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      detail?: NinjaErrorDetail[] | string;
      message?: string;
    };
  };
}

export interface PreinscripcionFormValues {
  carrera_id?: number | string;
  foto_4x4_dataurl?: string | null;
  foto_dataUrl?: string | null;
  doc_dni?: boolean | null;
  doc_secundario?: boolean | null;
  doc_constancia_cuil?: boolean | null;
  doc_cert_trabajo?: boolean | null;
  doc_buenasalud?: boolean | null;
  doc_foto4x4?: boolean | null;
  doc_titulo_en_tramite?: boolean | null;
  doc_otro?: boolean | null;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  genero?: string | null;
  localidad_nac?: string | null;
  provincia_nac?: string | null;
  pais_nac?: string | null;
  tel_fijo?: string | null;
  tel_movil?: string | null;
  emergencia_telefono?: string | null;
  emergencia_parentesco?: string | null;
  sec_titulo?: string | null;
  sec_establecimiento?: string | null;
  sec_fecha_egreso?: string | Date | null;
  sec_localidad?: string | null;
  sec_provincia?: string | null;
  sec_pais?: string | null;
  sup1_titulo?: string | null;
  sup1_establecimiento?: string | null;
  sup1_fecha_egreso?: string | Date | null;
  sup1_localidad?: string | null;
  sup1_provincia?: string | null;
  sup1_pais?: string | null;
  trabaja?: boolean | null;
  empleador?: string | null;
  horario_trabajo?: string | null;
  horario?: string | null;
  domicilio_trabajo?: string | null;
  dom_trabajo?: string | null;
  cud_informado?: boolean | null;
  condicion_salud_informada?: boolean | null;
  condicion_salud_detalle?: string | null;
  cohorte?: string | number | null;
  dni?: string | number | null;
  nombres?: string | null;
  apellido?: string | null;
  cuil?: string | null;
  fecha_nacimiento?: string | Date | null;
  email?: string | null;
  domicilio?: string | null;
  estudiante?: {
    dni?: string | number | null;
    nombres?: string | null;
    apellido?: string | null;
    cuil?: string | null;
    fecha_nacimiento?: string | Date | null;
    email?: string | null;
    telefono?: string | null;
    domicilio?: string | null;
    genero?: string | null;
  } | null;
}

function humanizeNinjaErrors(err: unknown): string {
  // Django Ninja suele mandar {detail: [{loc: ["body","campo"], msg: "error"...}, ...]}
  const apiErr = err as ApiErrorResponse;
  const detail = apiErr.response?.data?.detail;
  if (Array.isArray(detail) && detail.length) {
    const msgs = detail.slice(0, 6).map((e) => {
      const loc = Array.isArray(e.loc) ? e.loc.slice(1).join(".") : e.loc; // saco "body"
      return `• ${loc}: ${e.msg}`;
    });
    return `Revisá estos campos:\n${msgs.join("\n")}`;
  }
  // Ninja también puede devolver {detail: "texto"}
  if (typeof detail === "string") return detail;
  // Fallback
  return "Datos inválidos. Verificá campos obligatorios y formatos.";
}

function asDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const iso = dayjs(value, "YYYY-MM-DD", true);
  if (iso.isValid()) return iso.format("YYYY-MM-DD");
  const dmy = dayjs(value, "DD/MM/YYYY", true);
  return dmy.isValid() ? dmy.format("YYYY-MM-DD") : null;
}

function mapToApiPayload(v: PreinscripcionFormValues) {
  return {
    carrera_id: Number(v.carrera_id),
    foto_4x4_dataurl: v.foto_4x4_dataurl || v.foto_dataUrl || null,
    doc_dni: !!v.doc_dni,
    doc_secundario: !!v.doc_secundario,
    doc_constancia_cuil: !!v.doc_constancia_cuil,
    doc_cert_trabajo: !!v.doc_cert_trabajo,
    doc_buenasalud: !!v.doc_buenasalud,
    doc_foto4x4: !!v.doc_foto4x4,
    doc_titulo_en_tramite: !!v.doc_titulo_en_tramite,
    doc_otro: !!v.doc_otro,
    // datos personales extra
    nacionalidad: v.nacionalidad || null,
    estado_civil: v.estado_civil || null,
    genero: v.genero || null,
    localidad_nac: v.localidad_nac || null,
    provincia_nac: v.provincia_nac || null,
    pais_nac: v.pais_nac || null,
    // contacto extra
    tel_fijo: v.tel_fijo || null,
    tel_movil: v.tel_movil || null,
    emergencia_telefono: v.emergencia_telefono || null,
    emergencia_parentesco: v.emergencia_parentesco || null,
    // secundario
    sec_titulo: v.sec_titulo || null,
    sec_establecimiento: v.sec_establecimiento || null,
    sec_fecha_egreso: asDate(v.sec_fecha_egreso),
    sec_localidad: v.sec_localidad || null,
    sec_provincia: v.sec_provincia || null,
    sec_pais: v.sec_pais || null,
    // superiores
    sup1_titulo: v.sup1_titulo || null,
    sup1_establecimiento: v.sup1_establecimiento || null,
    sup1_fecha_egreso: asDate(v.sup1_fecha_egreso),
    sup1_localidad: v.sup1_localidad || null,
    sup1_provincia: v.sup1_provincia || null,
    sup1_pais: v.sup1_pais || null,
    // laborales
    trabaja: !!v.trabaja,
    empleador: v.empleador || null,
    horario_trabajo: v.horario_trabajo || v.horario || null,
    domicilio_trabajo: v.domicilio_trabajo || v.dom_trabajo || null,
    // salud y otros
    cud_informado: !!v.cud_informado,
    condicion_salud_informada: !!v.condicion_salud_informada,
    condicion_salud_detalle: v.condicion_salud_detalle || null,
    cohorte: v.cohorte || null,
    // bloque estudiante (requerido por el backend)
    estudiante: {
      dni: String(v?.estudiante?.dni ?? v.dni ?? ""),
      nombres: String(v?.estudiante?.nombres ?? v.nombres ?? ""),
      apellido: String(v?.estudiante?.apellido ?? v.apellido ?? ""),
      cuil: v?.estudiante?.cuil ?? v.cuil ?? null,
      fecha_nacimiento: asDate(v?.estudiante?.fecha_nacimiento ?? v.fecha_nacimiento),
      email: v?.estudiante?.email ?? v.email ?? null,
      telefono: v?.estudiante?.telefono ?? v.tel_movil ?? v.tel_fijo ?? null,
      domicilio: v?.estudiante?.domicilio ?? v.domicilio ?? null,
      genero: v.genero || null,
    },
  };
}

export async function crearPreinscripcion(payload: PreinscripcionFormValues): Promise<PreinscripcionOut> {
  try {
    const apiPayload = mapToApiPayload(payload);
    const { data } = await client.post("/preinscripciones", apiPayload);
    toast.success("¡Preinscripción enviada!");
    return data as PreinscripcionOut;
  } catch (err: unknown) {
    const apiErr = err as ApiErrorResponse;
    if (apiErr.response?.status === 422) {
      const msg = humanizeNinjaErrors(err);
      toast.error(msg);
      void 0;
      void 0;
    } else {
      // Para otros errores (500, red, etc.), mostramos mensaje del backend si viene
      const backendMsg = apiErr.response?.data?.message || apiErr.response?.data?.detail;
      if (typeof backendMsg === "string") toast.error(backendMsg);
      void 0;
      try {
        void 0;
      } catch (_e) { /* Ignored, used for debugging purposes */ }
      void 0;
    }
    throw err;
  }
}

export async function recuperarPreinscripcion(
  dni: string,
  carrera_id: number,
  fecha_nacimiento: string,
): Promise<{ ok: boolean; message?: string; data?: { id: number; codigo: string; estado: string; pdf_url: string } }> {
  try {
    const { data } = await client.post("/preinscripciones/recuperar", {
      dni,
      carrera_id: Number(carrera_id),
      fecha_nacimiento,
    });
    return data;
  } catch (err: unknown) {
    const apiErr = err as ApiErrorResponse;
    const backendMsg = apiErr.response?.data?.message || apiErr.response?.data?.detail;
    if (typeof backendMsg === "string") {
      toast.error(backendMsg);
    } else {
      toast.error("Error al recuperar la preinscripción.");
    }
    throw err;
  }
}





