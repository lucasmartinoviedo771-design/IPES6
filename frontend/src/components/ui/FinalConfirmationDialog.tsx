import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

type FinalConfirmationDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  contextText?: string;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: "primary" | "secondary" | "error" | "info" | "success" | "warning";
};

/**
 * Diálogo genérico para confirmar operaciones críticas antes de persistir los cambios.
 */
const FinalConfirmationDialog: React.FC<FinalConfirmationDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  contextText = "Cambios",
  loading = false,
  confirmLabel = "Confirmar y Guardar",
  cancelLabel = "Cancelar",
  confirmColor = "primary",
}) => {
  const description = `Al confirmar, se guardarán de forma definitiva los ${contextText} que has ingresado. Tenga en cuenta que esta acción es irreversible.`;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      aria-labelledby="final-confirmation-dialog-title"
    >
      <DialogTitle id="final-confirmation-dialog-title">Confirmación Final de Datos</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={loading} color="inherit">
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={loading} color={confirmColor}>
          {loading ? "Guardando..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FinalConfirmationDialog;
