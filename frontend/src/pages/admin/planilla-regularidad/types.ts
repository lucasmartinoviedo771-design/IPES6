import type { PlanillaRegularidadCreateResult } from "@/api/primeraCarga";

/**
 * Columna dinámica de la planilla. Coincide con el shape que expone
 * `RegularidadMetadataPlantilla.columnas` y con las columnas derivadas para el
 * scope `standard` en {@link usePlanillaColumns}.
 */
export interface ColumnaDinamica {
	key: string;
	label: string;
	type?: string;
	optional?: boolean;
}

/**
 * Situación académica disponible. Superset de las dos fuentes de la API:
 * - primera carga: `RegularidadMetadataPlantilla.situaciones` ({ codigo, label, descripcion?, color? })
 * - carga estándar: `SituacionOptionDTO` ({ codigo, alias, descripcion })
 */
export interface SituacionDisponible {
	codigo: string;
	label?: string;
	alias?: string;
	descripcion?: string;
	color?: string;
}

/** Docente tal como lo devuelve el detalle de planilla (ambos scopes). */
interface PlanillaDetalleDocente {
	docente_id?: number | null;
	nombre: string;
	dni?: string | null;
	rol?: string | null;
	orden?: number | null;
}

/** Fila/estudiante tal como lo devuelve el detalle de planilla (ambos scopes). */
interface PlanillaDetalleFila {
	orden?: number | null;
	dni: string;
	apellido_nombre: string;
	nota_final: number | string | null;
	asistencia: number | string | null;
	situacion: string | null;
	excepcion?: boolean;
	datos?: Record<string, string | number | null | undefined>;
	inscripcion_id?: number;
}

/**
 * Datos del detalle de planilla normalizados para el formulario. Es el superset
 * usado por el hook: para `primera_carga` proviene de `PlanillaRegularidadDetalle`
 * y para `standard` del objeto construido a partir de `RegularidadPlanillaDTO`.
 */
export interface PlanillaDetalleData {
	profesorado_id: number | string;
	materia_id: number | string;
	profesorado_nombre?: string;
	materia_nombre?: string;
	materia_anio?: number | null;
	formato?: string;
	regimen?: string;
	plantilla_id?: number | string;
	fecha: string;
	folio?: string | null;
	planilla_id?: number | null;
	plan_resolucion?: string | null;
	observaciones?: string | null;
	docentes: PlanillaDetalleDocente[];
	filas: PlanillaDetalleFila[];
	estado?: string;
	force_upgrade?: boolean;
	situaciones?: SituacionDisponible[];
}

/** Respuesta del endpoint de detalle (envoltorio ApiResponse). */
export interface PlanillaDetalleResponse {
	ok: boolean;
	message: string;
	data: PlanillaDetalleData;
}

/**
 * Resultado de guardar/crear una planilla. Cubre el union de las dos APIs:
 * `crearPlanillaRegularidad` (ApiResponse<PlanillaRegularidadCreateResult>) y
 * `guardarPlanillaRegularidad` (scope standard).
 */
export interface PlanillaSubmitResult {
	ok?: boolean;
	message?: string;
	data?: PlanillaRegularidadCreateResult | null;
}

export type PlanillaDocenteFormValues = {
	docente_id?: number | null;
	nombre: string;
	dni: string;
	rol: string;
	orden?: number | null;
};

export type PlanillaFilaFormValues = {
	orden: number | null;
	dni: string;
	apellido_nombre: string;
	nota_final: string;
	asistencia: string;
	situacion: string;
	excepcion: boolean;
	datos: Record<string, string>;
	inscripcion_id?: number;
};

export type PlanillaFormValues = {
	profesoradoId: number | "";
	materiaId: number | "";
	plantillaId: number | "";
	fecha: string;
	folio: string;
	planResolucion: string;
	observaciones: string;
	docentes: PlanillaDocenteFormValues[];
	filas: PlanillaFilaFormValues[];
	dry_run: boolean;
	force_upgrade: boolean;
};

export interface PlanillaRegularidadDialogProps {
	open: boolean;
	onClose: () => void;
	onCreated?: (
		result: PlanillaRegularidadCreateResult | undefined,
		dryRun: boolean,
	) => void;
	planillaId?: number | null;
	mode?: "create" | "edit" | "view";
	defaultProfesoradoId?: number;
	defaultMateriaId?: number;
	scope?: "primera_carga" | "standard";
	comisionId?: number | null;
}
