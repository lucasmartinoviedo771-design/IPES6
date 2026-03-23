export const ESTADOS = [
  { value: "draft", label: "Borrador" },
  { value: "final", label: "Finalizado" },
];

export const WORKFLOW_ESTADOS = [
  { value: "", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "pending_docs", label: "Pendiente de documentación" },
  { value: "review", label: "En evaluación" },
  { value: "titulos", label: "En Títulos" },
  { value: "notified", label: "Notificado" },
];

export type EstadoFiltro = "" | "draft" | "final";

export const WORKFLOW_CHIP_COLOR: Record<string, "default" | "warning" | "info" | "secondary" | "success"> = {
  draft: "default",
  pending_docs: "warning",
  review: "info",
  titulos: "secondary",
  notified: "success",
};

export type ResultadoFinal = "pendiente" | "otorgada" | "denegada" | "mixta";

export const RESULTADO_LABEL: Record<ResultadoFinal, string> = {
  pendiente: "Evaluación pendiente",
  otorgada: "Equivalencia otorgada",
  denegada: "Equivalencia denegada",
  mixta: "Resultado mixto",
};

export const RESULTADO_COLOR: Record<ResultadoFinal, "default" | "success" | "error" | "warning"> = {
  pendiente: "default",
  otorgada: "success",
  denegada: "error",
  mixta: "warning",
};

export const formatFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
};
