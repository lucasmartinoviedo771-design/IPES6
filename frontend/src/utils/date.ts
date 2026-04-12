import dayjs from "dayjs";
import "dayjs/locale/es";

// Configurar español por defecto
dayjs.locale("es");

/**
 * Verifica si un string tiene el formato DD/MM/YYYY
 */
export const isValidDDMMYYYY = (s: string) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(s) && dayjs(s, "DD/MM/YYYY", true).isValid();

/**
 * Convierte DD/MM/YYYY a ISO (YYYY-MM-DD)
 */
export const ddmmyyyyToISO = (s: string) => {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  const d = dayjs(s, "DD/MM/YYYY", true);
  if (!d.isValid()) throw new Error("Fecha inválida (DD/MM/YYYY)");
  return d.format("YYYY-MM-DD");
};

/**
 * Formatea una fecha de forma robusta.
 * 1. Si ya viene como DD/MM/YYYY (backend lo envía así en mesas), lo devuelve directo.
 * 2. Si viene como YYYY-MM-DD, lo formatea manualmente para evitar desfase UTC.
 * 3. Fallback a dayjs para otros formatos.
 */
export const formatDate = (date: string | Date | null | undefined, format: string = "DD/MM/YYYY") => {
  if (!date) return "-";

  // Caso 1: Ya viene formateado como DD/MM/YYYY (Ej: Mesas de examen)
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date;
  }

  // Caso 2: Viene como ISO corto YYYY-MM-DD (Ej: Equivalencias)
  // Evitamos new Date() o dayjs directo para no sufrir el desplazamiento de zona horaria (UTC jump)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    if (format === "DD/MM/YYYY") return `${d}/${m}/${y}`;
    // Si piden otro formato específico para ISO corto, usamos dayjs pero forzando local
    return dayjs(`${y}/${m}/${y}`).format(format);
  }

  // Caso 3: Objeto Date o ISO completo
  const d = dayjs(date);
  if (!d.isValid()) return "Fecha inválida";
  return d.format(format);
};

/**
 * Formatea una fecha y hora ISO a formato legible.
 */
export const formatDateTime = (date: string | Date | null | undefined, format: string = "DD/MM/YYYY HH:mm") => {
  if (!date) return "-";
  const d = dayjs(date);
  if (!d.isValid()) return "Fecha inválida";
  return d.format(format);
};

/**
 * Alias para compatibilidad con código antiguo.
 */
export const formatDateToDDMMYYYY = (date: string | Date | null | undefined) => formatDate(date);
export const formatDateToDDMMYY = (date: string | Date | null | undefined) => formatDate(date);
export const formatDateTimeToDDMMYYYY = (date: string | Date | null | undefined) => formatDateTime(date);
