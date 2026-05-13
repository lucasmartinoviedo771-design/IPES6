import logoMinisterio from "@/assets/escudo_ministerio_tdf.png";
import logoIpes from "@/assets/logo_ipes.png";

async function toBase64(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const absUrl = src.startsWith('http') ? src : `${window.location.origin}${src}`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 200;
      canvas.height = img.naturalHeight || 200;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = absUrl;
  });
}

/** HTML del encabezado institucional IPES — mismo formato que pdf_header.html */
export async function getIpesHeaderHtml(): Promise<string> {
  const [min, ipes] = await Promise.all([toBase64(logoMinisterio), toBase64(logoIpes)]);
  return `
    <div id="pdf-header-wrapper" style="width:100%; margin-bottom:15px; padding-bottom:10px; border-bottom:3px solid #c24b17;">
      <table style="width:100%; border-collapse:collapse; border:none;">
        <tr>
          <td style="width:140px; text-align:center; vertical-align:middle; padding:0; border:none;">
            <img src="${min}" style="height:90px; width:auto; display:block; margin:0 auto;" alt="Escudo Ministerio TDF">
          </td>
          <td style="text-align:center; vertical-align:middle; padding:0 15px; border:none;">
            <div style="font-family:'Helvetica','Arial',sans-serif; font-size:15pt; font-weight:bold; letter-spacing:1px; color:#000; margin-bottom:4px;">
              IPES PAULO FREIRE
            </div>
            <div style="font-family:'Helvetica','Arial',sans-serif; font-size:9pt; color:#333; letter-spacing:0.5px;">
              INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR
            </div>
          </td>
          <td style="width:140px; text-align:center; vertical-align:middle; padding:0; border:none;">
            <img src="${ipes}" style="height:90px; width:auto; display:block; margin:0 auto;" alt="Logo IPES">
          </td>
        </tr>
      </table>
    </div>
  `;
}

export const IPES_HEADER_CSS = ``;
