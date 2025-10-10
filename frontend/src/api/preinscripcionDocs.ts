import api from "@/api/client";

export type DocItem = {
  id: number;
  tipo: string;
  nombre_original: string;
  tamano: number;
  content_type: string;
  url: string | null;
  creado_en: string;
};

export const listarDocumentos = (pid: number, q?: string) =>
  api.get(`/preinscripciones/${pid}/documentos`, { params: { q } }).then(r => r.data);

export const subirDocumento = (pid: number, tipo: string, file: File, onProgress?: (p: number)=>void) => {
  const form = new FormData();
  form.append("tipo", tipo);
  form.append("file", file);
  return api.post(`/preinscripciones/${pid}/documentos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (!onProgress) return;
      const p = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
      onProgress(p);
    },
  }).then(r => r.data);
};

export const borrarDocumento = (pid: number, docId: number) =>
  api.delete(`/preinscripciones/${pid}/documentos/${docId}`).then(r => r.data);

export const descargarDocumento = (pid: number, docId: number) =>
  window.open(`${import.meta.env.VITE_API_BASE}/preinscripciones/${pid}/documentos/${docId}/download`, "_blank");
