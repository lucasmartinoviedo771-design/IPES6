import { client } from '@/api/client';

export type DashboardCatedra = {
  id: number;
  materia: string;
  profesorado: string;
  anio_lectivo: number;
  turno?: string | null;
};

export type DashboardDocente = {
  id: number;
  nombre: string;
  documento: string;
  total_catedras: number;
  catedras: DashboardCatedra[];
};

export type DashboardProfesorado = {
  id: number;
  nombre: string;
  planes: number;
  materias: number;
  correlativas: number;
};

export type DashboardPreinsEstado = { estado: string; total: number };

export type DashboardPreinsDetalle = {
  id: number;
  codigo: string;
  alumno: string;
  carrera?: string | null;
  fecha?: string | null;
};

export type DashboardPreinscripciones = {
  total: number;
  por_estado: DashboardPreinsEstado[];
  recientes: DashboardPreinsDetalle[];
};

export type DashboardHorario = {
  profesorado_id: number;
  profesorado: string;
  anio_cursada: number;
  cantidad: number;
};

export type DashboardCambioComision = {
  id: number;
  estudiante: string;
  dni: string;
  materia: string;
  profesorado?: string | null;
  comision_actual?: string | null;
  comision_solicitada?: string | null;
  estado: string;
  actualizado: string;
};

export type DashboardPedidoAnalitico = {
  id: number;
  estudiante: string;
  dni: string;
  fecha: string;
  motivo: string;
  profesorado?: string | null;
};

export type DashboardMesaTipo = { tipo: string; total: number };

export type DashboardMesas = { total: number; por_tipo: DashboardMesaTipo[] };

export type DashboardRegularidad = {
  id: number;
  estudiante: string;
  dni: string;
  materia: string;
  profesorado?: string | null;
  situacion: string;
  nota?: string | null;
  fecha: string;
};

export type DashboardVentana = {
  id: number;
  tipo: string;
  desde: string;
  hasta: string;
  activo: boolean;
  estado: string;
};

export type GlobalOverview = {
  docentes: DashboardDocente[];
  profesorados: DashboardProfesorado[];
  preinscripciones: DashboardPreinscripciones;
  horarios: DashboardHorario[];
  pedidos_comision: DashboardCambioComision[];
  pedidos_analiticos: DashboardPedidoAnalitico[];
  mesas: DashboardMesas;
  regularidades: DashboardRegularidad[];
  ventanas: DashboardVentana[];
};

export async function fetchGlobalOverview(): Promise<GlobalOverview> {
  const { data } = await client.get<GlobalOverview>('/overview/global');
  return data;
}
