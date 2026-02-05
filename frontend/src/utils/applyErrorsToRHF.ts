import { FieldValues, UseFormSetError } from "react-hook-form";

/**
 * Aplica errores normalizados (path: "estudiante.email") a RHF.
 * Ignora paths vacíos. Usa "root" para errores generales.
 */
export function applyErrorsToRHF<TFieldValues extends FieldValues>(
  fieldErrors: { path: string; message: string }[],
  setError: UseFormSetError<TFieldValues>
) {
  if (!Array.isArray(fieldErrors)) return;

  let anyField = false;
  for (const fe of fieldErrors) {
    const path = (fe.path || "").replace(/(\[(\d+)\])/g, ".$2"); // foo[0].bar -> foo.0.bar
    if (path) {
      // @ts-expect-error dynamic path
      setError(path, { type: "server", message: fe.message });
      anyField = true;
    }
  }
  return anyField;
}
