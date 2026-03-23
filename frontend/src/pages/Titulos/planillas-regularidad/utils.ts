export const CURRENT_YEAR = new Date().getFullYear().toString();

export const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value}`.replace(".", ",");
};

export const formatPercentage = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
};

export const FORMATO_LABELS: Record<string, string> = {
  TAL: "Taller",
  TEO: "Teórico",
  PRA: "Práctica",
  SEM: "Seminario",
  CUR: "Curso",
};

export const CUATRIMESTRE_LABELS: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Ciclo anual",
};

export const formatFormato = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return FORMATO_LABELS[key] ?? value;
};

export const formatDictado = (value?: string | null) => {
  if (!value) return "-";
  const key = value.toUpperCase();
  return CUATRIMESTRE_LABELS[key] ?? value;
};
