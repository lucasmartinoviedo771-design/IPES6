import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

type Props = {
  open: boolean;
  asistenciaValor: string;
  guardandoAsistencia: boolean;
  onChangeAsistencia: (value: string) => void;
  onCancelar: () => void;
  onGuardar: () => void;
};

const AsistenciaDialog: React.FC<Props> = ({
  open,
  asistenciaValor,
  guardandoAsistencia,
  onChangeAsistencia,
  onCancelar,
  onGuardar,
}) => {
  return (
    <Dialog open={open} onClose={onCancelar} fullWidth maxWidth="xs">
      <DialogTitle>Actualizar asistencia</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Asistencias registradas"
          type="number"
          inputProps={{ min: 0, max: 100, step: 1 }}
          helperText="Porcentaje entre 0 y 100"
          value={asistenciaValor}
          onChange={(event) => onChangeAsistencia(event.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button variant="contained" onClick={onGuardar} disabled={guardandoAsistencia}>
          {guardandoAsistencia ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AsistenciaDialog;
