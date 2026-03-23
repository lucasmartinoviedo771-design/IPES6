import dayjs from "dayjs";
import { Option, CalendarioEventoFormValues } from "./types";

export const today = dayjs().format("YYYY-MM-DD");

export const tipoOptions: Option[] = [
  { id: 1, label: "Feriado" },
  { id: 2, label: "Suspensión de actividades" },
  { id: 3, label: "Licencia institucional" },
  { id: 4, label: "Feria / período sin asistencia" },
];

export const tipoValueMap: Record<number, string> = {
  1: "feriado",
  2: "suspension",
  3: "licencia",
  4: "receso",
};

export const subtipoOptions: Record<string, Option[]> = {
  feriado: [
    { id: 1, label: "General" },
    { id: 2, label: "Feria académica / receso" },
    { id: 3, label: "Período sin asistencia" },
    { id: 4, label: "Otro" },
  ],
  suspension: [
    { id: 1, label: "General" },
    { id: 2, label: "Período sin asistencia" },
    { id: 3, label: "Otro" },
  ],
  licencia: [
    { id: 1, label: "Licencia especial de invierno" },
    { id: 2, label: "Licencia anual reglamentaria (LAR)" },
    { id: 3, label: "Licencia docente individual" },
    { id: 4, label: "Otro" },
  ],
  receso: [
    { id: 1, label: "Feria académica / receso" },
    { id: 2, label: "Período sin asistencia" },
    { id: 3, label: "General" },
  ],
};

export const subtipoValueMap: Record<string, Record<number, string>> = {
  feriado: {
    1: "general",
    2: "feria_academica",
    3: "periodo_sin_asistencia",
    4: "otro",
  },
  suspension: {
    1: "general",
    2: "periodo_sin_asistencia",
    3: "otro",
  },
  licencia: {
    1: "licencia_invierno",
    2: "licencia_anual",
    3: "licencia_docente",
    4: "otro",
  },
  receso: {
    1: "feria_academica",
    2: "periodo_sin_asistencia",
    3: "general",
  },
};

export const quickRanges = [
  { label: "LAR (50 días)", days: 50, subtipo: "licencia_anual" },
  { label: "Invierno (15 días)", days: 15, subtipo: "licencia_invierno" },
];

export const defaultValues: CalendarioEventoFormValues = {
  nombre: "",
  tipo: "feriado",
  subtipo: "general",
  fecha_desde: today,
  fecha_hasta: today,
  turnos: [],
  aplica_docentes: true,
  aplica_estudiantes: true,
  motivo: "",
  profesorado_id: null,
  plan_id: null,
  comision_id: null,
  docente_id: null,
};
