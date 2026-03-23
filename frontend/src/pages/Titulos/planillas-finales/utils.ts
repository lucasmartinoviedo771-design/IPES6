export const CURRENT_YEAR = new Date().getFullYear().toString();

export const CUATRIMESTRE_LABELS: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Ciclo anual",
};

export const MODALIDAD_LABELS: Record<string, string> = {
  REG: "Regular",
  LIB: "Libre",
};

export const MESA_TIPO_LABELS: Record<string, string> = {
  FIN: "Ordinaria",
  EXT: "Extraordinaria",
  ESP: "Especial",
};

export const formatDictado = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return CUATRIMESTRE_LABELS[key] ?? value;
};

export const formatHora = (value?: string | null) => {
  if (!value) return "-";
  const trimmed = value.length > 5 ? value.slice(0, 5) : value;
  return `${trimmed} hs`;
};

export const formatModalidad = (value?: string | null) => {
  if (!value) return "-";
  return MODALIDAD_LABELS[value] ?? value;
};

export const formatMesaTipo = (value?: string | null) => {
  if (!value) return "-";
  return MESA_TIPO_LABELS[value] ?? value;
};

export const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
};
