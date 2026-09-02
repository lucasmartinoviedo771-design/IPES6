// src/main.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastBridge } from "@/utils/toast";
import App from "./App";
import "./styles/theme.css";

// MUI base (si usás Theme)
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

// ✅ Date pickers (ES)
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { theme } from "./theme";
import "dayjs/locale/es";

dayjs.extend(customParseFormat);
dayjs.locale("es");

import { SnackbarProvider } from "notistack";
import { ErrorBoundary } from "react-error-boundary";

window.addEventListener("error", (e) => {
	void 0;
});
window.addEventListener("unhandledrejection", (e) => {
	void 0;
});

// Auto-recuperación ante despliegues (ChunkLoadError / vite:preloadError)
window.addEventListener("vite:preloadError", (event) => {
	event.preventDefault();
	const lastReload = sessionStorage.getItem("last_chunk_preload_reload");
	const now = Date.now();
	// Evitar loop infinito: solo recargar si pasaron más de 8 segundos desde el último intento
	if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
		sessionStorage.setItem("last_chunk_preload_reload", String(now));
		window.location.reload();
	}
});

const qc = new QueryClient({
	defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ErrorBoundary
			fallback={
				<div style={{ padding: 16, background: "#fee", color: "#900" }}>
					Se rompió la UI
				</div>
			}
		>
			<BrowserRouter>
				<QueryClientProvider client={qc}>
					<AuthProvider>
						<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
							<ThemeProvider theme={theme}>
								<CssBaseline />
								<SnackbarProvider
									maxSnack={4}
									autoHideDuration={4000}
									anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
								>
									<ToastBridge />
									<App />
								</SnackbarProvider>
							</ThemeProvider>
						</LocalizationProvider>
					</AuthProvider>
				</QueryClientProvider>
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>,
);
