import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PedidoEquivalenciaDTO } from "@/api/estudiantes";

interface TitulosDialogProps {
  open: boolean;
  pedido?: PedidoEquivalenciaDTO;
  form: {
    nota_numero: string;
    nota_fecha: string;
    disposicion_numero: string;
    disposicion_fecha: string;
    observaciones: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    nota_numero: string;
    nota_fecha: string;
    disposicion_numero: string;
    disposicion_fecha: string;
    observaciones: string;
  }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const TitulosDialog: React.FC<TitulosDialogProps> = ({
  open,
  pedido,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Registro de Títulos</DialogTitle>
      <DialogContent dividers>
        {pedido ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {pedido.estudiante_nombre} · {pedido.profesorado_destino_nombre}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Número de nota"
                  value={form.nota_numero}
                  onChange={(event) => setForm((prev) => ({ ...prev, nota_numero: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fecha de nota"
                  type="date"
                  value={form.nota_fecha}
                  onChange={(event) => setForm((prev) => ({ ...prev, nota_fecha: event.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Número de disposición"
                  value={form.disposicion_numero}
                  onChange={(event) => setForm((prev) => ({ ...prev, disposicion_numero: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fecha de disposición"
                  type="date"
                  value={form.disposicion_fecha}
                  onChange={(event) => setForm((prev) => ({ ...prev, disposicion_fecha: event.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Observaciones"
              multiline
              minRows={3}
              value={form.observaciones}
              onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
            />
          </Stack>
        ) : (
          <Typography variant="body2">Seleccioná un pedido para completar los datos de Títulos.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TitulosDialog;
