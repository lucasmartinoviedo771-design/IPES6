import React from "react";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ComisionOptionDTO } from "@/api/cargaNotas";
import { FiltersState, cuatrimestreLabel } from "../types";

type Props = {
  filteredComisiones: ComisionOptionDTO[];
  selectedComisionId: number | null;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
};

const RegularidadComisionesGrid: React.FC<Props> = ({
  filteredComisiones,
  selectedComisionId,
  setFilters,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight={700}>
          Comisiones disponibles
        </Typography>
        {!filteredComisiones.length ? (
          <Alert severity="info">
            No encontramos comisiones para la selección realizada.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {filteredComisiones.map((com) => {
              const cuatri = com.cuatrimestre ?? "ANU";
              const isSelected = selectedComisionId === com.id;
              return (
                <Grid item xs={12} md={6} lg={4} key={com.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderColor: isSelected ? "primary.main" : "divider",
                      boxShadow: isSelected ? "0 0 0 2px rgba(25,118,210,0.15)" : "none",
                      transition: "border-color .15s ease, box-shadow .15s ease",
                    }}
                  >
                    <CardActionArea
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          comisionId: com.id,
                        }))
                      }
                      sx={{ height: "100%" }}
                    >
                      <CardContent>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2" fontWeight={700}>
                            Comisión {com.codigo}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {com.materia_nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Año {com.anio ?? "-"} · {cuatrimestreLabel[cuatri] ?? cuatri}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Turno {com.turno || "Sin turno"}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Stack>
    </Paper>
  );
};

export default RegularidadComisionesGrid;
