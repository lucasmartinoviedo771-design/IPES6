import dayjs from "dayjs";
import { VentanaDto } from "@/api/ventanas";

export type Ventana = VentanaDto;

export const LABEL_PERIODO: Record<string, string> = {
  "1C_ANUALES": "1er Cuatrimestre + Anuales",
  "2C": "2do Cuatrimestre",
  "1C": "1er Cuatrimestre",
};

export const TYPE_CONFIG: Array<{
  key: Ventana["tipo"];
  label: string;
  category: "mesas" | "tramites";
  description: string;
}> = [
  {
    key: "MESAS_FINALES",
    label: "Mesas de examen - Ordinarias",
    category: "mesas",
    description: "Ventanas para las mesas ordinarias (antes denominadas finales).",
  },
  {
    key: "MESAS_EXTRA",
    label: "Mesas de examen - Extraordinarias",
    category: "mesas",
    description: "Ventanas para mesas extraordinarias habilitadas por dirección.",
  },
  {
    key: "MATERIAS",
    label: "Inscripciones a Materias",
    category: "tramites",
    description: "Períodos para que los estudiantes se inscriban a cursadas.",
  },
  {
    key: "COMISION",
    label: "Cambios de Comisión",
    category: "tramites",
    description: "Gestiona solicitudes de cambio de comisión.",
  },
  {
    key: "ANALITICOS",
    label: "Pedidos de Analiticos",
    category: "tramites",
    description: "Ventanas para solicitar constancias o analiticos.",
  },
  {
    key: "EQUIVALENCIAS",
    label: "Pedidos de Equivalencias",
    category: "tramites",
    description: "Periodos para cargar solicitudes de equivalencias curriculares.",
  },
  {
    key: "PREINSCRIPCION",
    label: "Preinscripción",
    category: "tramites",
    description: "Período de preinscripción inicial a la institución.",
  },
  {
    key: "CURSO_INTRODUCTORIO",
    label: "Curso Introductorio",
    category: "tramites",
    description: "Habilita la inscripción al Curso Introductorio y sus cohortes.",
  },
  {
    key: "CALENDARIO_CUATRIMESTRE",
    label: "Calendario académico - Cuatrimestres",
    category: "tramites",
    description:
      "Define las fechas de inicio y fin de los cuatrimestres. El segundo debe iniciar inmediatamente después del primero.",
  },
];

export const CATEGORY_CONFIG = [
  {
    id: "tramites",
    label: "Inscripciones y trámites",
    helper: "Habilita los períodos que impactan directamente en los estudiantes.",
  },
  {
    id: "mesas",
    label: "Mesas de examen",
    helper: "Configura las fechas de generación y cierre de las mesas finales.",
  },
];

export const TYPE_BY_CATEGORY = CATEGORY_CONFIG.reduce<Record<string, string[]>>((acc, category) => {
  acc[category.id] = TYPE_CONFIG.filter((type) => type.category === category.id).map((type) => type.key);
  return acc;
}, {});

export const CATEGORY_FROM_TYPE = TYPE_CONFIG.reduce<Record<string, string>>((acc, type) => {
  acc[type.key] = type.category;
  return acc;
}, {});

export type CalendarPeriod = "1C" | "2C";
export const CALENDAR_PERIODS: CalendarPeriod[] = ["1C", "2C"];
export const CALENDAR_TYPE = "CALENDARIO_CUATRIMESTRE";
export const makeCalendarDraftKey = (period: CalendarPeriod) => `${CALENDAR_TYPE}:${period}`;

export function defaultDraft(tipo: string): Ventana {
  return {
    tipo,
    activo: false,
    desde: dayjs().format("YYYY-MM-DD"),
    hasta: dayjs().add(7, "day").format("YYYY-MM-DD"),
    periodo: tipo === CALENDAR_TYPE ? "1C" : "1C_ANUALES",
  };
}

export const defaultFirstCalendarDraft = (): Ventana => {
  const base = defaultDraft(CALENDAR_TYPE);
  const baseYear = dayjs().year();
  const start = dayjs(`${baseYear}-03-01`);
  const end = start.add(4, "month").endOf("month");
  return {
    ...base,
    tipo: CALENDAR_TYPE,
    periodo: "1C",
    desde: start.format("YYYY-MM-DD"),
    hasta: end.format("YYYY-MM-DD"),
  };
};

export const buildDefaultCalendarDraft = (period: CalendarPeriod, reference?: Ventana): Ventana => {
  if (period === "1C") {
    return defaultFirstCalendarDraft();
  }
  const base = defaultDraft(CALENDAR_TYPE);
  const ref = reference ?? defaultFirstCalendarDraft();
  const refEnd = dayjs(ref.hasta || ref.desde || dayjs().format("YYYY-MM-DD"));
  const start = (refEnd.isValid() ? refEnd : dayjs()).add(1, "day");
  const end = start.add(4, "month").endOf("month");
  return {
    ...base,
    tipo: CALENDAR_TYPE,
    periodo: "2C",
    desde: start.format("YYYY-MM-DD"),
    hasta: end.format("YYYY-MM-DD"),
  };
};

export const formatRange = (ventana?: Ventana | null) => {
  if (!ventana) return "Sin ventana activa";
  return `${dayjs(ventana.desde).format("DD/MM/YYYY")} -> ${dayjs(ventana.hasta).format("DD/MM/YYYY")}`;
};

export const getPeriodoLabel = (periodo?: string | null) => {
  if (!periodo) return "Sin periodo asignado";
  return LABEL_PERIODO[periodo] ?? periodo;
};

export const today = () => dayjs();

export const classifyVentana = (ventana: Ventana | undefined) => {
  if (!ventana) return { label: "Sin ventana", color: "default" as const };
  const now = today();
  if (dayjs(ventana.desde).isSameOrBefore(now, "day") && dayjs(ventana.hasta).isSameOrAfter(now, "day")) {
    return { label: "Activa", color: "success" as const };
  }
  if (dayjs(ventana.desde).isAfter(now, "day")) {
    return { label: "Pendiente", color: "warning" as const };
  }
  return { label: "Vencida", color: "default" as const };
};
