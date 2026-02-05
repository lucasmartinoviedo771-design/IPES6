import dayjs from "dayjs";
import { jsPDF } from "jspdf";

import logoLeft from "@/assets/ipes-logo.png";
import logoRight from "@/assets/ipes-logo-dark.png";

export type OralTopicScore = "MAL" | "INCOMP" | "BIEN" | "MUY_BIEN" | "EXCELENTE";

export const ORAL_SCORE_OPTIONS: { value: OralTopicScore; label: string }[] = [
  { value: "MAL", label: "Responde mal / no contesta" },
  { value: "INCOMP", label: "Responde incompleto o regular" },
  { value: "BIEN", label: "Responde bien, lo preciso, no amplia" },
  { value: "MUY_BIEN", label: "Responde muy bien, amplia" },
  { value: "EXCELENTE", label: "Responde excelente, realiza aportes personales" },
];

export type OralTopicEntry = {
  tema: string;
  score?: OralTopicScore;
};

export type OralActaPdfPayload = {
  actaNumero?: string;
  folioNumero?: string;
  fecha?: string;
  carrera?: string;
  unidadCurricular?: string;
  curso?: string;
  estudiante: string;
  tribunal: {
    presidente?: string | null;
    vocal1?: string | null;
    vocal2?: string | null;
    vocalExtra?: string | null;
  };
  temasElegidosEstudiante: OralTopicEntry[];
  temasSugeridosDocente: OralTopicEntry[];
  notaFinal?: string;
  observaciones?: string;
};

const SCORE_HEADERS = ORAL_SCORE_OPTIONS.map((option) => option.label);

export function generarActaExamenOralPDF(payload: OralActaPdfPayload) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const margin = 12;
  let y = margin;

  const drawHeader = () => {
    const logoSize = 22;
    pdf.addImage(logoLeft, "PNG", margin, y, logoSize, logoSize);
    pdf.addImage(logoRight, "PNG", W - margin - logoSize, y, logoSize, logoSize);

    pdf.setFont("times", "bold");
    pdf.setFontSize(16);
    pdf.text("IPES Paulo Chiacchio", W / 2, y + 8, { align: "center" });
    pdf.setFontSize(11);
    pdf.text("Instituto Provincial de Educación Superior", W / 2, y + 14, { align: "center" });
    pdf.setFontSize(13);
    pdf.text("ACTA DE EXAMEN ORAL", W / 2, y + 28, { align: "center" });
    y += 36;
  };

  const lineField = (label: string, value?: string, width?: number) => {
    const usable = width ?? W - margin * 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`${label}:`, margin, y);
    const startX = margin + pdf.getTextWidth(`${label}: `) + 1;
    pdf.setFont("helvetica", "normal");
    pdf.text(value || "", startX, y);
    pdf.line(startX, y + 1, margin + usable, y + 1);
  };

  drawHeader();

  pdf.setLineWidth(0.4);
  lineField("ACTA Nº", payload.actaNumero ?? "");
  lineField("FOLIO Nº", payload.folioNumero ?? "", 70);
  pdf.text("FECHA:", W / 2, y);
  const fechaTxt = payload.fecha ? dayjs(payload.fecha).format("DD/MM/YYYY") : "";
  pdf.text(fechaTxt, W / 2 + 12, y);
  pdf.line(W / 2 + 12, y + 1, W - margin, y + 1);
  y += 8;

  lineField("CARRERA", payload.carrera);
  y += 6;
  lineField("UNIDAD CURRICULAR", payload.unidadCurricular);
  y += 6;
  lineField("CURSO", payload.curso);
  y += 6;
  lineField("ALUMNO/A", payload.estudiante);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text("TRIBUNAL:", margin, y);
  pdf.setFont("helvetica", "normal");
  const tribBase = y;
  const tribunal = payload.tribunal || {};
  y += 5;
  pdf.text(`Presidente: ${tribunal.presidente ?? ""}`, margin, y);
  y += 5;
  pdf.text(`Vocal 1: ${tribunal.vocal1 ?? ""}`, margin, y);
  y += 5;
  if (tribunal.vocal2 || tribunal.vocalExtra) {
    pdf.text(`Vocal 2: ${tribunal.vocal2 ?? tribunal.vocalExtra ?? ""}`, margin, y);
    y += 5;
  }
  pdf.rect(margin - 2, tribBase - 4, W - margin * 2 + 4, y - tribBase + 6);
  y += 4;

  const drawTopicsTable = (title: string, topics: OralTopicEntry[], startIndex = 1) => {
    const colTema = 60;
    const otherCols = (W - margin * 2 - colTema) / SCORE_HEADERS.length;
    const rowHeight = 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title, margin, y);
    y += 3;
    pdf.setDrawColor(0);
    pdf.rect(margin, y, colTema + otherCols * SCORE_HEADERS.length, rowHeight * (topics.length || 1) + rowHeight);

    pdf.setFontSize(8);
    pdf.text("TEMAS", margin + 2, y + 5);
    SCORE_HEADERS.forEach((header, index) => {
      const x = margin + colTema + otherCols * index + 1;
      pdf.text(header, x + 1, y + 3, { maxWidth: otherCols - 2 });
    });
    y += rowHeight;
    const ensureTopics = topics.length ? topics : [{ tema: "", score: undefined }];
    ensureTopics.forEach((topic, idx) => {
      const yRow = y + idx * rowHeight;
      pdf.setDrawColor(0);
      pdf.rect(margin, yRow, colTema + otherCols * SCORE_HEADERS.length, rowHeight);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${startIndex + idx}. ${topic.tema || ""}`, margin + 2, yRow + 5, { maxWidth: colTema - 4 });
      SCORE_HEADERS.forEach((_, index) => {
        const cellX = margin + colTema + otherCols * index;
        pdf.rect(cellX, yRow, otherCols, rowHeight);
        const score = topic.score;
        if (score && ORAL_SCORE_OPTIONS[index]?.value === score) {
          pdf.setFont("helvetica", "bold");
          pdf.text("X", cellX + otherCols / 2, yRow + 5, { align: "center" });
        }
      });
    });
    y += ensureTopics.length * rowHeight + 6;
  };

  drawTopicsTable("Elegidos por el estudiante", payload.temasElegidosEstudiante);
  drawTopicsTable("Sugeridos por el docente", payload.temasSugeridosDocente, 1);

  pdf.setFont("helvetica", "bold");
  pdf.text("NOTA FINAL:", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(payload.notaFinal ?? "", margin + 30, y);
  pdf.line(margin + 28, y + 1, margin + 80, y + 1);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.text("OBSERVACIONES:", margin, y);
  y += 2;
  pdf.setFont("helvetica", "normal");
  const obsLines = pdf.splitTextToSize(payload.observaciones ?? "", W - margin * 2);
  pdf.text(obsLines as string[], margin, y + 4);
  const obsHeight = Math.max(30, obsLines.length * 6 + 4);
  pdf.rect(margin, y, W - margin * 2, obsHeight);
  y += obsHeight + 14;

  // Signatures
  const sigWidth = (W - margin * 2 - 20) / 3;
  const roles = ["Vocal", "Presidente", "Vocal"];
  roles.forEach((rol, index) => {
    const x = margin + index * (sigWidth + 10);
    pdf.line(x, y, x + sigWidth, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(rol, x + sigWidth / 2, y + 5, { align: "center" });
  });

  const safeName = payload.estudiante.replace(/\s+/g, "_").replace(/[^\w_-]/g, "");
  const file = `acta_oral_${safeName || "estudiante"}.pdf`;
  pdf.save(file);
}
