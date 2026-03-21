import { useEffect } from "react";
import { FallbackProps } from "react-error-boundary";

function ErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(errorMessage);

  const key = "chunk_load_retries";
  const now = Date.now();
  const retryLimit = 2;
  const timeFrame = 60000; // 1 minuto

  const getRetries = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data.filter((t: number) => now - t < timeFrame) : [];
    } catch {
      return [];
    }
  };

  const retries = getRetries();
  const tooManyRetries = retries.length >= retryLimit;

  useEffect(() => {
    if (isChunkLoadError && !tooManyRetries) {
      const updatedRetries = [...retries, now];
      sessionStorage.setItem(key, JSON.stringify(updatedRetries));

      console.warn("Error de carga de chunk (" + (retries.length + 1) + "/" + retryLimit + "). Recargando...");
      const timer = setTimeout(() => {
        window.location.reload();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isChunkLoadError, tooManyRetries]);

  if (isChunkLoadError) {
    if (tooManyRetries) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif", color: "#d32f2f" }}>
          <h2>Error de conexión</h2>
          <p>
            No pudimos cargar la última versión del sistema después de varios intentos. 
            Esto puede deberse a un problema de conexión a internet o mantenimiento del servidor.
          </p>
          <button 
            type="button" 
            onClick={() => {
              sessionStorage.removeItem(key);
              window.location.reload();
            }}
            style={{ padding: "10px 20px", marginTop: "1rem", cursor: "pointer" }}
          >
            Reintentar manualmente
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Actualizando...</h2>
        <p>Estamos cargando la versión más reciente para evitar errores.</p>
        <div className="loader">Espere un momento...</div>
      </div>
    );
  }

  return (
    <div role="alert" style={{ padding: "2rem" }}>
      <p>Algo salió mal.</p>
      <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>{errorMessage}</pre>
      <button type="button" onClick={resetErrorBoundary}>
        Intentar de nuevo
      </button>
    </div>
  );
}

export default ErrorBoundaryFallback;
