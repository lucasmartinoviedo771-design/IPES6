import { FallbackProps } from "react-error-boundary";

function ErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" style={{ padding: "2rem" }}>
      <p>Algo salió mal.</p>
      <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>{error.message}</pre>
      <button type="button" onClick={resetErrorBoundary}>
        Intentar de nuevo
      </button>
    </div>
  );
}

export default ErrorBoundaryFallback;
