export const digitsOnly = (v: unknown): string =>
  (typeof v === "string" ? v : String(v ?? "")).replace(/\D+/g, "");
