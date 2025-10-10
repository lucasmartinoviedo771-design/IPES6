import { client } from "@/api/client";
import { toast } from "@/utils/toast";
import { Carrera } from "@/types/preinscripcion";

async function tryGet(path: string): Promise<Carrera[] | null> {
  try {
    const res = await client.get(path, { validateStatus: () => true });
    const { status, data } = res;
    console.info("[carreras][GET]", status, path, data);
    if (status >= 200 && status < 300) {
      if (Array.isArray(data?.data)) return data.data as Carrera[]; // {ok,message,data:[...]}
      if (Array.isArray(data)) return data as Carrera[];            // array plano
      return [];
    }
    return null; // permite que probemos la siguiente ruta
  } catch (e) {
    console.warn("[carreras][error]", path, e);
    return null;
  }
}

export async function listarCarreras(): Promise<Carrera[]> {
  const paths = [
    "/preinscriptions/carreras?vigentes=true",
    "/preinscriptions/carreras",     // por si el backend no usa el query
    "/carreras?vigentes=true",       // fallback alterno si cambió el router
    "/carreras",
  ];
  for (const p of paths) {
    const out = await tryGet(p);
    if (out && out.length >= 0) return out; // si es [] igualmente lo devolvemos
  }
  return [];
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

export async function crearPreinscripcion(payload: any) {
  try {
    const { data } = await client.post("/preinscriptions", payload);
    toast.success("¡Preinscripción enviada!");
    return data;
  } catch (err: any) {
    if (err?.response?.status === 422) {
      const msg = humanizeNinjaErrors(err);
      toast.error(msg);
      console.error("[422 payload]", payload);
      console.error("[422 response]", err?.response?.data);
    } else {
      // Para otros errores (500, red, etc.), mantenemos el toast genérico del interceptor
      console.error(err);
    }
    throw err;
  }
}