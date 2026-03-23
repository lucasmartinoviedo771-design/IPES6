import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PedidoEquivalenciaDTO } from "@/api/estudiantes";

interface EvaluacionDialogProps {
  open: boolean;
  pedido?: PedidoEquivalenciaDTO;
  evaluacionForm: Array<{ id: number; resultado: "otorgada" | "rechazada"; observaciones: string }>;
  setEvaluacionForm: React.Dispatch<React.SetStateAction<Array<{ id: number; resultado: "otorgada" | "rechazada"; observaciones: string }>>>;
  evaluacionObservaciones: string;
  setEvaluacionObservaciones: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const EvaluacionDialog: React.FC<EvaluacionDialogProps> = ({
  open,
  pedido,
  evaluacionForm,
  setEvaluacionForm,
  evaluacionObservaciones,
  setEvaluacionObservaciones,
  saving,
  onClose,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Evaluación del pedido</DialogTitle>
      <DialogContent dividers>
        {pedido ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {pedido.estudiante_nombre} · {pedido.profesorado_destino_nombre}
            </Typography>
            {(pedido.materias || []).map((materia) => {
              const formEntry = evaluacionForm.find((item) => item.id === materia.id) || {
                id: materia.id,
                resultado: "otorgada" as const,
                observaciones: "",
              };
              return (
                <Box
                  key={materia.id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle2">{materia.nombre}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1 }}>
                    <TextField
                      select
                      label="Resultado"
                      value={formEntry.resultado}
                      onChange={(event) =>
                        setEvaluacionForm((prev) =>
                          prev.map((entry) =>
                            entry.id === materia.id
                              ? { ...entry, resultado: event.target.value as "otorgada" | "rechazada" }
                              : entry,
                          ),
                        )
                      }
                      size="small"
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="otorgada">Otorgada</MenuItem>
                      <MenuItem value="rechazada">Rechazada</MenuItem>
                    </TextField>
                    <TextField
                      label="Observaciones"
                      value={formEntry.observaciones}
                      onChange={(event) =>
                        setEvaluacionForm((prev) =>
                          prev.map((entry) =>
                            entry.id === materia.id ? { ...entry, observaciones: event.target.value } : entry,
                          ),
                        )
                      }
                      fullWidth
                    />
                  </Stack>
                </Box>
              );
            })}
            <TextField
              label="Observaciones generales"
              multiline
              minRows={3}
              value={evaluacionObservaciones}
              onChange={(event) => setEvaluacionObservaciones(event.target.value)}
            />
          </Stack>
        ) : (
          <Typography variant="body2">Seleccioná un pedido para poder evaluarlo.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={saving}>
          {saving ? "Guardando..." : "Guardar evaluación"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EvaluacionDialog;
