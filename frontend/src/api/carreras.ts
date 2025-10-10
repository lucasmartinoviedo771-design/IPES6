import { API_BASE } from "./config"; // Asegúrate de que config.ts exporte API_BASE

interface Carrera {
  id: number;
  nombre: string;
  activo: boolean;
  inscripcion_abierta: boolean;
}

export async function fetchCarreras(): Promise<Carrera[]> {
  const res = await fetch(`${API_BASE}/carreras?vigentes=true`, { credentials: 'include' });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`No se pudieron cargar las carreras: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}