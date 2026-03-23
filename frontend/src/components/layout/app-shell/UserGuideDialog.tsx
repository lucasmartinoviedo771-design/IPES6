import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import UserGuideDisplay from "../../guia/UserGuideDisplay";

interface UserGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export const UserGuideDialog: React.FC<UserGuideDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Guía de Usuario</DialogTitle>
      <DialogContent>
        <UserGuideDisplay />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};
