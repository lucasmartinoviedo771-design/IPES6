import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MateriaEvaluada, STATUS_LABEL } from "./types";

interface MateriasHabilitadasPanelProps {
  habilitadasPorAnio: Array<{ anio: number; items: MateriaEvaluada[] }>;
  puedeInscribirse: boolean;
  mInscribirIsPending: boolean;
  pendingMateriaId: number | undefined;
  onInscribir: (materiaId: number) => void;
}

const MateriasHabilitadasPanel: React.FC<MateriasHabilitadasPanelProps> = ({
  habilitadasPorAnio,
  puedeInscribirse,
  mInscribirIsPending,
  pendingMateriaId,
  onInscribir,
}) => {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e3d7bc", bgcolor: "#fff" }}>
      <Typography variant="h6" fontWeight={700} gutterBottom color="primary.dark">
        Materias habilitadas para inscribirte
      </Typography>
      {habilitadasPorAnio.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No hay materias habilitadas que coincidan con los filtros seleccionados. Revisa correlatividades o estados administrativos.
        </Alert>
      ) : (
        <Stack spacing={3}>
          {habilitadasPorAnio.map(({ anio, items }) => (
            <Box key={anio}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                {anio}º año
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                {items.map((materia) => (
                  <Box
                    key={materia.id}
                    sx={{ p: 2.5, borderRadius: 2, border: "1px solid #d4c4a5", bgcolor: "#fefbf4", height: "100%" }}
                  >
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} height="100%">
                      <Box>
                        <Typography variant="h6">{materia.nombre}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {materia.cuatrimestre}
                        </Typography>
                        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                          <Chip size="small" color="success" label="Correlativas cumplidas" />
                          {materia.status === "habilitada" && <Chip size="small" color="primary" label={STATUS_LABEL[materia.status]} />}
                        </Stack>
                        {materia.motivos.length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block">
                              Habilitada por:
                            </Typography>
                            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                              {materia.motivos.map((motivo, idx) => (
                                <Typography key={idx} variant="caption" color="text.secondary" sx={{ display: "block", fontStyle: "italic" }}>
                                  • {motivo}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                      <Stack spacing={1} minWidth={240}>
                        <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#fff" }}>
                          <Typography variant="body2" fontWeight={600}>Horarios</Typography>
                          {materia.horarios.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">Sin horarios informados.</Typography>
                          ) : (
                            materia.horarios.map((h, idx) => (
                              <Typography key={idx} variant="body2" color="text.secondary">
                                {h.dia} {h.desde} - {h.hasta}
                              </Typography>
                            ))
                          )}
                          <Button
                            variant="contained"
                            size="small"
                            sx={{ mt: 1 }}
                            onClick={() => onInscribir(materia.id)}
                            disabled={
                              !puedeInscribirse ||
                              materia.status !== "habilitada" ||
                              (mInscribirIsPending && pendingMateriaId === materia.id)
                            }
                          >
                            Inscribirme
                          </Button>
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default MateriasHabilitadasPanel;
