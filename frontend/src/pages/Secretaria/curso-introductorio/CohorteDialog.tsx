import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import { ProfesoradoDTO } from "@/api/cargaNotas";
import { TurnoDTO } from "@/api/comisiones";
import { VentanaDto } from "@/api/ventanas";
import { CohorteFormState } from "./types";

type Props = {
  open: boolean;
  editingCohorteId: number | null;
  cohorteForm: CohorteFormState;
  setCohorteForm: React.Dispatch<React.SetStateAction<CohorteFormState>>;
  cohorteAccionBloqueada: boolean;
  savingCohorte: boolean;
  creatingCohortesTurnos: boolean;
  profesorados: ProfesoradoDTO[];
  turnos: TurnoDTO[];
  ventanas: VentanaDto[];
  ventanasLoading: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
  onCrearTodosTurnos: () => void;
};

const CohorteDialog: React.FC<Props> = ({
  open,
  editingCohorteId,
  cohorteForm,
  setCohorteForm,
  cohorteAccionBloqueada,
  savingCohorte,
  creatingCohortesTurnos,
  profesorados,
  turnos,
  ventanas,
  ventanasLoading,
  onCancelar,
  onGuardar,
  onCrearTodosTurnos,
}) => {
  return (
    <Dialog open={open} onClose={onCancelar} fullWidth maxWidth="sm">
      <DialogTitle>{editingCohorteId ? "Editar cohorte" : "Nueva cohorte"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Nombre"
            value={cohorteForm.nombre}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, nombre: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Año académico"
            type="number"
            value={cohorteForm.anio_academico}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, anio_academico: event.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Profesorado"
            value={cohorteForm.profesorado_id}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, profesorado_id: event.target.value }))}
            fullWidth
          >
            <MenuItem value="">Todos</MenuItem>
            {profesorados.map((prof) => (
              <MenuItem key={prof.id} value={String(prof.id)}>
                {prof.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Turno"
            value={cohorteForm.turno_id}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, turno_id: event.target.value }))}
            fullWidth
          >
            <MenuItem value="">Sin turno fijo</MenuItem>
            {turnos.map((turno) => (
              <MenuItem key={turno.id} value={String(turno.id)}>
                {turno.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Ventana de inscripción"
            value={cohorteForm.ventana_id}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, ventana_id: event.target.value }))}
            fullWidth
            helperText="Seleccioná la ventana activa del Curso Introductorio."
            disabled={ventanasLoading}
          >
            <MenuItem value="">Sin ventana</MenuItem>
            {ventanas.map((ventana) => (
              <MenuItem key={ventana.id} value={String(ventana.id)}>
                {`${ventana.desde} - ${ventana.hasta}`}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Fecha inicio"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={cohorteForm.fecha_inicio}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Fecha fin"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={cohorteForm.fecha_fin}
              onChange={(event) => setCohorteForm((prev) => ({ ...prev, fecha_fin: event.target.value }))}
              fullWidth
            />
          </Stack>
          <TextField
            label="Cupo"
            type="number"
            value={cohorteForm.cupo}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, cupo: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Observaciones"
            value={cohorteForm.observaciones}
            onChange={(event) => setCohorteForm((prev) => ({ ...prev, observaciones: event.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>Cancelar</Button>
        {!editingCohorteId && (
          <Button onClick={onCrearTodosTurnos} disabled={cohorteAccionBloqueada}>
            {creatingCohortesTurnos ? "Creando..." : "Crear para todos los turnos"}
          </Button>
        )}
        <Button variant="contained" onClick={onGuardar} disabled={cohorteAccionBloqueada}>
          {savingCohorte ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CohorteDialog;
