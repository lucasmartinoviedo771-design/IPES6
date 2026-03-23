import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { CierreFormState, RESULTADO_OPTIONS } from "./types";

type Props = {
  open: boolean;
  cierreForm: CierreFormState;
  setCierreForm: React.Dispatch<React.SetStateAction<CierreFormState>>;
  guardandoCierre: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
};

const CierreDialog: React.FC<Props> = ({
  open,
  cierreForm,
  setCierreForm,
  guardandoCierre,
  onCancelar,
  onGuardar,
}) => {
  return (
    <Dialog open={open} onClose={onCancelar} fullWidth maxWidth="sm">
      <DialogTitle>Registrar resultado</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Nota final"
            type="number"
            inputProps={{ min: 1, max: 10, step: 0.1 }}
            helperText="Valor entre 1 y 10"
            value={cierreForm.nota_final}
            onChange={(event) => setCierreForm((prev) => ({ ...prev, nota_final: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Asistencias"
            type="number"
            inputProps={{ min: 0, max: 100, step: 1 }}
            helperText="Porcentaje entre 0 y 100"
            value={cierreForm.asistencias_totales}
            onChange={(event) => setCierreForm((prev) => ({ ...prev, asistencias_totales: event.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Resultado"
            value={cierreForm.resultado}
            onChange={(event) => setCierreForm((prev) => ({ ...prev, resultado: event.target.value }))}
            fullWidth
          >
            {RESULTADO_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Observaciones"
            value={cierreForm.observaciones}
            onChange={(event) => setCierreForm((prev) => ({ ...prev, observaciones: event.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button variant="contained" onClick={onGuardar} disabled={guardandoCierre}>
          {guardandoCierre ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CierreDialog;
