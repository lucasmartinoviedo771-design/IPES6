import dayjs from "dayjs";

export type TestVentana = {
  id: number;
  tipo: string;
  desde: string;
  hasta: string;
  activo: boolean;
  periodo?: "1C_ANUALES" | "2C";
};

const TIPOS: Array<{ tipo: string; periodo?: "1C_ANUALES" | "2C" }> = [
  { tipo: "PREINSCRIPCION" },
  { tipo: "MATERIAS", periodo: "1C_ANUALES" },
  { tipo: "COMISION" },
  { tipo: "ANALITICOS" },
  { tipo: "MESAS_FINALES" },
  { tipo: "MESAS_LIBRES" },
  { tipo: "MESAS_EXTRA" },
];

let testModeEnabled = false;
let cachedVentanas: TestVentana[] = [];

const generateVentanas = (): TestVentana[] => {
  const start = dayjs().subtract(3, "day");
  const end = dayjs().add(30, "day");

  return TIPOS.map((entry, index) => ({
    id: -(index + 1),
    tipo: entry.tipo,
    desde: start.format("YYYY-MM-DD"),
    hasta: end.format("YYYY-MM-DD"),
    activo: true,
    periodo: entry.periodo,
  }));
};

export const isTestModeEnabled = () => testModeEnabled;

export const setTestMode = (enabled: boolean) => {
  testModeEnabled = enabled;
  if (enabled) {
    cachedVentanas = generateVentanas();
  }
};

export const getTestVentanas = (params?: { tipo?: string }) => {
  const base = cachedVentanas.length ? cachedVentanas : generateVentanas();
  const filtered = params?.tipo ? base.filter((v) => v.tipo === params.tipo) : base;
  // Return cloned objects to avoid accidental mutations
  return filtered.map((v) => ({ ...v }));
};
