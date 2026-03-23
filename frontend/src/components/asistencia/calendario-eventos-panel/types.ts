export type Option = { id: number; label: string };

export type CalendarioEventoFormValues = {
  id?: number;
  nombre: string;
  tipo: string;
  subtipo?: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  turnos: number[];
  aplica_docentes: boolean;
  aplica_estudiantes: boolean;
  motivo?: string;
  profesorado_id?: number | null;
  plan_id?: number | null;
  comision_id?: number | null;
  docente_id?: number | null;
};
