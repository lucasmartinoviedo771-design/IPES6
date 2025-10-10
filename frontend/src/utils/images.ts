// utils/images.ts
export async function prepareStudentPhoto(
  file: File,
  maxSide = 900,        // tope de resolución para no “romper” el PDF
  quality = 0.88        // compresión JPEG
): Promise<string> {
  // 1) Leer el archivo
  const arrayBuf = await file.arrayBuffer();

  // 2) Crear un bitmap que respete la orientación EXIF (si el navegador lo soporta)
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(new Blob([arrayBuf]), { imageOrientation: "from-image" as any });
  } catch {
    // Fallback
  }

  // 3) Crear una imagen (por si no hay createImageBitmap)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(new Blob([arrayBuf]));
  });

  const srcW = bmp ? bmp.width : img.naturalWidth;
  const srcH = bmp ? bmp.height : img.naturalHeight;

  // 4) Escala manteniendo aspecto hasta que el lado más largo sea <= maxSide
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  // 5) Dibujar en canvas y exportar a dataURL JPEG
  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d")!;
  if (bmp) {
    ctx.drawImage(bmp, 0, 0, outW, outH);
  } else {
    ctx.drawImage(img, 0, 0, outW, outH);
  }
  const dataUrl = c.toDataURL("image/jpeg", quality); // liviano para PDF
  if (bmp) bmp.close();
  URL.revokeObjectURL(img.src);
  return dataUrl;
}
