import { MesaTipo, MesaModalidad, MesaTribunalDocente } from './types';

export const CUATRIMESTRE_LABEL: Record<string, string> = {
  ANU: 'Anual',
  PCU: '1er cuatrimestre',
  SCU: '2do cuatrimestre',
};

export const BASE_CUATRIMESTRE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ANU', label: 'Anual' },
  { value: 'PCU', label: '1er cuatrimestre' },
  { value: 'SCU', label: '2do cuatrimestre' },
];

export const DEFAULT_ANIO_OPTIONS = Array.from({ length: 6 }, (_value, index) => index + 1);

export const MESA_TIPO_LABEL: Record<MesaTipo, string> = {
  FIN: 'Ordinaria',
  EXT: 'Extraordinaria',
  ESP: 'Especial',
};

export const MESA_MODALIDAD_LABEL: Record<MesaModalidad, string> = {
  REG: 'Regulares',
  LIB: 'Libres',
};

export const TRIBUNAL_ROL_LABEL: Record<MesaTribunalDocente['rol'], string> = {
  PRES: 'Presidente',
  VOC1: 'Vocal 1',
  VOC2: 'Vocal 2',
};

export const VENTANA_TIPO_LABEL: Record<string, string> = {
  MESAS_FINALES: 'Mesas ordinarias',
  MESAS_EXTRA: 'Mesas extraordinarias',
};
