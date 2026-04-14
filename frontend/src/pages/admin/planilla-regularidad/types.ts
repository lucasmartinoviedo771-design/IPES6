import { PlanillaRegularidadCreateResult } from '@/api/primeraCarga';

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
};

export type PlanillaFormValues = {
  profesoradoId: number | '';
  materiaId: number | '';
  plantillaId: number | '';
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
  onCreated?: (result: PlanillaRegularidadCreateResult | any, dryRun: boolean) => void;
  planillaId?: number | null;
  mode?: 'create' | 'edit' | 'view';
}
