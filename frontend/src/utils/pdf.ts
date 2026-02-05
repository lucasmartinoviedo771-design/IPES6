// utils/pdf.ts - version "A4 / OFICIO COMPACTO"
import dayjs from "dayjs";
import { jsPDF } from "jspdf";

const F = {
  title: 10.0,
  sub: 7.0,
  cardTitle: 7.0,
  label: 6.0,
  text: 6.0,
};

const S = {
  margin: 4,
  rowH: 4.6,
  lineOffset: 1.2,
  cardPadTop: 9,
  cardPadBottom: 3,
  cardGap: 0.5,
  checkGap: 3.8,
  obsH: 9,
  sigGapY: 5,
  sigLabelPad: 2.5,
  accentW: 2,
  radius: 2.0,
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
  const accent: [number, number, number] = opts?.accentRGB ?? [219, 120, 26];
  const format: PageFormat = opts?.pageFormat ?? "a4";
  const pdf = new jsPDF({ unit: "mm", format, orientation: "portrait" });

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = S.margin;
  const LINE_GRAY = 170;
  const CARD_R = S.radius;
  let y = M;

  const ensureSpace = (need: number) => {
    if (y + need <= H - M) return;
    pdf.addPage();
    y = M;
    drawHeader(true);
    y += 4;
  };

  const drawHeader = (compact = false) => {
    const logo = 16;
    const qr = 20;

    pdf.setDrawColor(accent[0], accent[1], accent[2]);
    pdf.setLineWidth(1.0);
    pdf.line(M, y, W - M, y);
    y += 5;

    if (!compact) {
      if (opts?.logos?.left) pdf.addImage(opts.logos.left, "PNG", M, y - 4, logo, logo);
      if (opts?.logos?.right) pdf.addImage(opts.logos.right, "PNG", W - M - logo, y - 4, logo, logo);
    }
    if (opts?.qrDataUrl) pdf.addImage(opts.qrDataUrl, "PNG", W - M - qr, y - 5, qr, qr);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.title);
    pdf.text("PLANILLA DE PREINSCRIPCION 2025", W / 2, y + 1.5, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.sub);
    pdf.text('Instituto Provincial de Educacion Superior "Paulo Freire"', W / 2, y + 5, { align: "center" });

    const pillText = fmt(carreraNombre || "Carrera");
    const tw = pdf.getTextWidth(pillText) + 10;
    const px = W / 2 - tw / 2, py = y + 10;
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(px, py - 4, tw, 7.6, 4, 4, "F");
    pdf.setTextColor(255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.sub);
    pdf.text(pillText, W / 2, py + 0.6, { align: "center" });
    pdf.setTextColor(0);

    y = py + 7;
  };

  const cardStart = (title: string, estimateHeight: number, gapAfter = S.cardGap) => {
    ensureSpace(estimateHeight + gapAfter);
    const x = M, w = W - 2 * M;
    const yTop = y;

    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(x + 3, yTop + 3, S.accentW, 4, 1, 1, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.cardTitle);
    pdf.text(title, x + 8, yTop + 6.6);

    y = yTop + S.cardPadTop;

    return (extraGap?: number) => {
      const h = y - yTop + S.cardPadBottom;
      pdf.setDrawColor(210);
      pdf.roundedRect(x, yTop, w, h, S.radius, S.radius);
      y += (extraGap ?? gapAfter);
    };
  };

  const lineField = (label: string, value?: string, colX?: number, colW?: number) => {
    const x = colX ?? (M + 8);
    const w = colW ?? (W - 2 * M - 16);
    const L = `${label}: `;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(F.label);
    pdf.text(L, x, y);
    const lw = pdf.getTextWidth(L) + 2;

    const base = y + S.lineOffset;
    const lx1 = x + lw, lx2 = x + w;
    pdf.setDrawColor(LINE_GRAY);
    pdf.setLineWidth(0.35);
    pdf.line(lx1, base, lx2, base);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.text);
    const txt = fmt(value);
    if (txt !== "-") pdf.text(txt, lx1 + 0.8, y);

    y += S.rowH;
  };

  const twoCols = (left: Array<[string, string?]>, right: Array<[string, string?]>) => {
    const gap = 8;
    const colW = (W - 2 * M - 16 - gap) / 2;
    const xL = M + 8;
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
    const gap = 8;
    const innerW = (W - 2 * M - 16) - reserveRightW;
    const colW = (innerW - gap) / 2;
    const xL = M + 8;
    const xR = xL + colW + gap;
    const y0 = y;
    let yL = y0, yR = y0;

    left.forEach(([l, v]) => { y = yL; lineField(l, v, xL, colW); yL = y; });
    right.forEach(([l, v]) => { y = yR; lineField(l, v, xR, colW); yR = y; });
    y = Math.max(yL, yR);
  };

  drawHeader();

  const PHOTO = { w: 24, h: 30, pad: 1.5, gap: 6 };

  let close = cardStart("DATOS PERSONALES", 70, 8);
  const innerRight = W - M - 8;

  const photoX = innerRight - PHOTO.w;
  const photoY = y;
  pdf.setDrawColor(200);
  pdf.rect(photoX - PHOTO.pad, photoY - PHOTO.pad, PHOTO.w + 2 * PHOTO.pad, PHOTO.h + 2 * PHOTO.pad);
  if (opts?.studentPhotoDataUrl) {
    const isPng = opts.studentPhotoDataUrl.startsWith("data:image/png");
    const fmtImg: any = isPng ? "PNG" : "JPEG";
    try {
      pdf.addImage(opts.studentPhotoDataUrl, fmtImg, photoX, photoY, PHOTO.w, PHOTO.h, "", "FAST");
    } catch (e) {
      try { pdf.addImage(opts.studentPhotoDataUrl, fmtImg, photoX, photoY, PHOTO.w, PHOTO.h); } catch { /* ignore */ }
    }
  } else {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);
    pdf.text("Foto 4x4", photoX + PHOTO.w / 2, photoY + PHOTO.h / 2, { align: "center" });
  }

  const reserveRight = PHOTO.w + 2 * PHOTO.pad + PHOTO.gap;
  twoColsReserveRight(
    [
      ["Apellido y Nombres", `${fmt(v.apellido)}, ${fmt(v.nombres)} `],
      ["Fecha de nacimiento", fmtDate(v.fecha_nacimiento)],
      ["Lugar de nacimiento", `${fmt(v.localidad_nac)}, ${fmt(v.provincia_nac)} `],
      ["Nacionalidad", fmt(v.nacionalidad)],
    ],
    [
      ["C.U.I.L.", fmt(v.cuil)],
      ["D.N.I.", fmt(v.dni)],
      ["Pais", fmt(v.pais_nac)],
      ["Estado civil", fmt(v.estado_civil)],
    ],
    reserveRight
  );
  if (v.cud_informado) {
    lineField("CUD informado", "Si");
  }
  if (v.condicion_salud_informada) {
    const detalle = v.condicion_salud_detalle || "Si";
    lineField("Condicion / asistencia informada", detalle);
  }

  y = Math.max(y, photoY + PHOTO.h) + 1.2;
  close();

  close = cardStart("DATOS DE CONTACTO", 46, 8);
  lineField("Domicilio", v.domicilio);
  twoCols(
    [
      ["Telefono fijo", v.tel_fijo],
      ["E-mail", v.email],
    ],
    [
      ["Telefono movil", v.tel_movil],
      ["Emergencia (tel)", v.emergencia_telefono],
    ]
  );
  lineField("Parentesco de emergencia", v.emergencia_parentesco);
  close();

  close = cardStart("DATOS LABORALES", 28, 8);
  twoCols(
    [
      ["Trabaja?", v.trabaja ? "Si" : "No"],
      ["Horario", v.horario_trabajo],
    ],
    [
      ["Empleador", v.empleador],
      ["Domicilio de trabajo", v.domicilio_trabajo],
    ]
  );
  close();

  close = cardStart("ESTUDIOS", 66, 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.text("SECUNDARIO", M + 8, y);
  y += 4.2;
  twoCols(
    [
      ["Titulo", v.sec_titulo],
      ["Fecha de egreso", fmtDate(v.sec_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sec_establecimiento],
      ["Localidad / Provincia / Pais", joinLocation(v.sec_localidad, v.sec_provincia, v.sec_pais)],
    ]
  );
  y += 1.0;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.text("SUPERIOR (OPCIONAL)", M + 8, y);
  y += 4.2;
  twoCols(
    [
      ["Titulo", v.sup1_titulo],
      ["Fecha de egreso", fmtDate(v.sup1_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sup1_establecimiento],
      ["Localidad / Provincia / Pais", joinLocation(v.sup1_localidad, v.sup1_provincia, v.sup1_pais)],
    ]
  );
  close();

  close = cardStart("DOCUMENTACION PRESENTADA (A COMPLETAR POR BEDELIA)", 86, 8);
  const d = opts?.docs || {};
  const leftDocs = [
    ["Fotocopia legalizada del DNI", d.dni],
    ["2 fotos carnet 4x4", d.fotos],
    ["Certificado de estudiante regular", d.estudianteRegular],
    ["Certificado de buena salud", d.salud],
  ] as const;
  const rightDocs = [
    ["Fotocopia legalizada del analitico", d.analitico],
    ["Titulo secundario", d.titulo],
    ["Certificado de titulo en tramite", d.tituloTramite],
    ["3 folios oficio", d.folios],
  ] as const;

  const gap = 8;
  const colW = (W - 2 * M - 16 - gap) / 2;
  let yL = y, yR = y;
  const box = (x: number, yy: number, text: string, checked?: boolean) => {
    pdf.rect(x, yy - 3.2, 4.0, 4.0);
    if (checked) { pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.text); pdf.text("X", x + 1.25, yy + 1.1); }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(F.text);
    pdf.text(text, x + 6.0, yy);
  };
  leftDocs.forEach(([t, c]) => { box(M + 8, yL, t, c); yL += S.checkGap; });
  rightDocs.forEach(([t, c]) => { box(M + 8 + colW + gap, yR, t, c); yR += S.checkGap; });
  y = Math.max(yL, yR) + 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(F.label);
  pdf.text("Observaciones / adeuda materias:", M + 8, y);
  y += 1.5;
  pdf.setDrawColor(LINE_GRAY);
  pdf.rect(M + 8, y, W - 2 * M - 16, S.obsH);
  y += S.obsH + 6;

  if (v.consentimiento_datos) {
    const consentText =
      "El/la aspirante otorgo su consentimiento expreso e informado para que los datos sensibles declarados se utilicen unicamente para garantizar soporte academico y accesibilidad.";
    const lines = pdf.splitTextToSize(consentText, W - 2 * M - 16) as string[];
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(F.text);
    pdf.text(lines, M + 8, y);
    y += lines.length * 4.0;
  }

  const sigW = (W - 2 * M - 16 - 10) / 2;
  const x1 = M + 8, x2 = x1 + sigW + 10;
  const yLine = y + S.sigGapY;
  pdf.setDrawColor(LINE_GRAY);
  pdf.line(x1, yLine, x1 + sigW, yLine);
  pdf.line(x2, yLine, x2 + sigW, yLine);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(F.text);
  pdf.text("Firma y aclaracion del inscripto", x1 + sigW / 2, yLine + S.sigLabelPad, { align: "center" });
  pdf.text("Firma, aclaracion y sello del personal", x2 + sigW / 2, yLine + S.sigLabelPad, { align: "center" });
  y = yLine + S.sigLabelPad + 2.5;
  close();

  close = cardStart("COMPROBANTE DE INSCRIPCION DEL ALUMNO", 38, 8);
  lineField("Estudiante/a", `${fmt(v.apellido)}, ${fmt(v.nombres)} `);
  lineField("DNI", fmt(v.dni));
  lineField("Carrera", carreraNombre);
  if (opts?.qrDataUrl) pdf.addImage(opts.qrDataUrl, "PNG", W - M - 24, y - 9, 18, 18);
  close();

  try {
    const base = `${fmt(v.apellido)}_${fmt(v.nombres)}_${fmt(v.dni)} `
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const filename = (base || "preinscripcion") + ".pdf";
    pdf.save(filename);
  } catch {
    pdf.save("preinscripcion.pdf");
  }
}
