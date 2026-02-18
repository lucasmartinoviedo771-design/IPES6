import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { z } from "zod";

dayjs.extend(isSameOrBefore);

const isIsoDate = (value: string) => dayjs(value, "YYYY-MM-DD", true).isValid();
const isLatamDate = (value: string) => dayjs(value, "DD/MM/YYYY", true).isValid();

const normalizeDate = (value: string | undefined | null): string => {
  if (!value) return "";
  if (isLatamDate(value)) {
    return dayjs(value, "DD/MM/YYYY").format("YYYY-MM-DD");
  }
  return value;
};

const isValidDate = (value: string) => isIsoDate(value) || isLatamDate(value);
const notFuture = (value: string) => {
  const norm = normalizeDate(value);
  return norm && dayjs(norm).isSameOrBefore(dayjs(), "day");
};

const baseSchema = z.object({
  // Datos personales
  nombres: z.string().min(2, "Ingresa tu nombre completo"),
  apellido: z.string().min(2, "Ingresa tu apellido"),
  dni: z.string().min(6, "DNI demasiado corto"),
  cuil: z.string().min(11, "CUIL incompleto").optional().or(z.literal("")),
  fecha_nacimiento: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isValidDate(value), "Fecha inválida (DD/MM/AAAA)")
    .refine((value) => !value || notFuture(value), "La fecha no puede ser futura")
    .transform(normalizeDate),
  nacionalidad: z.string().optional().or(z.literal("")),
  estado_civil: z.string().optional().or(z.literal("")),
  localidad_nac: z.string().optional().or(z.literal("")),
  provincia_nac: z.string().optional().or(z.literal("")),
  pais_nac: z.string().optional().or(z.literal("")),
  domicilio: z.string().optional().or(z.literal("")),
  cohorte: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine(
      (value) => !value || /^\d{4}$/.test(value),
      "Ingresá el año de cohorte (ej: 2025)",
    ),

  // Contacto
  email: z.string().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Email inválido").optional().or(z.literal("")),
  tel_movil: z.string().optional().or(z.literal("")),
  tel_fijo: z.string().optional().or(z.literal("")),

  // Contacto de emergencia
  emergencia_telefono: z.string().optional().or(z.literal("")),
  emergencia_parentesco: z.string().optional().or(z.literal("")),

  // Secundario
  sec_titulo: z.string().optional().or(z.literal("")),
  sec_establecimiento: z.string().optional().or(z.literal("")),
  sec_fecha_egreso: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isValidDate(value), "Fecha inválida (DD/MM/AAAA)")
    .refine((value) => !value || notFuture(value), "La fecha no puede ser futura")
    .transform(normalizeDate),
  sec_localidad: z.string().optional().or(z.literal("")),
  sec_provincia: z.string().optional().or(z.literal("")),
  sec_pais: z.string().optional().or(z.literal("")),

  // Superiores (opcionales)
  sup1_titulo: z.string().optional().or(z.literal("")),
  sup1_establecimiento: z.string().optional().or(z.literal("")),
  sup1_fecha_egreso: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || isValidDate(value), "Fecha inválida (DD/MM/AAAA)")
    .refine((value) => !value || notFuture(value), "La fecha no puede ser futura")
    .transform(normalizeDate),
  sup1_localidad: z.string().optional().or(z.literal("")),
  sup1_provincia: z.string().optional().or(z.literal("")),
  sup1_pais: z.string().optional().or(z.literal("")),

  // Accesibilidad / datos sensibles
  cud_informado: z.boolean().default(false),
  condicion_salud_informada: z.boolean().default(false),
  condicion_salud_detalle: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ?? "").trim()),
  consentimiento_datos: z.boolean().default(false),

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

export const preinscripcionSchema = baseSchema.superRefine((values, ctx) => {
  if (values.condicion_salud_informada && !values.condicion_salud_detalle) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["condicion_salud_detalle"],
      message: "Indicá la condición o el apoyo que necesitás.",
    });
  }
});

export type PreinscripcionForm = z.infer<typeof preinscripcionSchema>;
export type PreinscripcionSchema = PreinscripcionForm;

