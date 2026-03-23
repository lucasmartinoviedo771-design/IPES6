import { REGIMEN_LABEL } from "./types";

export const formatRegimen = (value?: string | null, fallback?: string | null) => {
  if (!value) return fallback ?? '-';
  return REGIMEN_LABEL[value] ?? value;
};

export const formatDate = (value?: string | null) => {
  if (!value) return '-';

  // Si coincide con formato YYYY-MM-DD (con o sin hora), priorizamos la parte de fecha
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    return `${d}/${m}/${y}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const notaToString = (nota?: number | null) => {
  if (nota === null || nota === undefined) return '-';
  if (Number.isInteger(nota)) return String(nota);
  return nota.toFixed(1).replace(/\\.?0+$/, '');
};

export function a11yProps(index: number) {
  return {
    id: `trayectoria-tab-${index}`,
    'aria-controls': `trayectoria-panel-${index}`,
  };
}
