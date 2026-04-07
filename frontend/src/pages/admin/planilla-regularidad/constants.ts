import { PlanillaDocenteFormValues, PlanillaFilaFormValues } from './types';

export const DEFAULT_DOCENTE: PlanillaDocenteFormValues = {
  docente_id: null,
  nombre: '',
  dni: '',
  rol: 'profesor',
  orden: null,
};

export const DEFAULT_DOCENTE_BEDEL: PlanillaDocenteFormValues = {
  docente_id: null,
  nombre: '',
  dni: '',
  rol: 'bedel',
  orden: null,
};

export const buildDefaultRow = (index: number): PlanillaFilaFormValues => ({
  orden: index + 1,
  dni: '',
  apellido_nombre: '',
  nota_final: '', // Permitirá números 0-10 o '---'
  asistencia: '',
  situacion: '',
  excepcion: false,
  datos: {},
});

export const buildDefaultRows = (count = 1): PlanillaFilaFormValues[] =>
  Array.from({ length: count }, (_, idx) => buildDefaultRow(idx));

export const regimenToDictado: Record<string, string> = {
  ANU: 'ANUAL',
  ANUAL: 'ANUAL',
  PCU: '1C',
  SCU: '2C',
  '1C': '1C',
  '2C': '2C',
};

export const REGIMEN_LABELS: Record<string, string> = {
  ANU: 'Anual',
  ANUAL: 'Anual',
  PCU: '1° cuatrimestre',
  SCU: '2° cuatrimestre',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

export const DICTADO_LABELS: Record<string, string> = {
  ANUAL: 'Anual',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

export const SITUACION_DESCRIPTIONS: Record<string, string> = {
  PRO: "Promocionado",
  REG: "Regular",
  APR: "Aprobado (sin final)",
  DPA: "Desaprobado por Parciales",
  DTP: "Desaprobado por Trabajos Prácticos",
  LBI: "Libre por Inasistencias",
  LAT: "Libre Antes de Tiempo",
  AUJ: "JUS",
};

export const FORMATO_SLUG_MAP: Record<string, string> = {
  ASI: 'asignatura',
  MOD: 'modulo',
  TAL: 'taller',
  PRA: 'taller',
  LAB: 'taller',
  SEM: 'taller', // Seminario ahora usa el formato Taller para compartir formulario
};

export const FORMATO_LABELS: Record<string, string> = {
  ASI: 'Asignatura',
  MOD: 'Módulo',
  TAL: 'Taller',
  PRA: 'Práctica',
  LAB: 'Laboratorio',
  SEM: 'Seminario',
};

export const SITUACION_PLACEHOLDER = 'Seleccionar';

export const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatColumnLabel = (label?: string) => {
  if (!label) {
    return '';
  }
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/º|°/g, '').replace(/\s+/g, ' ').trim();
};

export const getSituacionColor = (situacion?: string) => {
  const s = (situacion || '').toUpperCase();
  // Códigos de DB o Aliases
  if (s === 'PRO' || s.includes('PROM')) return '#c6e0b4'; // Verde claro
  if (s === 'REGULAR' || s === 'REG') return '#ffff00';     // Amarillo
  if (s === 'APR' || s.includes('APRO')) return '#ed7d31';    // Naranja
  if (s.includes('DESAPROBADO') || s === 'DPA' || s === 'DTP') return '#ff0000'; // Rojo
  if (s === 'LIBRE-I' || s === 'LBI') return '#5b9bd5';      // Azul/Cyan
  if (s === 'LIBRE-AT' || s === 'LAT') return '#5b9bd5';     // Azul/Cyan (Igual que Libre I)
  return 'transparent';
};
