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
  domicilio: "",

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

  // carrera
  carrera_id: 0,

  // formalización
  curso_introductorio_aprobado: false,
  libreta_entregada: false,

  // foto
  foto_dataUrl: undefined,
  fotoW: undefined,
  fotoH: undefined,

  // laborales (se mantienen del esquema anterior)
  trabaja: false,
  empleador: "",
  horario_trabajo: "",
  domicilio_trabajo: "",

  // documentación (checkboxes)
  doc_dni: false,
  doc_secundario: false,
  doc_constancia_cuil: false,
  doc_cert_trabajo: false,
  doc_buenasalud: false,
  doc_foto4x4: false,
  doc_titulo_en_tramite: false,
  doc_otro: false,
};

