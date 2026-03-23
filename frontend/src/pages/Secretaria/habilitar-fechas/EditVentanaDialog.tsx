import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";

import { Ventana } from "./constants";

type Props = {
  open: boolean;
  editVentana: Ventana | null;
  setEditVentana: React.Dispatch<React.SetStateAction<Ventana | null>>;
  onCancelar: () => void;
  onGuardar: () => void;
  onEliminar: (id?: number) => void;
};

const EditVentanaDialog: React.FC<Props> = ({
  open,
  editVentana,
  setEditVentana,
  onCancelar,
  onGuardar,
  onEliminar,
}) => {
  return (
    <Dialog open={open} onClose={onCancelar} maxWidth="xs" fullWidth>
      <DialogTitle>Editar ventana</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Tipo"
            fullWidth
            size="small"
            value={editVentana?.tipo ?? ""}
            onChange={(event) =>
              setEditVentana((prev) => (prev ? { ...prev, tipo: event.target.value } : prev))
            }
          />
          <TextField
            type="date"
            label="Desde"
            InputLabelProps={{ shrink: true }}
            fullWidth
            size="small"
            value={editVentana?.desde ?? ""}
            onChange={(event) =>
              setEditVentana((prev) => (prev ? { ...prev, desde: event.target.value } : prev))
            }
          />
          <TextField
            type="date"
            label="Hasta"
            InputLabelProps={{ shrink: true }}
            fullWidth
            size="small"
            value={editVentana?.hasta ?? ""}
            onChange={(event) =>
              setEditVentana((prev) => (prev ? { ...prev, hasta: event.target.value } : prev))
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!editVentana?.activo}
                onChange={(event) =>
                  setEditVentana((prev) => (prev ? { ...prev, activo: event.target.checked } : prev))
                }
              />
            }
            label={editVentana?.activo ? "Habilitado" : "Deshabilitado"}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button color="error" onClick={() => onEliminar(editVentana?.id)}>
          Eliminar
        </Button>
        <Button variant="contained" onClick={onGuardar}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditVentanaDialog;
