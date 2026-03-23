import { MateriaPlanDTO } from "@/api/estudiantes";

export type Horario = { dia: string; desde: string; hasta: string };

export type Materia = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: "ANUAL" | "1C" | "2C";
  horarios: Horario[];
  correlativasRegular: number[];
  correlativasAprob: number[];
  profesorado?: string;
  profesoradoId?: number | null;
  planId?: number | null;
};

export const cuatrimestreCompatible = (a: Materia["cuatrimestre"], b: Materia["cuatrimestre"]) => {
  if (a === "ANUAL" || b === "ANUAL") return true;
  return a === b;
};

export type Status = "aprobada" | "habilitada" | "bloqueada";
export type TipoBloqueo = "correlativas" | "periodo" | "choque" | "inscripta" | "otro";

export type MateriaEvaluada = Materia & {
  status: Status;
  motivos: string[];
  tipoBloqueo?: TipoBloqueo;
  faltantesRegular?: string[];
  faltantesAprob?: string[];
};

export function mapMateria(dto: MateriaPlanDTO): Materia {
  return {
    id: dto.id,
    nombre: dto.nombre,
    anio: dto.anio,
    cuatrimestre: dto.cuatrimestre,
    horarios: dto.horarios,
    correlativasRegular: dto.correlativas_regular || [],
    correlativasAprob: dto.correlativas_aprob || [],
    profesorado: dto.profesorado,
    profesoradoId: dto.profesorado_id ?? null,
    planId: dto.plan_id ?? null,
  };
}

export function hayChoque(a: Horario[], b: Horario[]) {
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3));
  for (const ha of a) {
    for (const hb of b) {
      if (ha.dia !== hb.dia) continue;
      const a1 = toMin(ha.desde); const a2 = toMin(ha.hasta);
      const b1 = toMin(hb.desde); const b2 = toMin(hb.hasta);
      if (Math.max(a1, b1) < Math.min(a2, b2)) return true;
    }
  }
  return false;
}

export const STATUS_LABEL: Record<Status, string> = {
  habilitada: "Habilitada",
  bloqueada: "No disponible",
  aprobada: "Materia aprobada",
};

export const BLOQUEO_LABEL: Record<TipoBloqueo | "otros", string> = {
  correlativas: "Correlativas pendientes",
  periodo: "Fuera de la ventana de inscripción",
  choque: "Superposición horaria",
  inscripta: "Ya inscripta",
  otro: "Otros motivos",
  otros: "Otros motivos",
};

export const EMPTY_HISTORIAL = {
  aprobadas: [] as number[],
  regularizadas: [] as number[],
  inscriptas_actuales: [] as number[],
};
