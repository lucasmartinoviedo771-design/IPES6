import type { ActaEstudiantePayload, MesaResumenDTO } from "@/api/cargaNotas";

export type DocenteState = {
	rol: string;
	docente_id: number | null;
	nombre: string;
	dni: string;
	inputValue: string;
};

export type EstudianteState = ActaEstudiantePayload & {
	internoId: string;
	inscripcionId?: number;
};

export type EstudiantePreseleccionado = {
	dni: string;
	apellido_nombre: string;
	inscripcionId?: number;
};

export type ActaExamenFormProps = {
	strict?: boolean;
	title?: string;
	subtitle?: string;
	successMessage?: string;
	initialEstudiantes?: Array<{ dni: string; apellido_nombre: string }>;
	headerAction?: React.ReactNode;
	editId?: number;
	/** Mesa ya seleccionada desde la planilla — autocompleta encabezado y tribunal */
	mesaPreseleccionada?: MesaResumenDTO | null;
	/** Estudiantes inscriptos a pre-cargar en la tabla de resultados */
	estudiantesPreseleccionados?: EstudiantePreseleccionado[];
};
