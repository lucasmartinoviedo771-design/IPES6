import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { MesaResumenDTO } from "@/api/cargaNotas";
import { DOCENTE_ROL_LABEL } from './constants';
import { getMesaTipoNombre } from './utils';

interface BuscarMesaSectionProps {
  mesaCodigo: string;
  setMesaCodigo: (v: string) => void;
  mesaBuscando: boolean;
  mesaBusquedaError: string | null;
  mesaSeleccionada: MesaResumenDTO | null;
  onBuscar: () => void;
}

export function BuscarMesaSection({
  mesaCodigo,
  setMesaCodigo,
  mesaBuscando,
  mesaBusquedaError,
  mesaSeleccionada,
  onBuscar,
}: BuscarMesaSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
        Asociar una mesa
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Código de mesa (opcional)"
          size="small"
          value={mesaCodigo}
          onChange={(event) => setMesaCodigo(event.target.value)}
          placeholder="Ej: MESA-20251112-00010"
          fullWidth
        />
        <Button
          variant="contained"
          onClick={onBuscar}
          disabled={mesaBuscando}
          startIcon={mesaBuscando ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
        >
          {mesaBuscando ? "Buscando..." : "Buscar"}
        </Button>
      </Stack>
      {mesaBusquedaError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {mesaBusquedaError}
        </Alert>
      )}
      {mesaSeleccionada && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              <strong>Código:</strong> {mesaSeleccionada.codigo || mesaSeleccionada.id} - {mesaSeleccionada.materia_nombre}
            </Typography>
            <Typography variant="body2">
              <strong>Tipo:</strong> {getMesaTipoNombre(mesaSeleccionada.tipo)} | <strong>Modalidad:</strong>{" "}
              {mesaSeleccionada.modalidad === "LIB" ? "Libre" : "Regular"}
            </Typography>
            {mesaSeleccionada.docentes && mesaSeleccionada.docentes.length ? (
              <Typography variant="body2">
                <strong>Tribunal:</strong>{" "}
                {mesaSeleccionada.docentes
                  .map((doc) => `${DOCENTE_ROL_LABEL[doc.rol] ?? doc.rol}: ${doc.nombre || "Sin asignar"}`)
                  .join(" | ")}
              </Typography>
            ) : (
              <Typography variant="body2">Tribunal sin designar.</Typography>
            )}
          </Stack>
        </Alert>
      )}
    </Paper>
  );
}
