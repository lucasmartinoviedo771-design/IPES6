import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { PreinscripcionDTO } from "@/api/preinscripciones";

export function EstadoChip({ estado }: { estado: PreinscripcionDTO["estado"] }) {
  const map: Record<string, "default" | "success" | "warning" | "error"> = {
    enviada: "default", observada: "warning", confirmada: "success", rechazada: "error", borrador: "default",
  };
  return <Chip label={estado} color={map[estado] ?? "default"} size="small" sx={{ borderRadius: 2, textTransform: "capitalize" }} />;
}

export function FotoPreviewBox({ dataUrl }: { dataUrl?: string }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [dataUrl]);
  return (
    <Box sx={{ mt: 1, width: 100, height: 120, overflow: 'hidden', border: '1px solid #ddd', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fafafa' }}>
      {dataUrl && !error ? (
        <img src={String(dataUrl)} alt="Foto 4x4" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>{error ? 'Error al cargar foto' : 'Sin foto 4x4'}</Typography>
      )}
    </Box>
  );
}
