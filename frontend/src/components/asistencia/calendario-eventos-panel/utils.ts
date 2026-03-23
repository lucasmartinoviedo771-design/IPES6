import dayjs from "dayjs";
import { CalendarioEvento } from "@/api/asistencia";

export const formatFecha = (fecha: string) => dayjs(fecha).format("DD/MM/YYYY");

export const scopeSummary = (evento: CalendarioEvento): string[] => {
  const badges: string[] = [];
  if (evento.turno_nombre) badges.push(`Turno ${evento.turno_nombre}`);
  if (evento.profesorado_nombre) badges.push(evento.profesorado_nombre);
  if (evento.plan_resolucion) badges.push(`Plan ${evento.plan_resolucion}`);
  if (evento.comision_nombre) badges.push(`Comisión ${evento.comision_nombre}`);
  if (evento.docente_nombre) badges.push(`Docente ${evento.docente_nombre}`);
  if (!badges.length) badges.push("General");
  return badges;
};
