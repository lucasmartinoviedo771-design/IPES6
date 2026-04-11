// utils/pdf.ts - version "PREMIUM REDESIGN"
import dayjs from "dayjs";
import { jsPDF } from "jspdf";

// Configuración de Tipografía y Tamaños (Premium Hierarchy)
const F = {
  title: 14.0,
  sub: 8.5,
  cardTitle: 9.0,
  label: 7.0,
  text: 7.5,
  meta: 6.5,
};

// Configuración de Estética y Espacios (mm)
const S = {
  margin: 10,
  rowH: 6.5,
  lineOffset: 1.5,
  cardPadTop: 10,
  cardPadBottom: 5,
  cardGap: 10,
  checkGap: 6.5,
  obsH: 15,
  sigGapY: 15,
  sigLabelPad: 4,
  accentW: 2.5,
  radius: 1.5,
};

// Colores Premium
const COLORS = {
  primary: [194, 75, 23] as [number, number, number], // Deep Terracotta / IPES Orange
  textMain: [30, 30, 30] as [number, number, number],
  textSecondary: [100, 100, 100] as [number, number, number],
  borderLight: [230, 230, 230] as [number, number, number],
  borderMedium: [200, 200, 200] as [number, number, number],
  bgLight: [250, 250, 250] as [number, number, number],
};

const fmt = (v?: any) => (v === 0 || v ? String(v) : "-");
const fmtDate = (s?: string) => (s ? dayjs(s).format("DD/MM/YYYY") : "-");
const joinLocation = (...parts: (string | undefined)[]) => {
  const value = parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(", ");
  return value || undefined;
};

export type PreinscripcionValues = {
  apellido?: string;
  nombres?: string;
  dni?: string;
  cuil?: string;
  fecha_nacimiento?: string;
  nacionalidad?: string;
  estado_civil?: string;
  localidad_nac?: string;
  provincia_nac?: string;
  pais_nac?: string;
  domicilio?: string;
  email?: string;
  tel_movil?: string;
  tel_fijo?: string;
  emergencia_telefono?: string;
  emergencia_parentesco?: string;
  trabaja?: boolean;
  empleador?: string;
  horario_trabajo?: string;
  domicilio_trabajo?: string;
  sec_titulo?: string;
  sec_establecimiento?: string;
  sec_fecha_egreso?: string;
  sec_localidad?: string;
  sec_provincia?: string;
  sec_pais?: string;
  sup1_titulo?: string;
  sup1_establecimiento?: string;
  sup1_fecha_egreso?: string;
  sup1_localidad?: string;
  sup1_provincia?: string;
  sup1_pais?: string;
  cud_informado?: boolean;
  condicion_salud_informada?: boolean;
  condicion_salud_detalle?: string;
  consentimiento_datos?: boolean;
};

export type DocsFlags = {
  dni?: boolean;
  analitico?: boolean;
  fotos?: boolean;
  titulo?: boolean;
  estudianteRegular?: boolean;
  tituloTramite?: boolean;
  salud?: boolean;
  folios?: boolean;
};

type PageFormat = "a4" | "legal";

