import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PedidoEquivalenciaDTO } from "@/api/estudiantes";

interface DocumentacionDialogProps {
  open: boolean;
  pedido?: PedidoEquivalenciaDTO;
  form: { presentada: boolean; cantidad: string; detalle: string };
  setForm: React.Dispatch<React.SetStateAction<{ presentada: boolean; cantidad: string; detalle: string }>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const DocumentacionDialog: React.FC<DocumentacionDialogProps> = ({
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
      <DialogTitle>Registro de documentación</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {pedido && (
            <Typography variant="body2" color="text.secondary">
              {pedido.estudiante_nombre} · DNI {pedido.estudiante_dni}
            </Typography>
          )}
          <FormControlLabel
            control={(
              <Checkbox
                checked={form.presentada}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, presentada: event.target.checked }))
                }
              />
            )}
            label="El/la estudiante presentó la documentación solicitada."
          />
          <TextField
            label="Cantidad de fojas"
            type="number"
            size="small"
            value={form.cantidad}
            onChange={(event) => setForm((prev) => ({ ...prev, cantidad: event.target.value }))}
            disabled={!form.presentada}
          />
          <TextField
            label="Detalle / Observaciones"
            multiline
            minRows={3}
            value={form.detalle}
            onChange={(event) => setForm((prev) => ({ ...prev, detalle: event.target.value }))}
            disabled={!form.presentada}
          />
          {!form.presentada && (
            <Alert severity="warning">
              Marque la casilla anterior cuando la documentación sea presentada. El pedido quedará pendiente de tutoría
              hasta que se adjunte el respaldo.
            </Alert>
          )}
        </Stack>
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

export default DocumentacionDialog;
