import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { type Carrera } from "@/api/carreras";

interface AddCarreraDialogProps {
  open: boolean;
  onClose: () => void;
  availableCarreras: Carrera[];
  nuevaCarreraId: number | '';
  setNuevaCarreraId: (v: number | '') => void;
  nuevaCarreraCohorte: string;
  setNuevaCarreraCohorte: (v: string) => void;
  onAgregar: () => void;
  isPending: boolean;
}

export default function AddCarreraDialog({
  open, onClose, availableCarreras, nuevaCarreraId, setNuevaCarreraId,
  nuevaCarreraCohorte, setNuevaCarreraCohorte, onAgregar, isPending,
}: AddCarreraDialogProps) {
  return (
    <Dialog open={open} onClose={() => !isPending && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Agregar nuevo profesorado</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <TextField select label="Profesorado" fullWidth size="small" value={nuevaCarreraId} onChange={(e) => setNuevaCarreraId(Number(e.target.value))}>
            {availableCarreras.map((c: Carrera) => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
          </TextField>
          <TextField label="Cohorte" type="number" size="small" value={nuevaCarreraCohorte} onChange={(e) => setNuevaCarreraCohorte(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={onAgregar} disabled={isPending}>Agregar</Button>
      </DialogActions>
    </Dialog>
  );
}
