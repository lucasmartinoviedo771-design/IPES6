import React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import { MesaResumenDTO } from "@/api/cargaNotas";
import { FinalFiltersState } from "../types";

type Props = {
  finalMesas: MesaResumenDTO[];
  finalSelectedMesaId: number | null;
  finalLoadingMesas: boolean;
  finalLoadingPlanilla: boolean;
  estadoPlanilla: FinalFiltersState["estadoPlanilla"];
  onOpenFinalPlanilla: (mesaId: number) => void;
};

const FinalExamMesasGrid: React.FC<Props> = ({
  finalMesas,
  finalSelectedMesaId,
  finalLoadingMesas,
  finalLoadingPlanilla,
  estadoPlanilla,
  onOpenFinalPlanilla,
}) => {
  return (
    <Grid container spacing={1.5}>
      {finalLoadingMesas ? (
        <Grid item xs={12}>
          <Stack alignItems="center" py={4}>
            <CircularProgress size={32} />
          </Stack>
        </Grid>
      ) : finalMesas.length ? (
        finalMesas
          .filter((mesa: any) => {
            if (estadoPlanilla === "ABIERTAS") return !mesa.esta_cerrada;
            if (estadoPlanilla === "CERRADAS") return mesa.esta_cerrada;
            return true;
          })
          .map((mesa: any) => {
          const fecha = mesa.fecha ? mesa.fecha.split("-").reverse().join("/") : "-";
          const horaDesde = mesa.hora_desde ? mesa.hora_desde.slice(0, 5) : "";
          const horaHasta = mesa.hora_hasta ? mesa.hora_hasta.slice(0, 5) : "";
          const isSelected = mesa.id === finalSelectedMesaId;
          return (
            <Grid item xs={12} md={6} lg={4} key={mesa.id}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderColor: isSelected ? "primary.main" : "divider",
                  borderWidth: isSelected ? 2 : 1,
                }}
              >
                <Stack gap={0.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="subtitle2" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                      {mesa.materia_nombre} (#{mesa.materia_id})
                    </Typography>
                    {mesa.esta_cerrada ? (
                      <Chip
                        icon={<LockIcon style={{ fontSize: 14 }} />}
                        label="CERRADA"
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, ml: 1, backgroundColor: "#f5f5f5" }}
                      />
                    ) : (
                      <Chip
                        icon={<EditIcon style={{ fontSize: 14 }} />}
                        label="EDICIÓN ACTIVA"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, ml: 1 }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {mesa.profesorado_nombre ?? "Sin profesorado"} | Plan {mesa.plan_resolucion ?? "-"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fecha} {horaDesde}
                    {horaHasta ? ` - ${horaHasta}` : ""} | {mesa.modalidad === "LIB" ? "Libre" : "Regular"} | {mesa.tipo === "FIN" ? "Ordinaria" : mesa.tipo === "EXT" ? "Extraordinaria" : "Especial"}
                  </Typography>
                  <Stack direction="row" gap={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color={mesa.esta_cerrada ? "primary" : "success"}
                      onClick={() => onOpenFinalPlanilla(mesa.id)}
                      disabled={finalLoadingPlanilla && isSelected}
                    >
                      Ver planilla
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          );
        })
      ) : (
        <Grid item xs={12}>
          <Alert severity="info">
            No se encontraron mesas que coincidan con los filtros seleccionados.
          </Alert>
        </Grid>
      )}
    </Grid>
  );
};

export default FinalExamMesasGrid;
