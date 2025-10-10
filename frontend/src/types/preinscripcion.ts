export type AlumnoIn = {
  dni: string;
  nombres: string;
  apellido: string;
  cuil?: string | null;
  fecha_nacimiento?: string | null; // YYYY-MM-DD
  email?: string | null;
  telefono?: string | null;
  domicilio?: string | null;
};

export type PreinscripcionIn = {
  carrera_id: number;
  foto_4x4_dataurl?: string | null;
  doc_dni: boolean;
  doc_secundario: boolean;
  doc_constancia_cuil: boolean;
  doc_cert_trabajo: boolean;
  doc_buenasalud: boolean;
  doc_foto4x4: boolean;
  doc_titulo_en_tramite: boolean;
  doc_otro: boolean;
  alumno: AlumnoIn;
};

export type PreinscripcionOut = {
  id: number;
  codigo: string;
  estado: "Enviada" | "Observada" | "Confirmada" | "Rechazada" | "Borrador";
};
