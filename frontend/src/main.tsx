// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "@/context/AuthContext";
import { ToastBridge } from "@/utils/toast";
import "./styles/theme.css";

// MUI base (si usás Theme)
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "./theme";

// ✅ Date pickers (ES)
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/es";
dayjs.extend(customParseFormat);
dayjs.locale("es");

import ErrorBoundary from "@/debug/ErrorBoundary";
import { SnackbarProvider } from "notistack";

window.addEventListener("error", (e) => {
  console.error("[window.onerror]", e.message, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
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
  </React.StrictMode>
);