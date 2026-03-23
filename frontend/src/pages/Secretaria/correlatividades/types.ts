export type Profesorado = { id: number; nombre: string };

export type Plan = { id: number; resolucion: string };

export type MatrixRow = {
  id: number;
  nombre: string;
  anio_cursada: number;
  regimen: string;
  formato: string;
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
};

export type CorrSet = {
  regular_para_cursar: number[];
  aprobada_para_cursar: number[];
  aprobada_para_rendir: number[];
};

export type MateriaOption = {
  label: string;
  id: number | string;
  anio_cursada: number;
  aggregateIds?: number[];
};

export type CorrelatividadVersion = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  cohorte_desde: number;
  cohorte_hasta?: number | null;
  vigencia_desde?: string | null;
  vigencia_hasta?: string | null;
  activo: boolean;
  correlatividades: number;
};
