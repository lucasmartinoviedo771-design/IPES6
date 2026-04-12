export type Mesa = {
  id: number;
  materia_id: number;
  materia_nombre: string;
  profesorado_id: number | null;
  profesorado_nombre: string | null;
  plan_id: number | null;
  plan_resolucion: string | null;
  anio_cursada: number | null;
  regimen: string | null;
  tipo: string;
  modalidad: string;
  fecha: string;
  fecha2?: string;
  hora_desde?: string;
  hora_hasta?: string;
  aula?: string;
  cupo: number;
  codigo?: string | null;
  docentes?: MesaTribunalDocente[];
  inscriptos_count?: number;
};

export type MesaTribunalDocente = {
  rol: 'PRES' | 'VOC1' | 'VOC2';
  docente_id: number | null;
  nombre: string | null;
  dni: string | null;
};

export type MateriaOption = {
  id: number;
  nombre: string;
  anio: number | null;
  cuatrimestre: string | null;
  permiteLibre: boolean;
};

export type MesaTipo = 'FIN' | 'EXT' | 'ESP';

export type MesaModalidad = 'REG' | 'LIB';
