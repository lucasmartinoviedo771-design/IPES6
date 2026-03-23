import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Materia } from "./types";
import { MateriaInscriptaItemDTO } from "@/api/estudiantes";

interface InscriptaDetalle {
  materia: Materia;
  inscripcion: MateriaInscriptaItemDTO | null;
}

interface MateriasInscriptasPanelProps {
  inscriptasDetalle: InscriptaDetalle[];
  ventanaActiva: boolean;
  mCancelarIsPending: boolean;
  cancelarVars: { inscripcionId: number; materiaId: number } | undefined;
  onCancelar: (materiaId: number, inscripcionId?: number | null) => void;
}

const MateriasInscriptasPanel: React.FC<MateriasInscriptasPanelProps> = ({
  inscriptasDetalle,
  ventanaActiva,
  mCancelarIsPending,
  cancelarVars,
  onCancelar,
}) => {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #d8ccb0", bgcolor: "#fff" }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Materias ya inscriptas en esta ventana
      </Typography>
      {inscriptasDetalle.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todavía no tenés inscripciones registradas.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {inscriptasDetalle.map(({ materia, inscripcion }) => {
            const canceling = inscripcion ? (cancelarVars?.inscripcionId === inscripcion.inscripcion_id && mCancelarIsPending) : false;
            return (
              <Box key={materia.id} sx={{ p: 2, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#f7f1df" }}>
                <Typography fontWeight={600}>{materia.nombre}</Typography>
                {materia.horarios.length > 0 ? (
                  materia.horarios.map((h, idx) => (
                    <Typography key={idx} variant="body2" color="text.secondary">
                      {h.dia} {h.desde} - {h.hasta}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">Horario no informado.</Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip label="Inscripta" color="success" size="small" />
                  {ventanaActiva && inscripcion && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={canceling}
                      onClick={() => onCancelar(materia.id, inscripcion.inscripcion_id)}
                    >
                      Cancelar inscripción
                    </Button>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
};

export default MateriasInscriptasPanel;
