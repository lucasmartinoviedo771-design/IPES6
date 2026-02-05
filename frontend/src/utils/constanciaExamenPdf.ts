import dayjs from "dayjs";
import { jsPDF } from "jspdf";

// Asumo que estas rutas son correctas
import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";
import type { ConstanciaExamenDTO } from "@/api/estudiantes";

type ConstanciaPdfOptions = {
  destinatario?: string;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NUMEROS_DIA: Record<number, string> = {
  1: "uno",
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
  9: "nueve",
  10: "diez",
  11: "once",
  12: "doce",
  13: "trece",
  14: "catorce",
  15: "quince",
  16: "dieciséis",
  17: "diecisiete",
  18: "dieciocho",
  19: "diecinueve",
  20: "veinte",
  21: "veintiuno",
  22: "veintidós",
  23: "veintitrés",
  24: "veinticuatro",
  25: "veinticinco",
  26: "veintiséis",
  27: "veintisiete",
  28: "veintiocho",
  29: "veintinueve",
  30: "treinta",
  31: "treinta y uno",
};

type Turno = "manana" | "tarde" | "noche";

const TURNO_INICIO: Record<Turno, string> = {
  manana: "08:00",
  tarde: "13:00",
  noche: "18:00",
};

const TURNOS_LABEL: Record<Turno, string> = {
  manana: "turno mañana",
  tarde: "turno tarde",
  noche: "turno noche",
};

const normalizarHora = (valor?: string | null): string | null => {
  if (!valor) return null;

  const match = valor.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const horas = match[1].padStart(2, "0");
  const minutos = match[2];

  return `${horas}:${minutos}`;
};

const inferirTurno = (valor?: string | null): Turno => {
  const match = valor?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "manana";

  const horas = Number(match[1]);
  if (horas < 12) return "manana";
  if (horas < 17) return "tarde";
  return "noche";
};

const numeroDiaEnTexto = (dia: number): string => NUMEROS_DIA[dia] ?? dia.toString();

export function generarConstanciaExamenPDF(
  item: ConstanciaExamenDTO,
  options: ConstanciaPdfOptions = {},
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();

  // --- MÁRGENES SIMÉTRICOS ---
  const M = 15; // margen izquierdo y derecho
  let y = M;

  const titulo = "CONSTANCIA DE EXAMEN";
  const headerLogoSize = 28;

  // --- Cabecera y logos ---
  pdf.addImage(logoMinisterio, "PNG", M, y, headerLogoSize, headerLogoSize);
  pdf.addImage(logoIpes, "PNG", W - M - headerLogoSize, y, headerLogoSize, headerLogoSize);

  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.text("IPES PAULO FREIRE", W / 2, y + 8, { align: "center" });

  pdf.setFont("times", "normal");
  pdf.setFontSize(10);
  pdf.text(
    "INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR",
    W / 2,
    y + 15,
    { align: "center" },
  );

  const headerBottomY = y + headerLogoSize + 2;
  pdf.setDrawColor(219, 120, 26);
  pdf.setLineWidth(1.2);
  pdf.line(M, headerBottomY, W - M, headerBottomY);
  y = headerBottomY + 8;

  // --- Título central ---
  pdf.setFont("times", "bold");
  pdf.setFontSize(14);
  pdf.text(titulo, W / 2, y, { align: "center" });
  y += 8;

  // --- Cálculo de variables para el cuerpo del texto ---
  const turno = inferirTurno(item.mesa_hora_desde);
  const horaRegistrada = normalizarHora(item.mesa_hora_desde);
  const horaInicio = horaRegistrada ?? TURNO_INICIO[turno];
  const horaFin = normalizarHora(item.mesa_hora_hasta) ?? "_____";
  const fechaMesa = dayjs(item.mesa_fecha).format("DD/MM/YYYY");

  const carrera =
    item.profesorado ??
    (item.plan_resolucion ? `Plan ${item.plan_resolucion}` : "____________________");

  const anioTexto = item.materia_anio ? `${item.materia_anio}º` : "_____";
  const destinatario = options.destinatario?.trim() || "A quien corresponda";

  const hoy = dayjs();
  const diaNumero = hoy.date();
  const diaEnTexto = numeroDiaEnTexto(diaNumero);
  const mesTexto = MESES[hoy.month()] ?? hoy.format("MMMM");
  const anioActual = hoy.year();

  // --- Parámetros de texto ---
  const maxWidth = W - 2 * M; // ancho útil (entre márgenes)

  const fontSize = 12;
  const lineHeightFactor = 1.5;
  const POINT_TO_MM = 0.352777778;
  const lineHeight = fontSize * POINT_TO_MM * lineHeightFactor;

  pdf.setFont("times", "normal");
  pdf.setFontSize(fontSize);

  // Sangría de primera línea ~10 mm usando espacios
  const INDENT_ADICIONAL = 15; // mm
  const spaceWidth = pdf.getTextWidth(" "); // en mm porque unit = "mm"
  const indentSpaces = Math.max(0, Math.round(INDENT_ADICIONAL / spaceWidth));
  const indentStr = " ".repeat(indentSpaces);

  // --- Párrafos ---
  const parrafos = [
    `El INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR “Paulo Freire” deja constancia que el/la Sr/a ${item.estudiante}, DNI ${item.dni}, ha rendido examen de ${item.materia} de ${anioTexto} año, de la carrera de ${carrera}, el día ${fechaMesa}.`,
    `Desde las ${horaInicio} hs (${TURNOS_LABEL[turno]}) hasta las ${horaFin} hs (momento de cierre del acta en el campus), en este establecimiento.`,
    `Se extiende la presente, sin enmiendas ni raspaduras, a pedido del/a interesado/a, y a solo efecto de ser presentada ante ${destinatario}, en la ciudad de Río Grande, a los ${diaNumero} (${diaEnTexto}) días del mes de ${mesTexto} del año ${anioActual}.`,
  ];

  // --- Bucle de impresión de párrafos JUSTIFICADOS ---
  parrafos.forEach((parrafo) => {
    // agregamos sangría solo al inicio del párrafo
    const textoConSangria = indentStr + parrafo;

    // calculamos cuántas líneas ocupará para poder avanzar "y"
    const lineas = pdf.splitTextToSize(textoConSangria, maxWidth) as string[];

    pdf.text(textoConSangria, M, y, {
      maxWidth,
      align: "justify",
      lineHeightFactor,
    });

    y += lineas.length * lineHeight; // alto del párrafo
    y += lineHeight / 2; // espacio entre párrafos
  });

  y += 10; // espacio adicional antes de las firmas

  // --- Firmas ---
  const firmaWidth = (W - 2 * M) / 2 - 10;
  pdf.line(M, y, M + firmaWidth, y);
  pdf.line(W - M - firmaWidth, y, W - M, y);

  pdf.setFont("times", "italic");
  pdf.text("Firma Bedel", M + firmaWidth / 2, y + 6, { align: "center" });
  pdf.text("Firma Autoridad", W - M - firmaWidth / 2, y + 6, { align: "center" });
  y += 12;

  // --- Pie de página ---
  pdf.setFont("times", "italic");
  pdf.setFontSize(9);
  pdf.text(
    "“Las Islas Malvinas, Georgias y Sandwich del Sur, son y serán Argentinas”",
    W / 2,
    y + 10,
    { align: "center" },
  );

  // --- Guardar PDF ---
  const filename = `constancia_examen_${item.dni}_${dayjs(item.mesa_fecha).format(
    "YYYYMMDD",
  )}.pdf`;
  pdf.save(filename);
}
