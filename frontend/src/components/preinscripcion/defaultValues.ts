import { PreinscripcionForm } from "./schema";

export const defaultValues: PreinscripcionForm = {
  // personales
  nombres: "",
  apellido: "",
  dni: "",
  cuil: "",
  fecha_nacimiento: "",
  nacionalidad: "",
  estado_civil: "",
  localidad_nac: "",
  provincia_nac: "",
  pais_nac: "",
  genero: "",
  domicilio: "",
  cohorte: "",

  // contacto
  email: "",
  tel_movil: "",
  tel_fijo: "",

  // NUEVO: emergencia
  emergencia_telefono: "",
  emergencia_parentesco: "",

  // secundario
  sec_titulo: "",
  sec_establecimiento: "",
  sec_fecha_egreso: "",
  sec_localidad: "",
  sec_provincia: "",
  sec_pais: "",

  // superiores (opc)
  sup1_titulo: "",
  sup1_establecimiento: "",
  sup1_fecha_egreso: "",
  sup1_localidad: "",
  sup1_provincia: "",
  sup1_pais: "",

  // carrera
  carrera_id: 0,

  // foto
  foto_dataUrl: undefined,
  fotoW: undefined,
  fotoH: undefined,

  // laborales (se mantienen del esquema anterior)
  trabaja: false,
  empleador: "",
  horario_trabajo: "",
  domicilio_trabajo: "",

  // documentación (Admin)
  dni_legalizado: false,
  fotos_4x4: false,
  certificado_salud: false,
  folios_oficio_ok: false,
  titulo_secundario_legalizado: false,
  certificado_titulo_en_tramite: false,
  analitico_legalizado: false,
  certificado_alumno_regular_sec: false,
  adeuda_materias: false,
  adeuda_materias_detalle: "",
  escuela_secundaria: "",
  titulo_terciario_univ: false,
  incumbencia: false,
  curso_introductorio_aprobado: false,
  libreta_entregada: false,
  articulo_7: false,
  ddjj_ok: false,

  // documentación (checkboxes - Público)
  doc_dni: false,
  doc_secundario: false,
  doc_constancia_cuil: false,
  doc_cert_trabajo: false,
  doc_buenasalud: false,
  doc_foto4x4: false,
  doc_titulo_en_tramite: false,
  doc_otro: false,

  // accesibilidad
  cud_informado: false,
  condicion_salud_informada: false,
  condicion_salud_detalle: "",
  consentimiento_datos: false,
};

