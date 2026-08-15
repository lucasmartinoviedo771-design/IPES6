import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import "dayjs/locale/es";

// Configurar español por defecto
dayjs.locale("es");
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Verifica si un string tiene el formato DD/MM/YYYY
 */
const isValidDDMMYYYY = (s: string) =>
	/^\d{2}\/\d{2}\/\d{4}$/.test(s) && dayjs(s, "DD/MM/YYYY", true).isValid();

/**
 * Convierte DD/MM/YYYY a ISO (YYYY-MM-DD)
 */
const ddmmyyyyToISO = (s: string) => {
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
export const formatDate = (
	date: string | Date | null | undefined,
	format: string = "DD/MM/YYYY",
) => {
	if (!date) return "-";

	// Caso 1: Ya viene formateado como DD/MM/YYYY o contiene una fecha DD/MM/YYYY al inicio
	if (typeof date === "string" && /^\d{2}\/\d{2}\/\d{4}/.test(date)) {
		// Si solo tiene la fecha, la devolvemos. Si tiene hora, cortamos solo la fecha.
		return date.substring(0, 10);
	}

	// Caso 2: Viene como ISO corto YYYY-MM-DD (Ej: Equivalencias)
	if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		const [y, m, d] = date.split("-");
		if (format === "DD/MM/YYYY") return `${d}/${m}/${y}`;
		return dayjs(`${y}/${m}/${d}`).format(format);
	}

	// Caso 3: Objeto Date o ISO completo
	const d = dayjs(date);
	if (!d.isValid()) return "Fecha inválida";
	return d.format(format);
};

/**
 * Formatea una fecha y hora ISO a formato legible.
 */
const formatDateTime = (
	date: string | Date | null | undefined,
	format: string = "DD/MM/YYYY HH:mm",
) => {
	if (!date) return "-";
	const d = dayjs(date);
	if (!d.isValid()) return "Fecha inválida";
	return d.format(format);
};

/**
 * Alias para compatibilidad con código antiguo.
 */
export const formatDateToDDMMYYYY = (date: string | Date | null | undefined) =>
	formatDate(date);
export const formatDateToDDMMYY = (date: string | Date | null | undefined) =>
	formatDate(date);
export const formatDateTimeToDDMMYYYY = (
	date: string | Date | null | undefined,
) => formatDateTime(date);

/**
 * Determina si una ventana de habilitación se encuentra activa considerando
 * el rango de fechas por día calendario completo (hasta las 23:59:59 del día de cierre).
 */
export const isVentanaActiva = (
	ventana: {
		activo?: boolean;
		desde?: string | Date | null;
		hasta?: string | Date | null;
	} | null | undefined,
): boolean => {
	if (!ventana || !ventana.activo || !ventana.desde || !ventana.hasta) {
		return false;
	}
	const now = dayjs();
	const desde = dayjs(ventana.desde);
	const hasta = dayjs(ventana.hasta);
	if (!desde.isValid() || !hasta.isValid()) return false;
	return now.isSameOrAfter(desde, "day") && now.isSameOrBefore(hasta, "day");
};

