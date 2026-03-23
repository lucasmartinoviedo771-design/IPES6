import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { TurnoDTO } from "@/api/comisiones";
import { CursoIntroPendienteDTO } from "@/api/cursoIntro";
import { InscribirFormState } from "./types";

type CohorteOption = { value: number; label: string };

type Props = {
  open: boolean;
  pendienteSeleccionado: CursoIntroPendienteDTO | null;
  inscribirForm: InscribirFormState;
  setInscribirForm: React.Dispatch<React.SetStateAction<InscribirFormState>>;
  inscribiendo: boolean;
  cohorteOptions: CohorteOption[];
  turnos: TurnoDTO[];
  onCancelar: () => void;
  onConfirmar: () => void;
};

const InscribirDialog: React.FC<Props> = ({
  open,
  pendienteSeleccionado,
  inscribirForm,
  setInscribirForm,
  inscribiendo,
  cohorteOptions,
  turnos,
  onCancelar,
  onConfirmar,
}) => {
  return (
    <Dialog open={open} onClose={onCancelar} fullWidth maxWidth="sm">
      <DialogTitle>Inscribir estudiante</DialogTitle>
      <DialogContent dividers>
        {pendienteSeleccionado ? (
          <Stack spacing={2}>
            <Alert severity="info">
              {pendienteSeleccionado.estudiante_nombre || "Sin nombre"} - DNI {pendienteSeleccionado.estudiante_dni}
            </Alert>
            <TextField
              select
              label="Cohorte"
              value={inscribirForm.cohorte_id}
              onChange={(event) => setInscribirForm((prev) => ({ ...prev, cohorte_id: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Seleccioná una cohorte</MenuItem>
              {cohorteOptions.map((option) => (
                <MenuItem key={option.value} value={String(option.value)}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Profesorado"
              value={inscribirForm.profesorado_id}
              onChange={(event) => setInscribirForm((prev) => ({ ...prev, profesorado_id: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Sin especificar</MenuItem>
              {pendienteSeleccionado.profesorados.map((prof, idx) => (
                <MenuItem key={`${prof.id || "none"}-${idx}`} value={prof.id ? String(prof.id) : ""}>
                  {prof.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Turno"
              value={inscribirForm.turno_id}
              onChange={(event) => setInscribirForm((prev) => ({ ...prev, turno_id: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Sin especificar</MenuItem>
              {turnos.map((turno) => (
                <MenuItem key={turno.id} value={String(turno.id)}>
                  {turno.nombre}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ) : (
          <Alert severity="warning">Seleccioná un estudiante.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button variant="contained" onClick={onConfirmar} disabled={inscribiendo}>
          {inscribiendo ? "Inscribiendo..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InscribirDialog;
