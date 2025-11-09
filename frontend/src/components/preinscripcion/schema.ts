import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { z } from "zod";

dayjs.extend(isSameOrBefore);

const isIsoDate = (value: string) => dayjs(value, "YYYY-MM-DD", true).isValid();
const notFuture = (value: string) => isIsoDate(value) && dayjs(value).isSameOrBefore(dayjs(), "day");

export const preinscripcionSchema = z.object({
  // Datos personales
  nombres: z.string().min(2, "Ingresa tu nombre completo"),
  apellido: z.string().min(2, "Ingresa tu apellido"),
  dni: z.string().min(6, "DNI demasiado corto"),
  cuil: z.string().min(11, "CUIL incompleto"),
  fecha_nacimiento: z
    .string()
    .refine(isIsoDate, "Fecha inválida (YYYY-MM-DD)")
    .refine(notFuture, "La fecha no puede ser futura"),
  nacionalidad: z.string().min(2),
  estado_civil: z.string().min(2),
  localidad_nac: z.string().min(2),
  provincia_nac: z.string().min(2),
  pais_nac: z.string().min(2),
  domicilio: z.string().min(2),
  cohorte: z
    .string()
    .trim()
    .min(4, "Ingresá el año de cohorte (ej: 2025)")
    .refine((value) => /^\d{4}$/.test(value.trim()), "El año debe tener cuatro dígitos"),

  // Contacto
  email: z.string().email(),
  tel_movil: z.string().min(6, "Teléfono móvil inválido"),
  tel_fijo: z.string().optional().or(z.literal("")),

  // Contacto de emergencia
  emergencia_telefono: z.string().min(6, "Teléfono de emergencia requerido"),
  emergencia_parentesco: z.string().min(2, "Parentesco requerido"),

  // Secundario
  sec_titulo: z.string().min(2),
  sec_establecimiento: z.string().min(2),
  sec_fecha_egreso: z
    .string()
    .refine(isIsoDate, "Fecha inválida (YYYY-MM-DD)")
    .refine(notFuture, "La fecha no puede ser futura"),
  sec_localidad: z.string().min(2),
  sec_provincia: z.string().min(2),
  sec_pais: z.string().min(2),

  // Superiores (opcionales)
  sup1_titulo: z.string().optional().or(z.literal("")),
  sup1_establecimiento: z.string().optional().or(z.literal("")),
  sup1_fecha_egreso: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isIsoDate(value), "Fecha inválida (YYYY-MM-DD)")
    .refine((value) => !value || notFuture(value), "La fecha no puede ser futura"),

  // Carrera
  carrera_id: z.number().int().min(1, "Selecciona una carrera"),

  // Formalización
  curso_introductorio_aprobado: z.boolean().default(false),
  libreta_entregada: z.boolean().default(false),

  // Laborales
  trabaja: z.boolean().default(false),
  empleador: z.string().optional().or(z.literal("")),
  horario_trabajo: z.string().optional().or(z.literal("")),
  domicilio_trabajo: z.string().optional().or(z.literal("")),

  // Foto (dataURL)
  foto_dataUrl: z.string().optional(),
  fotoW: z.number().optional(),
  fotoH: z.number().optional(),

  // Checklist de documentación
  doc_dni: z.boolean().default(false),
  doc_secundario: z.boolean().default(false),
  doc_constancia_cuil: z.boolean().default(false),
  doc_cert_trabajo: z.boolean().default(false),
  doc_buenasalud: z.boolean().default(false),
  doc_foto4x4: z.boolean().default(false),
  doc_titulo_en_tramite: z.boolean().default(false),
  doc_otro: z.boolean().default(false),
});

export type PreinscripcionForm = z.infer<typeof preinscripcionSchema>;
export type PreinscripcionSchema = PreinscripcionForm;

