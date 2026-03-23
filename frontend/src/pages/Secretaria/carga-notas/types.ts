export type FiltersState = {
  profesoradoId: number | null;
  planId: number | null;
  anio: number | null;
  cuatrimestre: string | null;
  anioCursada: number | null;
  materiaId: number | null;
  comisionId: number | null;
};

export type FinalFiltersState = {
  ventanaId: string;
  tipo: "FIN" | "EXT" | "ESP" | "";
  modalidad: "REG" | "LIB" | "";
  profesoradoId: number | null;
  planId: number | null;
  materiaId: number | null;
  anio: number | null;
  cuatrimestre: string | null;
  estadoPlanilla: "TODAS" | "ABIERTAS" | "CERRADAS";
  anioMesa: number | null;
};

export type FinalRowState = {
  inscripcionId: number;
  estudianteId: number;
  apellidoNombre: string;
  dni: string;
  condicion: string | null;
  nota: string;
  fechaResultado: string;
  cuentaParaIntentos: boolean;
  folio: string;
  libro: string;
  observaciones: string;
};

export type FinalPlanillaPayload = {
  estudiantes: {
    inscripcion_id: number;
    fecha_resultado: string | null;
    condicion: string | null;
    nota: number | null;
    folio: string | null;
    libro: string | null;
    observaciones: string | null;
    cuenta_para_intentos: boolean;
  }[];
};

export const cuatrimestreLabel: Record<string, string> = {
  PCU: "1º cuatrimestre",
  SCU: "2º cuatrimestre",
  ANU: "Anual",
};
