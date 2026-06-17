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

const SCORE_HEADERS = ORAL_SCORE_OPTIONS.map((o) => o.label);

export function generarActaExamenOralPDF(payload: OralActaPdfPayload) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 14; // margin
  const usable = W - M * 2;
  let y = M;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setFont = (style: "normal" | "bold", size: number) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
  };

  // Draws "LABEL:  value_______________" and advances y by lineH
  const labeledField = (label: string, value: string, lineH = 7) => {
    setFont("bold", 9);
    const labelW = pdf.getTextWidth(`${label}:  `);
    pdf.text(`${label}:`, M, y);
    setFont("normal", 9);
    pdf.text(value || "", M + labelW, y);
    pdf.setLineWidth(0.3);
    pdf.line(M + labelW, y + 0.8, M + usable, y + 0.8);
    y += lineH;
  };

  // ── Header ───────────────────────────────────────────────────────────────────
  const logoSize = 20;
  pdf.addImage(logoLeft,  "PNG", M,                    y, logoSize, logoSize);
  pdf.addImage(logoRight, "PNG", W - M - logoSize,     y, logoSize, logoSize);

  const titleX = M + logoSize + 4;
  const titleW = usable - logoSize * 2 - 8;

  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.text("IPES Paulo Chiacchio", titleX + titleW / 2, y + 7, { align: "center" });

  pdf.setFont("times", "normal");
  pdf.setFontSize(10);
  pdf.text("Instituto Provincial de Educación Superior", titleX + titleW / 2, y + 13, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("ACTA DE EXAMEN ORAL", titleX + titleW / 2, y + 20, { align: "center" });

  y += logoSize + 6;

  // ── Acta / Folio / Fecha row ──────────────────────────────────────────────
  pdf.setLineWidth(0.3);

  // ACTA Nº (left third)
  setFont("bold", 9);
  const actaLabel = "ACTA Nº:  ";
  pdf.text("ACTA Nº:", M, y);
  setFont("normal", 9);
  const actaVal = payload.actaNumero ?? "";
  pdf.text(actaVal, M + pdf.getTextWidth(actaLabel), y);
  const actaLineEnd = M + usable * 0.3;
  pdf.line(M + pdf.getTextWidth(actaLabel), y + 0.8, actaLineEnd, y + 0.8);

  // FOLIO Nº (center third)
  const folioX = M + usable * 0.35;
  setFont("bold", 9);
  const folioLabel = "FOLIO Nº:  ";
  pdf.text("FOLIO Nº:", folioX, y);
  setFont("normal", 9);
  pdf.text(payload.folioNumero ?? "", folioX + pdf.getTextWidth(folioLabel), y);
  const folioLineEnd = M + usable * 0.65;
  pdf.line(folioX + pdf.getTextWidth(folioLabel), y + 0.8, folioLineEnd, y + 0.8);

  // FECHA (right)
  const fechaX = M + usable * 0.70;
  setFont("bold", 9);
  const fechaLabel = "FECHA:  ";
  pdf.text("FECHA:", fechaX, y);
  setFont("normal", 9);
  const fechaTxt = payload.fecha ? dayjs(payload.fecha).format("DD/MM/YYYY") : "";
  pdf.text(fechaTxt, fechaX + pdf.getTextWidth(fechaLabel), y);
  pdf.line(fechaX + pdf.getTextWidth(fechaLabel), y + 0.8, M + usable, y + 0.8);

  y += 9;

  // ── Main fields ───────────────────────────────────────────────────────────
  labeledField("CARRERA", payload.carrera ?? "");
  labeledField("UNIDAD CURRICULAR", payload.unidadCurricular ?? "");
  labeledField("CURSO", payload.curso ?? "");
  labeledField("ALUMNO/A", payload.estudiante);
  y += 1;

  // ── Tribunal box ─────────────────────────────────────────────────────────
  const tribunal = payload.tribunal || {};
  const tribLines: string[] = [];
  if (tribunal.presidente) tribLines.push(`Presidente: ${tribunal.presidente}`);
  if (tribunal.vocal1)     tribLines.push(`Vocal 1: ${tribunal.vocal1}`);
  if (tribunal.vocal2 || tribunal.vocalExtra)
    tribLines.push(`Vocal 2: ${tribunal.vocal2 ?? tribunal.vocalExtra ?? ""}`);

  const tribPad = 3;
  const tribLineH = 5;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tribBoxH = tribPad * 2 + 5 + tribLines.length * tribLineH + 2;

  setFont("bold", 9);
  pdf.text("TRIBUNAL:", M, y + 5);
  y += 7;

  const tribTop = y - 4;
  tribLines.forEach((line, i) => {
    setFont("normal", 9);
    pdf.text(line, M + tribPad, y + i * tribLineH);
  });
  y += tribLines.length * tribLineH + 2;
  pdf.setLineWidth(0.4);
  pdf.rect(M, tribTop, usable, y - tribTop + 2);
  y += 5;

  // ── Topic tables ──────────────────────────────────────────────────────────
  const drawTopicsTable = (title: string, topics: OralTopicEntry[], startIndex = 1) => {
    const colTema = 52;
    const colScore = (usable - colTema) / SCORE_HEADERS.length;
    const headerH = 14; // two-line header
    const rowH = 7;
    const rows = topics.length || 1;
    const tableH = headerH + rows * rowH;

    setFont("bold", 9);
    pdf.text(title, M, y);
    y += 4;

    // outer rect
    pdf.setLineWidth(0.3);
    pdf.rect(M, y, usable, tableH);

    // header row top line already covered by rect; draw bottom of header
    pdf.line(M, y + headerH, M + usable, y + headerH);

    // Vertical separator after TEMAS column
    pdf.line(M + colTema, y, M + colTema, y + tableH);

    // TEMAS header
    setFont("bold", 8);
    pdf.text("TEMAS", M + 2, y + headerH - 4);

    // Score column headers (wrap text)
    SCORE_HEADERS.forEach((header, i) => {
      const x = M + colTema + i * colScore;
      pdf.line(x, y, x, y + tableH); // vertical separator
      const wrapped = pdf.splitTextToSize(header, colScore - 2);
      // center vertically in header
      const textH = wrapped.length * 3.5;
      const textY = y + (headerH - textH) / 2 + 3;
      setFont("bold", 6);
      pdf.text(wrapped as string[], x + colScore / 2, textY, { align: "center" });
    });

    // Data rows
    const ensureTopics = topics.length ? topics : [{ tema: "", score: undefined }];
    ensureTopics.forEach((topic, idx) => {
      const rowY = y + headerH + idx * rowH;
      pdf.line(M, rowY, M + usable, rowY); // row separator

      setFont("normal", 8);
      const temaWrapped = pdf.splitTextToSize(`${startIndex + idx}. ${topic.tema || ""}`, colTema - 4);
      pdf.text(temaWrapped as string[], M + 2, rowY + 4.5);

      SCORE_HEADERS.forEach((_, i) => {
        const cellX = M + colTema + i * colScore;
        if (topic.score && ORAL_SCORE_OPTIONS[i]?.value === topic.score) {
          setFont("bold", 10);
          pdf.text("X", cellX + colScore / 2, rowY + rowH / 2 + 1.5, { align: "center" });
        }
      });
    });

    y += tableH + 6;
  };

  drawTopicsTable("Elegidos por el estudiante", payload.temasElegidosEstudiante);
  drawTopicsTable("Sugeridos por el docente", payload.temasSugeridosDocente, 1);

  // ── Nota final ────────────────────────────────────────────────────────────
  setFont("bold", 10);
  pdf.text("NOTA FINAL:", M, y);
  setFont("normal", 10);
  const notaX = M + pdf.getTextWidth("NOTA FINAL:  ");
  pdf.text(payload.notaFinal ?? "", notaX, y);
  pdf.setLineWidth(0.3);
  pdf.line(notaX, y + 0.8, notaX + 50, y + 0.8);
  y += 8;

  // ── Observaciones ─────────────────────────────────────────────────────────
  setFont("bold", 9);
  pdf.text("OBSERVACIONES:", M, y);
  y += 3;
  setFont("normal", 9);
  const obsText = payload.observaciones ?? "";
  const obsLines = pdf.splitTextToSize(obsText, usable - 4);
  const obsH = Math.max(28, obsLines.length * 5 + 6);
  pdf.rect(M, y, usable, obsH);
  if (obsLines.length > 0) pdf.text(obsLines as string[], M + 2, y + 5);
  y += obsH + 12;

  // ── Signatures ────────────────────────────────────────────────────────────
  const sigW = (usable - 20) / 3;
  const sigNames = [
    tribunal.vocal1 ?? "Vocal 1",
    tribunal.presidente ?? "Presidente",
    tribunal.vocal2 ?? tribunal.vocalExtra ?? "Vocal 2",
  ];
  const sigLabels = ["Vocal 1", "Presidente", "Vocal 2"];
  sigNames.forEach((name, i) => {
    const x = M + i * (sigW + 10);
    pdf.setLineWidth(0.4);
    pdf.line(x, y, x + sigW, y);
    setFont("bold", 8);
    pdf.text(sigLabels[i], x + sigW / 2, y + 4, { align: "center" });
    setFont("normal", 7);
    pdf.text(name, x + sigW / 2, y + 8, { align: "center" });
  });

  const safeName = payload.estudiante.replace(/\s+/g, "_").replace(/[^\w_-]/g, "");
  pdf.save(`acta_oral_${safeName || "estudiante"}.pdf`);
}
