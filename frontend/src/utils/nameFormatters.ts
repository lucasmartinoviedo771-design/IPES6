/**
 * Utilidades para formatear y normalizar nombres y apellidos.
 * Regla institucional:
 * - Apellido: SIEMPRE en MAYÚSCULAS completas.
 * - Nombres: Primera letra de cada palabra en mayúscula, resto en minúscula (Title Case).
 */

export function formatApellido(value: string | null | undefined): string {
	if (!value) return "";
	return value.toUpperCase();
}

export function formatNombres(value: string | null | undefined): string {
	if (!value) return "";
	const particulas = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "di", "van", "von"]);
	const palabras = value.split(" ");
	
	return palabras
		.map((palabra, idx) => {
			if (!palabra) return "";
			const lower = palabra.toLowerCase();
			if (idx > 0 && particulas.has(lower)) {
				return lower;
			}
			return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
		})
		.join(" ");
}
