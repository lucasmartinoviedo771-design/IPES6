// utils/pdf.ts — versión "OFICIO COMPACTO"
import dayjs from "dayjs";
import { jsPDF } from "jspdf";

const F = {
  // fuentes
  title: 12.5,             // título grande
  sub: 9.0,                // “pill” y mini rotulados
  cardTitle: 9.4,          // título de tarjeta
  label: 8.9,              // etiqueta de campo
  text: 8.9,               // valor de campo
};

const S = {
  margin: 12,              // margen externo
  rowH: 6.0,               // alto de fila de campo (interlineado compacto)
  lineOffset: 2.0,         // cuánto baja la línea respecto del texto
  cardPadTop: 10,          // alto de encabezado de tarjeta
  cardPadBottom: 6,        // padding inferior de tarjeta
  cardGap: 4,              // separación entre tarjetas
  checkGap: 6.0,           // separación vertical entre checks
  obsH: 14,                // altura del cuadro de observaciones
  sigGapY: 10,             // separación vertical hasta las líneas de firma
  sigLabelPad: 4.0,        // separación etiqueta de firma
  accentW: 2,              // barrita naranja del título
  radius: 2.0,             // radio de tarjeta
};

const fmt = (v?: any) => (v === 0 || v ? String(v) : "—");
const fmtDate = (s?: string) => (s ? dayjs(s).format("DD/MM/YYYY") : "—");

export type PreinscripcionValues = {
  apellido?: string; nombres?: string; dni?: string; cuil?: string;
  fecha_nacimiento?: string; nacionalidad?: string; estado_civil?: string;
  localidad_nac?: string; provincia_nac?: string; pais_nac?: string; domicilio?: string;
  email?: string; tel_movil?: string; tel_fijo?: string;
  emergencia_telefono?: string; emergencia_parentesco?: string;
  trabaja?: boolean; empleador?: string; horario?: string; dom_trabajo?: string;
  sec_titulo?: string; sec_establecimiento?: string; sec_fecha_egreso?: string;
  sec_localidad?: string; sec_provincia?: string; sec_pais?: string;
  sup1_titulo?: string; sup1_establecimiento?: string; sup1_fecha_egreso?: string;
};

export type DocsFlags = {
  dni?: boolean; analitico?: boolean; fotos?: boolean; titulo?: boolean;
  alumnoRegular?: boolean; tituloTramite?: boolean; salud?: boolean; folios?: boolean;
};

export function generarPlanillaPDF(
  v: PreinscripcionValues,
  carreraNombre: string,
  opts?: {
    accentRGB?: [number, number, number];
    logos?: { left?: string; right?: string };
    qrDataUrl?: string;
    docs?: DocsFlags;
    studentPhotoDataUrl?: string;
  }
) {
  const accent: [number, number, number] = opts?.accentRGB ?? [219,120,26];
  const pdf = new jsPDF({ unit: "mm", format: "legal", orientation: "portrait" }); // SIEMPRE OFICIO

  // Métricas
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
    y += 4; // menos extra en páginas siguientes
  };

  // ======== HEADER (QR a la derecha) ========
  const drawHeader = (compact = false) => {
    const logo = 16;  // más pequeño
    const qr = 20;

    // Línea superior
    pdf.setDrawColor(accent[0], accent[1], accent[2]);
    pdf.setLineWidth(1.0);
    pdf.line(M, y, W - M, y);
    y += 5;

    if (!compact) {
      if (opts?.logos?.left) pdf.addImage(opts.logos.left, "PNG", M, y - 4, logo, logo);
      if (opts?.logos?.right) pdf.addImage(opts.logos.right, "PNG", W - M - logo, y - 4, logo, logo);
    }
    if (opts?.qrDataUrl) pdf.addImage(opts.qrDataUrl, "PNG", W - M - qr, y - 5, qr, qr);

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.title);
    pdf.text("PLANILLA DE PREINSCRIPCIÓN 2025", W/2, y + 1.5, { align: "center" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(F.sub);
    pdf.text('Instituto Provincial de Educación Superior “Paulo Freire”', W/2, y + 5, { align: "center" });

    const pillText = fmt(carreraNombre || "Carrera");
    const tw = pdf.getTextWidth(pillText) + 10;
    const px = W/2 - tw/2, py = y + 10;
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(px, py - 4, tw, 7.6, 4, 4, "F");
    pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.sub);
    pdf.text(pillText, W/2, py + 0.6, { align: "center" });
    pdf.setTextColor(0);

    y = py + 7;
  };

  // ======== Tarjeta compacta ========
