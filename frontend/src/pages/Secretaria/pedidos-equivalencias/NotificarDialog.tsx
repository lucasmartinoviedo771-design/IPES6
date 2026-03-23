import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PedidoEquivalenciaDTO } from "@/api/estudiantes";

interface NotificarDialogProps {
  open: boolean;
  pedido?: PedidoEquivalenciaDTO;
  mensaje: string;
  setMensaje: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const NotificarDialog: React.FC<NotificarDialogProps> = ({
  open,
  pedido,
  mensaje,
  setMensaje,
  saving,
  onClose,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Notificar al estudiante</DialogTitle>
      <DialogContent dividers>
        {pedido ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {pedido.estudiante_nombre} · {pedido.profesorado_destino_nombre}
            </Typography>
            <Alert severity="info">
              Este mensaje se adjuntará al correo de notificación. Podés dejarlo en blanco para utilizar el mensaje
              institucional por defecto.
            </Alert>
            <TextField
              label="Mensaje opcional"
              multiline
              minRows={4}
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value)}
            />
          </Stack>
        ) : (
          <Typography variant="body2">Seleccioná un pedido que se encuentre listo para notificar.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={saving}>
          {saving ? "Notificando..." : "Enviar notificación"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificarDialog;
