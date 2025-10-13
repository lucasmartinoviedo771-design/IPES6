import { z } from "zod";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrBefore);

const isIsoDate = (s: string) =>
  dayjs(s, "YYYY-MM-DD", true).isValid();
const notFuture = (s: string) =>
  isIsoDate(s) && dayjs(s).isSameOrBefore(dayjs(), "day");

export const preinscripcionSchema = z.object({
  // Datos personales
  nombres: z.string().min(2),
  apellido: z.string().min(2),
  dni: z.string().min(6),
  cuil: z.string().min(11),
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

  // Contacto
  email: z.string().email(),
  tel_movil: z.string().min(6),
  tel_fijo: z.string().optional().or(z.literal("")),

  // NUEVO: contacto de emergencia (requeridos por la DB)
  emergencia_telefono: z.string().min(6, "Teléfono de emergencia requerido"),
  emergencia_parentesco: z.string().min(2, "Parentesco requerido"),

  // Secundario
  sec_titulo: z.string().min(2),
  sec_establecimiento: z.string().min(2),
  sec_fecha_egreso: z
    .string()
    .refine(isIsoDate, "Fecha inválida (YYYY-MM-DD)")
    .refine(notFuture, "La fecha no puede ser futura"),
  // NUEVOS: ubicación del secundario (NOT NULL en DB)
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
    .refine((s) => !s || isIsoDate(s), "Fecha inválida (YYYY-MM-DD)")
    .refine((s) => !s || notFuture(s), "La fecha no puede ser futura"),

  // Carrera
  carrera_id: z.number().int().positive(),

  // (Laborales: se mantienen del esquema anterior)
  trabaja: z.boolean().default(false),
  empleador: z.string().optional().or(z.literal("")),
  horario_trabajo: z.string().optional().or(z.literal("")),
  domicilio_trabajo: z.string().optional().or(z.literal("")),

  // Foto (dataURL)
  foto_dataUrl: z.string().optional(),
  fotoW: z.number().optional(),
  fotoH: z.number().optional(),

  // Checklist de documentación
  doc_dni: z.boolean().optional(),
  doc_secundario: z.boolean().optional(),
  doc_constancia_cuil: z.boolean().optional(),
  doc_cert_trabajo: z.boolean().optional(),
  doc_buenasalud: z.boolean().optional(),
  doc_foto4x4: z.boolean().optional(),
  doc_titulo_en_tramite: z.boolean().optional(),
  doc_otro: z.boolean().optional(),
});

export type PreinscripcionForm = z.infer<typeof preinscripcionSchema>;
