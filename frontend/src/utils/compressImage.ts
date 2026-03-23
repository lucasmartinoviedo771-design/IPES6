/**
 * Comprime y redimensiona una imagen usando canvas.
 * Devuelve el dataURL y un File ya comprimido listo para subir.
 *
 * @param file       Archivo original (JPG, PNG, etc.)
 * @param maxPx      Dimensión máxima (ancho o alto). Por defecto 400px para fotos 4x4.
 * @param quality    Calidad JPEG 0-1. Por defecto 0.85.
 */
export async function compressImage(
  file: File,
  maxPx = 400,
  quality = 0.85,
): Promise<{ dataUrl: string; file: File }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale = Math.min(1, maxPx / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // Convertir dataURL → File para subidas multipart
        const byteString = atob(dataUrl.split(",")[1]);
        const ab = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) ab[i] = byteString.charCodeAt(i);
        const compressed = new File([ab], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });
        resolve({ dataUrl, file: compressed });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
