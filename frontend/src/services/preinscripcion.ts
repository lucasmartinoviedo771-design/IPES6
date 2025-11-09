import { client } from "@/api/client";
import { toast } from "@/utils/toast";
import { Carrera, PreinscripcionOut } from "@/types/preinscripcion";
import dayjs from "dayjs";

async function tryGet(path: string): Promise<Carrera[] | null> {
  try {
    const res = await client.get(path, { validateStatus: () => true });
    const { status, data } = res;
    console.info("[carreras][GET]", status, path, data);
    if (status >= 200 && status < 300) {
      if (Array.isArray(data?.data)) return data.data as Carrera[]; // {ok,message,data:[...]}
      if (Array.isArray(data)) return data as Carrera[]; // array plano
      return [];
    }
    return null; // permite que probemos la siguiente ruta
  } catch (e) {
    console.warn("[carreras][error]", path, e);
    return null;
  }
}

export async function listarCarreras(): Promise<Carrera[]> {
  // El endpoint correcto está en /profesorados, no /carreras
  const out = await tryGet("/profesorados?vigentes=true");
  return out ?? [];
}

function humanizeNinjaErrors(err: any): string {
  // Django Ninja suele mandar {detail: [{loc: ["body","campo"], msg: "error"...}, ...]}
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail) && detail.length) {
    const msgs = detail.slice(0, 6).map((e: any) => {
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

function asDate(value: any): string | null {
  if (!value) return null;
  const iso = dayjs(value as any, "YYYY-MM-DD", true);
  if (iso.isValid()) return iso.format("YYYY-MM-DD");
  const dmy = dayjs(value as any, "DD/MM/YYYY", true);
  return dmy.isValid() ? dmy.format("YYYY-MM-DD") : null;
}

function mapToApiPayload(v: any) {
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
    // datos personales extra\n    nacionalidad: v.nacionalidad || null,
    estado_civil: v.estado_civil || null,
    localidad_nac: v.localidad_nac || null,
    provincia_nac: v.provincia_nac || null,
    pais_nac: v.pais_nac || null,
    // contacto extra
    tel_fijo: v.tel_fijo || null,
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
    // laborales
    trabaja: !!v.trabaja,
    empleador: v.empleador || null,
    horario_trabajo: v.horario_trabajo || v.horario || null,
    domicilio_trabajo: v.domicilio_trabajo || v.dom_trabajo || null,
    // bloque alumno (requerido por el backend)
    alumno: {
      dni: String(v?.alumno?.dni ?? v.dni ?? ""),
      nombres: String(v?.alumno?.nombres ?? v.nombres ?? ""),
      apellido: String(v?.alumno?.apellido ?? v.apellido ?? ""),
      cuil: v?.alumno?.cuil ?? v.cuil ?? null,
      fecha_nacimiento: asDate(v?.alumno?.fecha_nacimiento ?? v.fecha_nacimiento),
      email: v?.alumno?.email ?? v.email ?? null,
      telefono: v?.alumno?.telefono ?? v.tel_movil ?? v.tel_fijo ?? null,
      domicilio: v?.alumno?.domicilio ?? v.domicilio ?? null,
    },
  };
}

export async function crearPreinscripcion(payload: any): Promise<PreinscripcionOut> {
  try {
    const apiPayload = mapToApiPayload(payload);
    const { data } = await client.post("/preinscripciones", apiPayload);
    toast.success("¡Preinscripción enviada!");
    return data as PreinscripcionOut;
  } catch (err: any) {
    if (err?.response?.status === 422) {
      const msg = humanizeNinjaErrors(err);
      toast.error(msg);
      console.error("[422 payload]", payload);
      console.error("[422 response]", err?.response?.data);
    } else {
      // Para otros errores (500, red, etc.), mostramos mensaje del backend si viene
      const backendMsg = err?.response?.data?.message || err?.response?.data?.detail;
      if (backendMsg) toast.error(backendMsg);
      console.error("[crearPreinscripcion][payload]", payload);
      try {
        console.error("[crearPreinscripcion][mapped]", mapToApiPayload(payload));
      } catch (e) { /* Ignored, used for debugging purposes */ }
      console.error("[crearPreinscripcion][response]", err?.response?.status, err?.response?.data);
    }
    throw err;
  }
}




