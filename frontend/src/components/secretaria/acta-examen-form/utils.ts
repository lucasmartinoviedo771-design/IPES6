import { MESA_EXAMEN_TIPO_LABEL, DOCENTE_ROLES } from './constants';
import { DocenteState, EstudianteState } from './types';

export const getMesaTipoNombre = (tipo: string) => MESA_EXAMEN_TIPO_LABEL[tipo] ?? tipo;

export const isAusente = (value: string) => value === "AJ" || value === "AI";

export const clasificarNota = (value: string) => {
  if (isAusente(value)) return "ausente";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "desaprobado";
  return numeric >= 6 ? "aprobado" : "desaprobado";
};

export const createEmptyDocentes = (): DocenteState[] =>
  DOCENTE_ROLES.map((item) => ({
    rol: item.value,
    docente_id: null,
    nombre: "",
    dni: "",
    inputValue: "",
  }));

export const createEmptyEstudiante = (orden: number): EstudianteState => ({
  internoId: `${orden}-${Date.now()}-${Math.random()}`,
  numero_orden: orden,
  permiso_examen: "",
  dni: "",
  apellido_nombre: "",
  examen_escrito: "",
  examen_oral: "",
  calificacion_definitiva: "",
  observaciones: "",
});
