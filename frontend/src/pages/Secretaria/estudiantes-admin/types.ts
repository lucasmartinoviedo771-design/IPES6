import { EstudianteAdminDocumentacionDTO } from "@/api/estudiantes";

export type EstadoLegajo = "COM" | "INC" | "PEN" | "";
export type Condicion = "Regular" | "Condicional" | "Pendiente" | "";

export const ESTADO_OPTIONS: Array<{ value: string; label: string; color: "success" | "warning" | "default" }> = [
  { value: "", label: "Todos", color: "default" },
  { value: "COM", label: "Completo", color: "success" },
  { value: "INC", label: "Incompleto / Condicional", color: "warning" },
  { value: "PEN", label: "Pendiente", color: "default" },
];

export type EstadoAcademico = "ACT" | "BAJ" | "EGR" | "SUS" | "INA" | "";

export const ESTADO_ACADEMICO_OPTIONS: Array<{ value: EstadoAcademico; label: string; color: "success" | "warning" | "default" }> = [
  { value: "", label: "Todos", color: "default" },
  { value: "ACT", label: "Activo", color: "success" },
  { value: "BAJ", label: "Baja / Abandono", color: "warning" },
  { value: "EGR", label: "Egresado", color: "success" },
  { value: "SUS", label: "Suspendido", color: "warning" },
  { value: "INA", label: "Inactivo", color: "default" },
];

export type DetailDocumentacionForm = {
  dni_legalizado: boolean;
  fotos_4x4: boolean;
  certificado_salud: boolean;
  folios_oficio: boolean;
  titulo_secundario_legalizado: boolean;
  certificado_titulo_en_tramite: boolean;
  analitico_legalizado: boolean;
  certificado_alumno_regular_sec: boolean;
  adeuda_materias: boolean;
  adeuda_materias_detalle: string;
  escuela_secundaria: string;
  es_certificacion_docente: boolean;
  titulo_terciario_univ: boolean;
  incumbencia: boolean;
  articulo_7: boolean;
};

export type CarreraUpdateForm = {
  profesorado_id: number;
  nombre: string;
  estado_academico: EstadoAcademico;
  condicion: Condicion;
};

export type DetailFormValues = {
  dni: string;
  apellido: string;
  nombre: string;
  telefono: string;
  domicilio: string;
  estado_legajo: EstadoLegajo;
  must_change_password: boolean;
  activo: boolean;
  fecha_nacimiento: string;
  anio_ingreso: string;
  genero: string;
  observaciones: string;
  cuil: string;
  documentacion: DetailDocumentacionForm;
  curso_introductorio_aprobado: boolean;
  libreta_entregada: boolean;

  // New fields
  nacionalidad: string;
  estado_civil: string;
  localidad_nac: string;
  provincia_nac: string;
  pais_nac: string;
  emergencia_telefono: string;
  emergencia_parentesco: string;
  sec_titulo: string;
  sec_establecimiento: string;
  sec_fecha_egreso: string;
  sec_localidad: string;
  sec_provincia: string;
  sec_pais: string;
  sup1_titulo: string;
  sup1_establecimiento: string;
  sup1_fecha_egreso: string;
  sup1_localidad: string;
  sup1_provincia: string;
  sup1_pais: string;
  cud_informado: boolean;
  condicion_salud_informada: boolean;
  condicion_salud_detalle: string;
  trabaja: boolean;
  empleador: string;
  horario_trabajo: string;
  domicilio_trabajo: string;
  carreras_situacion?: CarreraUpdateForm[];
};

export const estadoColorMap: Record<string, "default" | "success" | "warning"> = {
  COM: "success",
  INC: "warning",
  PEN: "default",
  // Estado Académico
  ACT: "success",
  BAJ: "warning",
  EGR: "success",
  SUS: "warning",
  INA: "default",
};

export const condicionColorMap: Record<string, "default" | "success" | "warning"> = {
  Regular: "success",
  Condicional: "warning",
  Pendiente: "default",
};

export const DEFAULT_LIMIT = 100;

export const generoOptions = [
  { value: "", label: "Sin especificar" },
  { value: "F", label: "Femenino" },
  { value: "M", label: "Masculino" },
  { value: "X", label: "X" },
];

export function normalizeDoc(detail?: EstudianteAdminDocumentacionDTO | null): DetailDocumentacionForm {
  return {
    dni_legalizado: Boolean(detail?.dni_legalizado),
    fotos_4x4: Boolean(detail?.fotos_4x4),
    certificado_salud: Boolean(detail?.certificado_salud),
    folios_oficio: Boolean(detail?.folios_oficio),
    titulo_secundario_legalizado: Boolean(detail?.titulo_secundario_legalizado),
    certificado_titulo_en_tramite: Boolean(detail?.certificado_titulo_en_tramite),
    analitico_legalizado: Boolean(detail?.analitico_legalizado),
    certificado_alumno_regular_sec: Boolean(detail?.certificado_alumno_regular_sec),
    adeuda_materias: Boolean(detail?.adeuda_materias),
    adeuda_materias_detalle: detail?.adeuda_materias_detalle ?? "",
    escuela_secundaria: detail?.escuela_secundaria ?? "",
    es_certificacion_docente: Boolean(detail?.es_certificacion_docente),
    titulo_terciario_univ: Boolean(detail?.titulo_terciario_univ),
    incumbencia: Boolean(detail?.incumbencia),
    articulo_7: Boolean(detail?.articulo_7),
  };
}