export function generarPlanillaPDF(
  v: PreinscripcionValues,
  carreraNombre: string,
  opts?: {
    accentRGB?: [number, number, number];
    logos?: { left?: string; right?: string };
    qrDataUrl?: string;
    docs?: DocsFlags;
    studentPhotoDataUrl?: string;
    pageFormat?: PageFormat;
  }
) {
  const accent = opts?.accentRGB ?? COLORS.primary;
  const format: PageFormat = opts?.pageFormat ?? "legal";
  const pdf = new jsPDF({ unit: "mm", format, orientation: "portrait" });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = S.margin;
  let y = M;

  const ensureSpace = (need: number) => {
    if (y + need <= H - M) return;
    pdf.addPage();
    y = M;
    drawHeader(true);
    y += 8;
  };

  const drawHeader = (compact = false) => {
    const logoSize = 18;
    // const qrSize = 22; // QR removido a pedido del usuario

    if (!compact) {
      if (opts?.logos?.left) { pdf.addImage(opts.logos.left, "PNG", M, y, logoSize, logoSize); }
      if (opts?.logos?.right) { pdf.addImage(opts.logos.right, "PNG", W - M - logoSize, y, logoSize, logoSize); }
    }
    
    /* QR Code removido de preinscripcion
    if (opts?.qrDataUrl) {
      pdf.addImage(opts.qrDataUrl, "PNG", W - M - qrSize, y - 2, qrSize, qrSize);
    }
    */

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.title);
    pdf.setTextColor(...COLORS.textMain);
    pdf.text("PLANILLA DE PREINSCRIPCIÓN 2026", W / 2, y + 6, { align: "center" });
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.sub);
    pdf.setTextColor(...COLORS.textSecondary);
    pdf.text('Instituto Provincial de Educación Superior "Paulo Freire"', W / 2, y + 11, { align: "center" });

    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.8);
    pdf.line(W / 2 - 40, y + 14, W / 2 + 40, y + 14);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...accent);
    pdf.text(fmt(carreraNombre || "Carrera").toUpperCase(), W / 2, y + 20, { align: "center" });

    y += compact ? 15 : 28;
  };

  const cardStart = (title: string, estimateHeight: number, gapAfter = S.cardGap) => {
    ensureSpace(estimateHeight + gapAfter);
    const x = M, w = W - 2 * M;
    const yTop = y;

    pdf.setFillColor(...accent);
    pdf.roundedRect(x, yTop, S.accentW, 6, 0.5, 0.5, "F");
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.cardTitle);
    pdf.setTextColor(...COLORS.textMain);
    pdf.text(title, x + 5, yTop + 4.5);

    pdf.setDrawColor(...COLORS.borderLight);
    pdf.setLineWidth(0.2);
    pdf.line(x, yTop + 7, x + w, yTop + 7);

    y = yTop + S.cardPadTop;

    return (extraGap?: number) => {
      y += (extraGap ?? gapAfter);
    };
  };

  const lineField = (label: string, value?: string, colX?: number, colW?: number) => {
    const x = colX ?? (M + 6);
    const w = colW ?? (W - 2 * M - 12);
    const labelText = `${label}: `;
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.label);
    pdf.setTextColor(...COLORS.textSecondary);
    pdf.text(labelText, x, y);
    
    const labelWidth = pdf.getTextWidth(labelText) + 1.5;
    const valX = x + labelWidth;
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.text);
    pdf.setTextColor(...COLORS.textMain);
    const txt = fmt(value);
    if (txt !== "-") pdf.text(txt, valX, y);

    pdf.setDrawColor(...COLORS.borderLight);
    pdf.setLineWidth(0.15);
    pdf.line(valX, y + 1, x + w, y + 1);

    y += S.rowH;
  };

  const twoCols = (left: Array<[string, string?]>, right: Array<[string, string?]>) => {
    const gap = 10;
    const colW = (W - 2 * M - 12 - gap) / 2;
    const xL = M + 6;
    const xR = xL + colW + gap;
    const y0 = y;
    let yL = y0, yR = y0;

    left.forEach(([l, v]) => { y = yL; lineField(l, v, xL, colW); yL = y; });
    right.forEach(([l, v]) => { y = yR; lineField(l, v, xR, colW); yR = y; });
    y = Math.max(yL, yR);
  };

  const twoColsReserveRight = (
    left: Array<[string, string?]>,
    right: Array<[string, string?]>,
    reserveRightW: number,
  ) => {
    const gap = 10;
    const innerW = (W - 2 * M - 12) - reserveRightW;
    const colW = (innerW - gap) / 2;
    const xL = M + 6;
    const xR = xL + colW + gap;
    const y0 = y;
    let yL = y0, yR = y0;

    left.forEach(([l, v]) => { y = yL; lineField(l, v, xL, colW); yL = y; });
    right.forEach(([l, v]) => { y = yR; lineField(l, v, xR, colW); yR = y; });
    y = Math.max(yL, yR);
  };

  drawHeader();

  const PHOTO = { w: 26, h: 32, gap: 8 };

  let close = cardStart("DATOS PERSONALES", 75);
  const innerRight = W - M - 6;

  const photoX = innerRight - PHOTO.w;
  const photoY = y - 2;
  
  pdf.setDrawColor(...COLORS.borderMedium);
  pdf.setLineWidth(0.2);
  pdf.rect(photoX - 0.5, photoY - 0.5, PHOTO.w + 1, PHOTO.h + 1);
  
  if (opts?.studentPhotoDataUrl) {
    const isPng = opts.studentPhotoDataUrl.startsWith("data:image/png");
    const fmtImg: any = isPng ? "PNG" : "JPEG";
    try {
      pdf.addImage(opts.studentPhotoDataUrl, fmtImg, photoX, photoY, PHOTO.w, PHOTO.h, "", "MEDIUM");
    } catch { /* ignored */ }
  } else {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.textSecondary);
    pdf.text("Foto 4x4", photoX + PHOTO.w / 2, photoY + PHOTO.h / 2 + 2, { align: "center" });
  }

  const reserveRight = PHOTO.w + PHOTO.gap;
  twoColsReserveRight(
    [
      ["Apellido y Nombres", `${fmt(v.apellido)}, ${fmt(v.nombres)} `],
      ["D.N.I.", fmt(v.dni)],
      ["C.U.I.L.", fmt(v.cuil)],
      ["Fecha de nacimiento", fmtDate(v.fecha_nacimiento)],
    ],
    [
      ["Nacionalidad", fmt(v.nacionalidad)],
      ["Estado civil", fmt(v.estado_civil)],
      ["País de nac.", fmt(v.pais_nac)],
      ["CUD Informado", v.cud_informado ? "Sí" : "No"],
    ],
    reserveRight
  );
  lineField("Lugar de nacimiento", `${fmt(v.localidad_nac)}, ${fmt(v.provincia_nac)} `);
  
  if (v.condicion_salud_informada) {
    lineField("Salud/Asistencia", v.condicion_salud_detalle || "Informado");
  }

  y = Math.max(y, photoY + PHOTO.h) + 2;
  close();

  close = cardStart("DATOS DE CONTACTO Y LABORALES", 55);
  lineField("Domicilio Actual", v.domicilio);
  twoCols(
    [
      ["Teléfono móvil", v.tel_movil],
      ["E-mail", v.email],
      ["Trabaja?", v.trabaja ? "Sí" : "No"],
    ],
    [
      ["Emergencia (Tel)", v.emergencia_telefono],
      ["Parentesco", v.emergencia_parentesco],
      ["Horario laboral", v.horario_trabajo || "-"],
    ]
  );
  if (v.empleador) lineField("Empleador / Domicilio Lab", `${v.empleador} - ${v.domicilio_trabajo || ""}`);
  close();

  close = cardStart("ESTUDIOS ALCANZADOS", 60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.setTextColor(...accent);
  pdf.text("NIVEL SECUNDARIO", M + 6, y);
  y += 5;
  twoCols(
    [
      ["Título", v.sec_titulo],
      ["Egreso", fmtDate(v.sec_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sec_establecimiento],
      ["Ubicación", joinLocation(v.sec_localidad, v.sec_provincia, v.sec_pais)],
    ]
  );
  y += 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.setTextColor(...accent);
  pdf.text("NIVEL SUPERIOR (OPCIONAL)", M + 6, y);
  y += 5;
  twoCols(
    [
      ["Título", v.sup1_titulo],
      ["Egreso", fmtDate(v.sup1_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sup1_establecimiento],
      ["Ubicación", joinLocation(v.sup1_localidad, v.sup1_provincia, v.sup1_pais)],
    ]
  );
  close();

  close = cardStart("DOCUMENTACIÓN Y OBSERVACIONES (USO INTERNO)", 80);
  const d = opts?.docs || {};
  const leftDocs = [
    ["Fotocopia legalizada DNI", d.dni],
    ["2 fotos carnet 4x4", d.fotos],
    ["Certificado Alumno Regular", d.estudianteRegular],
    ["Certificado Buena Salud", d.salud],
  ] as const;
  const rightDocs = [
    ["Copia legalizada Analítico", d.analitico],
    ["Título Secundario", d.titulo],
    ["Certificado Título en Trámite", d.tituloTramite],
    ["3 Folios Oficio", d.folios],
  ] as const;

  const colWDocs = (W - 2 * M - 12 - 10) / 2;
  let yL = y, yR = y;
  const box = (x: number, yy: number, text: string, checked?: boolean) => {
    pdf.setDrawColor(...COLORS.borderMedium);
    pdf.rect(x, yy - 3.2, 3.8, 3.8);
    if (checked) { 
      pdf.setFont("helvetica", "bold"); 
      pdf.setTextColor(...accent);
      pdf.text("✓", x + 0.8, yy - 0.2); 
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.text);
    pdf.setTextColor(...COLORS.textMain);
    pdf.text(text, x + 6.0, yy - 0.2);
  };
  
  leftDocs.forEach(([t, c]) => { box(M + 6, yL, t, c); yL += S.checkGap; });
  rightDocs.forEach(([t, c]) => { box(M + 6 + colWDocs + 10, yR, t, c); yR += S.checkGap; });
  y = Math.max(yL, yR) + 3;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.setTextColor(...COLORS.textSecondary);
  pdf.text("OBSERVACIONES / MATERIAS ADEUDADAS:", M + 6, y);
  y += 2;
  pdf.setDrawColor(...COLORS.borderLight);
  pdf.setFillColor(253, 253, 253);
  pdf.roundedRect(M + 6, y, W - 2 * M - 12, S.obsH, 1, 1, "FD");
  y += S.obsH + 6;

  if (v.consentimiento_datos) {
    const consentText = "El/la aspirante otorga su consentimiento expreso e informado para que los datos sensibles declarados se utilicen únicamente para garantizar soporte académico y accesibilidad conforme a la normativa vigente.";
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(F.meta);
    pdf.setTextColor(...COLORS.textSecondary);
    const lines = pdf.splitTextToSize(consentText, W - 2 * M - 12) as string[];
    pdf.text(lines, M + 6, y);
    y += lines.length * 3.5;
  }

  const sigW = (W - 2 * M - 15) / 2;
  const x1 = M + 6, x2 = W - M - 6 - sigW;
  const yLine = y + S.sigGapY;
  
  pdf.setDrawColor(...COLORS.textMain);
  pdf.setLineWidth(0.3);
  pdf.line(x1, yLine, x1 + sigW, yLine);
  pdf.line(x2, yLine, x2 + sigW, yLine);
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(F.meta);
  pdf.setTextColor(...COLORS.textSecondary);
  pdf.text("Firma y aclaración del inscripto", x1 + sigW / 2, yLine + S.sigLabelPad, { align: "center" });
  pdf.text("Firma y sello del personal de bedelía", x2 + sigW / 2, yLine + S.sigLabelPad, { align: "center" });
  
  y = yLine + S.sigLabelPad + 5;
  close();

  ensureSpace(40);
  pdf.setDrawColor(...COLORS.borderMedium);
  pdf.setLineDashPattern([2, 1], 0);
  pdf.line(M, y, W - M, y);
  pdf.setLineDashPattern([], 0);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.cardTitle);
  pdf.setTextColor(...accent);
  pdf.text("COMPROBANTE DE INSCRIPCIÓN - COPIA PARA EL ESTUDIANTE", M + 6, y);
  y += 7;
  
  lineField("Estudiante", `${fmt(v.apellido)}, ${fmt(v.nombres)} `, M + 6, W - 2 * M - 40);
  lineField("Inscripción", `${carreraNombre} / Ciclo 2026`, M + 6, W - 2 * M - 12);
  
  // Duplicar checklist en pequeño para el alumno
  y += 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.meta);
  pdf.setTextColor(...COLORS.textSecondary);
  pdf.text("DOCUMENTACIÓN ENTREGADA:", M + 6, y);
  y += 4;
  
  const colWSmall = (W - 2 * M - 15) / 2;
  let yLS = y, yRS = y;
  const smallBox = (x: number, yy: number, text: string, checked?: boolean) => {
    pdf.setDrawColor(...COLORS.borderMedium);
    pdf.rect(x, yy - 2.5, 3, 3);
    if (checked) { 
      pdf.setFont("helvetica", "bold"); 
      pdf.setTextColor(...accent);
      pdf.text("✓", x + 0.6, yy - 0.2); 
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.meta - 0.5);
    pdf.setTextColor(...COLORS.textMain);
    pdf.text(text, x + 4.5, yy - 0.2);
  };
  
  leftDocs.forEach(([t, c]) => { smallBox(M + 6, yLS, t, c); yLS += 4.5; });
  rightDocs.forEach(([t, c]) => { smallBox(M + 6 + colWSmall + 5, yRS, t, c); yRS += 4.5; });
  y = Math.max(yLS, yRS) + 2;

  /* QR Code removido de comprobante
  if (opts?.qrDataUrl) {
    pdf.addImage(opts.qrDataUrl, "PNG", W - M - 28, y - 16, 22, 22);
  }
  */

  try {
    const base = `${fmt(v.apellido)}_${fmt(v.nombres)}_${fmt(v.dni)}`
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    pdf.save((base || "preinscripcion") + ".pdf");
  } catch {
    pdf.save("preinscripcion.pdf");
  }
}
