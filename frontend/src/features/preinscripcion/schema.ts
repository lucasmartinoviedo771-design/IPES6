import { z } from "zod";
import { isValidDDMMYYYY } from "@/utils/date";
import { digitsOnly } from "@/utils/format";

const fechaOK = (s: string) =>
  isValidDDMMYYYY(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);

export const preinscripcionSchema = z.object({
  // personales
  nombres: z.string().min(2),
  apellido: z.string().min(2),
  dni: z.preprocess(digitsOnly, z.string().regex(/^\d{7,10}$/)),
  cuil: z.preprocess(digitsOnly, z.string().regex(/^\d{11}$/)),
  fecha_nacimiento: z.string().refine(fechaOK, "Fecha inválida"),
  nacionalidad: z.string().min(2),
  estado_civil: z.string().min(3),
  localidad_nac: z.string().min(2),
  provincia_nac: z.string().min(2),
  pais_nac: z.string().min(2),
  domicilio: z.string().min(3),

  // contacto
  email: z.string().email(),
  tel_movil: z.string().min(6),
  tel_fijo: z.string().optional().or(z.literal("")),

  // secundarios
  sec_titulo: z.string().min(2),
  sec_establecimiento: z.string().min(2),
  sec_fecha_egreso: z.string().refine(fechaOK, "Fecha inválida"),

  // superiores (opcionales)
  sup1_titulo: z.string().optional().or(z.literal("")),
  sup1_establecimiento: z.string().optional().or(z.literal("")),
  sup1_fecha_egreso: z.string().optional().or(z.literal("")),
  sup1_localidad: z.string().optional().or(z.literal("")),
  sup1_provincia: z.string().optional().or(z.literal("")),
  sup1_pais: z.string().optional().or(z.literal("")),

  // laborales
  trabaja: z.boolean().default(false),
  empleador: z.string().optional().or(z.literal("")),
  horario_trabajo: z.string().optional().or(z.literal("")),
  domicilio_trabajo: z.string().optional().or(z.literal("")),

  // carrera + doc
  carrera_id: z.number().int().positive(),
});

export type PreinscripcionSchema = z.infer<typeof preinscripcionSchema>;

// You might want to update defaultValues to include all new fields
export const defaultValues: PreinscripcionSchema = {
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
  email: "",
  tel_movil: "",
  tel_fijo: "",
  sec_titulo: "",
  sec_establecimiento: "",
  sec_fecha_egreso: "",
  sup1_titulo: "",
  sup1_establecimiento: "",
  sup1_fecha_egreso: "",
  sup1_localidad: "",
  sup1_provincia: "",
  sup1_pais: "",
  trabaja: false,
  empleador: "",
  horario_trabajo: "",
  domicilio_trabajo: "",
  carrera_id: 0,
};
