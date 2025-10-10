// src/types.ts
export interface FormData {
  carrera: string;
  fotoPreview: string | null;
  fotoMetadata: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  } | null;
  aceptaPoliticas: boolean;
}
