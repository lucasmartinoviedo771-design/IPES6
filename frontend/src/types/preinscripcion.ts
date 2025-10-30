export type Carrera = {
  id: number;
  nombre: string;
  [key: string]: unknown;
};

export type PreinscripcionOut = {
  id: number;
  codigo: string;
  estado: "Enviada" | "Observada" | "Confirmada" | "Rechazada" | "Borrador";
};
