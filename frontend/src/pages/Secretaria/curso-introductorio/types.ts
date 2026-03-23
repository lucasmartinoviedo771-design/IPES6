export type CohorteFormState = {
  nombre: string;
  anio_academico: string;
  profesorado_id: string;
  turno_id: string;
  ventana_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  cupo: string;
  observaciones: string;
};

export type InscribirFormState = {
  cohorte_id: string;
  profesorado_id: string;
  turno_id: string;
};

export type CierreFormState = {
  nota_final: string;
  asistencias_totales: string;
  resultado: string;
  observaciones: string;
};

export const RESULTADO_OPTIONS = [
  { value: "PEN", label: "Pendiente" },
  { value: "APR", label: "Aprobado" },
  { value: "DES", label: "Desaprobado" },
  { value: "AUS", label: "Ausente" },
];

export const buildCohorteForm = (): CohorteFormState => ({
  nombre: "",
  anio_academico: String(new Date().getFullYear()),
  profesorado_id: "",
  turno_id: "",
  ventana_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  cupo: "",
  observaciones: "",
});

export const buildInscribirForm = (): InscribirFormState => ({
  cohorte_id: "",
  profesorado_id: "",
  turno_id: "",
});

export const buildCierreForm = (): CierreFormState => ({
  nota_final: "",
  asistencias_totales: "",
  resultado: "PEN",
  observaciones: "",
});
