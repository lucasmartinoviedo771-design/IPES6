import { useSnackbar, type VariantType } from "notistack";
import { useEffect } from "react";

type ToastMsg = { message: string; variant?: VariantType };
const listeners: Array<(t: ToastMsg) => void> = [];

const recentErrors = new Map<string, number>();
const DEDUP_MS = 1500;

function deduped(
	message: string,
	variant: VariantType,
	fn: (t: ToastMsg) => void,
) {
	if (variant === "error") {
		const now = Date.now();
		const last = recentErrors.get(message);
		if (last && now - last < DEDUP_MS) return;
		recentErrors.set(message, now);
	}
	fn({ message, variant });
}

/** API global para disparar toasts desde cualquier parte (servicios, interceptores, etc.) */
// eslint-disable-next-line react-refresh/only-export-components
export const toast = {
	success: (message: string) =>
		listeners.forEach((l) => l({ message, variant: "success" })),
	error: (message: string) =>
		listeners.forEach((l) => deduped(message, "error", l)),
	info: (message: string) =>
		listeners.forEach((l) => l({ message, variant: "info" })),
	warning: (message: string) =>
		listeners.forEach((l) => l({ message, variant: "warning" })),
};

/** Montar UNA vez dentro de <SnackbarProvider>. */
export function ToastBridge() {
	const { enqueueSnackbar } = useSnackbar();
	useEffect(() => {
		const handler = (t: ToastMsg) =>
			enqueueSnackbar(t.message, { variant: t.variant });
		listeners.push(handler);
		return () => {
			const i = listeners.indexOf(handler);
			if (i >= 0) listeners.splice(i, 1);
		};
	}, [enqueueSnackbar]);
	return null;
}
