export type Option = { id: number; label: string };
export type DateOption = { id: string; label: string };

export const ordenarPorLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
