import { useEffect } from "react";
import { useSnackbar, VariantType } from "notistack";

type ToastMsg = { message: string; variant?: VariantType };
const listeners: Array<(t: ToastMsg) => void> = [];

/** API global para disparar toasts desde cualquier parte (servicios, interceptores, etc.) */
export const toast = {
  success: (message: string) => listeners.forEach(l => l({ message, variant: "success" })),
  error:   (message: string) => listeners.forEach(l => l({ message, variant: "error" })),
  info:    (message: string) => listeners.forEach(l => l({ message, variant: "info" })),
  warning: (message: string) => listeners.forEach(l => l({ message, variant: "warning" })),
};

/** Montar UNA vez dentro de <SnackbarProvider>. */
export function ToastBridge() {
  const { enqueueSnackbar } = useSnackbar();
  useEffect(() => {
    const handler = (t: ToastMsg) => enqueueSnackbar(t.message, { variant: t.variant });
    listeners.push(handler);
    return () => {
      const i = listeners.indexOf(handler);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, [enqueueSnackbar]);
  return null;
}