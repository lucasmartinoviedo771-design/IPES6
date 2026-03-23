import { ActaEstudiantePayload } from "@/api/cargaNotas";

export type DocenteState = {
  rol: string;
  docente_id: number | null;
  nombre: string;
  dni: string;
  inputValue: string;
};

export type EstudianteState = ActaEstudiantePayload & { internoId: string };

export type ActaExamenFormProps = {
  strict?: boolean;
  title?: string;
  subtitle?: string;
  successMessage?: string;
  initialEstudiantes?: Array<{ dni: string; apellido_nombre: string }>;
  headerAction?: React.ReactNode;
  editId?: number;
};
