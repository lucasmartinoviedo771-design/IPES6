export type MateriaRow = {
  nombre: string;
  formato: string;
  anio_cursada: string;
  nota: string;
};

export type FormType = "" | "ANEXO_A" | "ANEXO_B";

export type FormState = {
  tipo: FormType;
  cicloLectivo: string;
  profesoradoDestinoId: string;
  profesoradoDestinoNombre: string;
  planDestinoId: string;
  planDestinoResolucion: string;
  establecimientoOrigen: string;
  establecimientoLocalidad: string;
  establecimientoProvincia: string;
  profesoradoOrigenId: string;
  profesoradoOrigenNombre: string;
  planOrigenId: string;
  planOrigenResolucion: string;
};

export type PreferiblePlan = {
  id: number;
  vigente?: boolean | null;
  anio_inicio?: number | null;
  resolucion?: string | null;
};
