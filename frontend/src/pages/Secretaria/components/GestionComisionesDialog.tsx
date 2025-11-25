import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import {
  listarComisionesGestion,
  crearComisionMasiva,
  distribuirAlumnos,
  type ComisionGestionDTO,
} from "@/api/gestionComisiones";
import { useSnackbar } from "notistack";

interface Props {
  open: boolean;
  onClose: () => void;
  materiaId: number;
  anioLectivo: number;
  materiaNombre: string;
  planId: number;
  anioCursada: number;
}

export default function GestionComisionesDialog({ open, onClose, materiaId, anioLectivo, materiaNombre, planId, anioCursada }: Props) {
  const [comisiones, setComisiones] = useState<ComisionGestionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCodigo, setNewCodigo] = useState("B");
  const { enqueueSnackbar } = useSnackbar();

  const loadComisiones = async () => {
    setLoading(true);
    try {
      const data = await listarComisionesGestion(materiaId, anioLectivo);
      setComisiones(data);
      // Suggest next code
      if (data.length > 0) {
        const lastCode = data[data.length - 1].codigo;
        // Simple logic to increment letter
        if (lastCode.length === 1 && lastCode >= 'A' && lastCode < 'Z') {
            setNewCodigo(String.fromCharCode(lastCode.charCodeAt(0) + 1));
        }
      } else {
          setNewCodigo("A");
      }
    } catch (error) {
      enqueueSnackbar("Error al cargar comisiones", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadComisiones();
    }
  }, [open, materiaId, anioLectivo]);

  const handleCreate = async () => {
    if (!confirm(`¿Estás seguro de crear la comisión "${newCodigo}" para TODAS las materias de ${anioCursada}º Año?`)) return;
    setCreating(true);
    try {
      const res = await crearComisionMasiva(planId, anioCursada, anioLectivo, newCodigo);
      enqueueSnackbar(res.message, { variant: "success" });
      await loadComisiones();
    } catch (error) {
      enqueueSnackbar("Error al crear comisiones", { variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDistribute = async (origenId: number, destinoId: number) => {
    if (!confirm("¿Estás seguro de mover aleatoriamente el 50% de los alumnos de ESTA materia?")) return;
    try {
      await distribuirAlumnos(origenId, destinoId, 50);
      enqueueSnackbar("Alumnos distribuidos", { variant: "success" });
      loadComisiones();
    } catch (error) {
      enqueueSnackbar("Error al distribuir alumnos", { variant: "error" });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Gestión de Comisiones: {materiaNombre}</DialogTitle>
      <DialogContent>
        <Box mb={2}>
            <Typography variant="body2" color="textSecondary">
                Año Lectivo: {anioLectivo} - Cursada: {anioCursada}º Año
            </Typography>
            <Alert severity="warning" sx={{ mt: 1 }}>
                Atención: Al crear una nueva comisión, se aplicará a <strong>TODAS</strong> las materias de {anioCursada}º Año.
                Recuerde que esto generará la necesidad de cargar horarios para las nuevas comisiones.
            </Alert>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {comisiones.map((c) => (
              <ListItem key={c.id} divider>
                <ListItemText
                  primary={`Comisión ${c.codigo}`}
                  secondary={`${c.cantidad_inscriptos} inscriptos - Turno: ${c.turno_nombre}`}
                />
              </ListItem>
            ))}
            {comisiones.length === 0 && (
                <Alert severity="info">No hay comisiones creadas para este año.</Alert>
            )}
          </List>
        )}

        <Box mt={3} display="flex" gap={2} alignItems="center">
            <TextField 
                label="Código Nueva Comisión" 
                size="small" 
                value={newCodigo} 
                onChange={(e) => setNewCodigo(e.target.value)}
                sx={{ width: 150 }}
            />
            <Button 
                variant="contained" 
                startIcon={<AddIcon />} 
                onClick={handleCreate}
                disabled={creating || loading}
            >
                Crear para todo {anioCursada}º Año
            </Button>
        </Box>
        
        {comisiones.length >= 2 && (
            <Box mt={3} p={2} bgcolor="grey.100" borderRadius={1}>
                <Typography variant="subtitle2" gutterBottom>Herramientas de Distribución</Typography>
                <Typography variant="caption" display="block" mb={1}>
                    Mover 50% de alumnos de la primera a la última comisión creada.
                </Typography>
                <Button 
                    variant="outlined" 
                    color="warning" 
                    startIcon={<ShuffleIcon />}
                    onClick={() => handleDistribute(comisiones[0].id, comisiones[comisiones.length-1].id)}
                    disabled={comisiones[0].cantidad_inscriptos === 0}
                >
                    Redistribuir (50%)
                </Button>
            </Box>
        )}

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
