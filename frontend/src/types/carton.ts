export interface StudentInfo {
  apellidoNombre: string;
  dni: string;
  telefono?: string;
  email?: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  cursoIntroductorio?: string;
  promedioGeneral?: string;
  libretaEntregada?: boolean;
  legajo?: string | null;
  legajoEstado?: string | null;
  cohorte?: string | null;
  activo?: boolean | null;
  materiasTotales?: number | null;
  materiasAprobadas?: number | null;
  materiasRegularizadas?: number | null;
  materiasEnCurso?: number | null;
  fotoUrl?: string;
}

export interface ExamRecord {
  tipo: 'regularidad' | 'final' | 'placeholder';
  anio: string;
  cuatrimestre: string;
  espacioCurricular: string;
  fecha?: string;
  condicion?: string;
  nota?: string | number;
  folio?: string;
  libro?: string;
  idFila?: string | number;
}

export interface CartonData {
  id: string;
  studentInfo: StudentInfo;
  registros: ExamRecord[];
  edis: ExamRecord[];
  profesoradoNombre?: string;
  planResolucion?: string;
  createdAt?: string;
  updatedAt?: string;
}