const cardStart = (title: string, estimateHeight: number, gapAfter = S.cardGap) => {
  ensureSpace(estimateHeight + gapAfter);
  const x = M, w = W - 2*M;
  const yTop = y;

  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.roundedRect(x + 3, yTop + 3, S.accentW, 4, 1, 1, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.cardTitle);
  pdf.text(title, x + 8, yTop + 6.6);

  y = yTop + S.cardPadTop;

  // devolvemos un "close" que permite pasar un gap extra opcional
  return (extraGap?: number) => {
    const h = y - yTop + S.cardPadBottom;
    pdf.setDrawColor(210);
    pdf.roundedRect(x, yTop, w, h, S.radius, S.radius);
    y += (extraGap ?? gapAfter);
  };
};

  // ======== Campo con línea compacta ========
  const lineField = (label: string, value?: string, colX?: number, colW?: number) => {
    const x = colX ?? (M + 8);
    const w = colW ?? (W - 2*M - 16);
    const L = `${label}:`;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.label);
    pdf.text(L, x, y);
    const lw = pdf.getTextWidth(L) + 2;

    // línea más baja y menos gruesa
    const base = y + S.lineOffset;
    const lx1 = x + lw, lx2 = x + w;
    pdf.setDrawColor(LINE_GRAY); pdf.setLineWidth(0.35);
    pdf.line(lx1, base, lx2, base);

    pdf.setFont("helvetica", "normal"); pdf.setFontSize(F.text);
    const txt = fmt(value);
    if (txt !== "—") pdf.text(txt, lx1 + 0.8, y);

    y += S.rowH;
  };

  const twoCols = (left: Array<[string, string?]>, right: Array<[string, string?]>) => {
    const gap = 8;
    const colW = (W - 2*M - 16 - gap) / 2;
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
    const innerW = (W - 2 * M - 16) - reserveRightW;   // 16 = padding interior
    const colW = (innerW - gap) / 2;
    const xL = M + 8;
    const xR = xL + colW + gap;
    const y0 = y;
    let yL = y0, yR = y0;

    left.forEach(([l, v]) => { y = yL; lineField(l, v, xL, colW); yL = y; });
    right.forEach(([l, v]) => { y = yR; lineField(l, v, xR, colW); yR = y; });
    y = Math.max(yL, yR);
  };

  // ======= Header
  drawHeader();

  // ======= PERSONALES (con foto)
  const PHOTO = { w: 24, h: 30, pad: 1.5, gap: 6 }; // 24x30mm aprox carnet, ajustable

  let close = cardStart("DATOS PERSONALES", 60, 8);
  /** coordenadas útiles del interior de la tarjeta */
  const innerX = M + 8;
  const innerRight = W - M - 8;

  // marco y foto (arriba-derecha de la tarjeta)
  const photoX = innerRight - PHOTO.w;       // pegado al borde interior derecho
  const photoY = y;                           // alineado al tope de contenidos
  pdf.setDrawColor(200);
  pdf.rect(photoX - PHOTO.pad, photoY - PHOTO.pad, PHOTO.w + 2*PHOTO.pad, PHOTO.h + 2*PHOTO.pad);
  if (opts?.studentPhotoDataUrl) {
    // admite PNG o JPEG en dataURL; detectar formato explícitamente
    const isPng = opts.studentPhotoDataUrl.startsWith("data:image/png");
    const fmt: any = isPng ? "PNG" : "JPEG";
    try {
      pdf.addImage(opts.studentPhotoDataUrl, fmt, photoX, photoY, PHOTO.w, PHOTO.h, "", "FAST");
    } catch (e) {
      // fallback sin compresión si falla FAST
      try { pdf.addImage(opts.studentPhotoDataUrl, fmt, photoX, photoY, PHOTO.w, PHOTO.h); } catch (e) { /* Ignored, fallback without compression */ }
    }
  } else {
    // placeholder
    pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5);
    pdf.text("Foto 4x4", photoX + PHOTO.w/2, photoY + PHOTO.h/2, { align: "center" });
  }

  // campos: dejamos libre el ancho ocupado por la foto
  const reserveRight = PHOTO.w + 2*PHOTO.pad + PHOTO.gap;
  twoColsReserveRight(
    [
      ["Apellido y Nombres", `${fmt(v.apellido)}, ${fmt(v.nombres)}`],
      ["Fecha de nacimiento", fmtDate(v.fecha_nacimiento)],
      ["Lugar de nacimiento", `${fmt(v.localidad_nac)}, ${fmt(v.provincia_nac)}`],
      ["Nacionalidad", fmt(v.nacionalidad)],
    ],
    [
      ["C.U.I.L.", fmt(v.cuil)],
      ["D.N.I.", fmt(v.dni)],
      ["País", fmt(v.pais_nac)],
      ["Estado civil", fmt(v.estado_civil)],
    ],
    reserveRight
  );

  // aseguramos que la tarjeta sea al menos tan alta como la foto
  y = Math.max(y, photoY + PHOTO.h) + 2;
  close();

  // ======= CONTACTO
  close = cardStart("DATOS DE CONTACTO", 46, 8);
  lineField("Domicilio", v.domicilio);
  twoCols(
    [
      ["Teléfono fijo", v.tel_fijo],
      ["E-mail", v.email],
    ],
    [
      ["Teléfono móvil", v.tel_movil],
      ["Emergencia (tel)", v.emergencia_telefono],
    ]
  );
  lineField("Parentesco de emergencia", v.emergencia_parentesco);
  close();

  // ======= LABORALES
  close = cardStart("DATOS LABORALES", 28, 8);
  twoCols(
    [
      ["¿Trabaja?", v.trabaja ? "Sí" : "No"],
      ["Horario", v.horario],
    ],
    [
      ["Empleador", v.empleador],
      ["Domicilio de trabajo", v.dom_trabajo],
    ]
  );
  close();

  // ======= ESTUDIOS
  close = cardStart("ESTUDIOS", 66, 8);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.label);
  pdf.text("SECUNDARIO", M + 8, y); y += 4.2;
  twoCols(
    [
      ["Título", v.sec_titulo],
      ["Fecha de egreso", fmtDate(v.sec_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sec_establecimiento],
      ["Localidad", `${fmt(v.sec_localidad)}, ${fmt(v.sec_provincia)}, ${fmt(v.sec_pais)}`],
    ]
  );
  y += 1.5;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.label);
  pdf.text("SUPERIOR (OPCIONAL)", M + 8, y); y += 4.2;
  twoCols(
    [
      ["Título", v.sup1_titulo],
      ["Fecha de egreso", fmtDate(v.sup1_fecha_egreso)],
    ],
    [
      ["Establecimiento", v.sup1_establecimiento],
      ["", ""],
    ]
  );
  close();

  // ======= DOCUMENTACIÓN
  close = cardStart("DOCUMENTACIÓN PRESENTADA (A COMPLETAR POR BEDELÍA)", 86, 8);
  const d = opts?.docs || {};
  const leftDocs = [
    ["Fotocopia legalizada del DNI", d.dni],
    ["2 fotos carnet 4×4", d.fotos],
    ["Certificado de alumno regular", d.alumnoRegular],
    ["Certificado de buena salud", d.salud],
  ] as const;
  const rightDocs = [
    ["Fotocopia legalizada del analítico", d.analitico],
    ["Título secundario", d.titulo],
    ["Certificado de título en trámite", d.tituloTramite],
    ["3 folios oficio", d.folios],
  ] as const;

  const gap = 8;
  const colW = (W - 2*M - 16 - gap) / 2;
  let yL = y, yR = y;
  const box = (x: number, yy: number, text: string, checked?: boolean) => {
    pdf.rect(x, yy - 3.2, 4.0, 4.0);
    if (checked) { pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.text); pdf.text("X", x + 1.25, yy + 1.1); }
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(F.text);
    pdf.text(text, x + 6.0, yy);
  };
  leftDocs.forEach(([t, c]) => { box(M + 8, yL, t, c); yL += S.checkGap; });
  rightDocs.forEach(([t, c]) => { box(M + 8 + colW + gap, yR, t, c); yR += S.checkGap; });
  y = Math.max(yL, yR) + 3;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(F.label);
  pdf.text("Observaciones / adeuda materias:", M + 8, y); y += 1.5;
  pdf.setDrawColor(LINE_GRAY); pdf.rect(M + 8, y, W - 2*M - 16, S.obsH);
  y += S.obsH + 6;

  // Firmas compactas
  const sigW = (W - 2*M - 16 - 10) / 2;
  const x1 = M + 8, x2 = x1 + sigW + 10;
  const yLine = y + S.sigGapY;
  pdf.setDrawColor(LINE_GRAY);
  pdf.line(x1, yLine, x1 + sigW, yLine);
  pdf.line(x2, yLine, x2 + sigW, yLine);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(F.text);
  pdf.text("Firma y aclaración del inscripto", x1 + sigW/2, yLine + S.sigLabelPad, { align: "center" });
  pdf.text("Firma, aclaración y sello del personal", x2 + sigW/2, yLine + S.sigLabelPad, { align: "center" });
  y = yLine + S.sigLabelPad + 4;
  close();

  // ======= COMPROBANTE
  close = cardStart("COMPROBANTE DE INSCRIPCIÓN DEL ALUMNO", 38, 8);
  lineField("Alumno/a", `${fmt(v.apellido)}, ${fmt(v.nombres)}`);
  lineField("DNI", fmt(v.dni));
  lineField("Carrera", carreraNombre);
  if (opts?.qrDataUrl) pdf.addImage(opts.qrDataUrl, "PNG", W - M - 24, y - 9, 18, 18);
  close();

  // Guardar
  try {
    const base = `${fmt(v.apellido)}_${fmt(v.nombres)}_${fmt(v.dni)}`
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const filename = (base || "preinscripcion") + ".pdf";
    pdf.save(filename);
  } catch {
    // fallback genérico
    pdf.save("preinscripcion.pdf");
  }
}
