import React from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SchoolIcon from "@mui/icons-material/School";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { EstudianteClaseListado } from "@/api/asistencia";
import { Option } from "./types";

dayjs.locale("es");

interface EstudiantesPanelProps {
  puedeGestionarEstudiantes: boolean;
  puedeVerEstudiantes: boolean;
  profesoradoOptions: Option[];
  profesoradosLoading: boolean;
  estudianteProfesorado: Option | null;
  setEstudianteProfesorado: (v: Option | null) => void;
  estudiantePlan: Option | null;
  setEstudiantePlan: (v: Option | null) => void;
  estudianteMateria: Option | null;
  setEstudianteMateria: (v: Option | null) => void;
  estudianteComision: Option | null;
  setEstudianteComision: (v: Option | null) => void;
  estudianteDesde: string;
  setEstudianteDesde: (v: string) => void;
  estudianteHasta: string;
  setEstudianteHasta: (v: string) => void;
  estudianteResultados: EstudianteClaseListado[];
  cargandoEstudiantes: boolean;
  estudiantePlanOptions: Option[];
  estudiantePlanesLoading: boolean;
  estudianteMateriaOptions: Option[];
  estudianteMateriasLoading: boolean;
  estudianteComisionOptions: Option[];
  estudianteComisionesLoading: boolean;
  handleBuscarEstudiantes: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const EstudiantesPanel: React.FC<EstudiantesPanelProps> = ({
  puedeGestionarEstudiantes,
  puedeVerEstudiantes,
  profesoradoOptions,
  profesoradosLoading,
  estudianteProfesorado,
  setEstudianteProfesorado,
  estudiantePlan,
  setEstudiantePlan,
  estudianteMateria,
  setEstudianteMateria,
  estudianteComision,
  setEstudianteComision,
  estudianteDesde,
  setEstudianteDesde,
  estudianteHasta,
  setEstudianteHasta,
  estudianteResultados,
  cargandoEstudiantes,
  estudiantePlanOptions,
  estudiantePlanesLoading,
  estudianteMateriaOptions,
  estudianteMateriasLoading,
  estudianteComisionOptions,
  estudianteComisionesLoading,
  handleBuscarEstudiantes,
}) => {
  return (
    <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
      <Stack spacing={2} height="100%">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            icon={<SchoolIcon />}
            label="Estudiantes"
            sx={{
              fontWeight: 600,
              bgcolor: "primary.main",
              color: "common.white",
              "& .MuiChip-icon": { color: "common.white !important" },
            }}
          />
          <Chip
            icon={<ManageAccountsIcon />}
            label={puedeGestionarEstudiantes ? "Gestion habilitada" : "Gestion restringida"}
            color={puedeGestionarEstudiantes ? "success" : "default"}
            variant={puedeGestionarEstudiantes ? "filled" : "outlined"}
            sx={{
              "& .MuiChip-icon": {
                color: "common.white !important",
              },
            }}
          />
          <Chip
            icon={<VisibilityIcon />}
            label={puedeVerEstudiantes ? "Vista habilitada" : "Vista restringida"}
            color={puedeVerEstudiantes ? "info" : "default"}
            variant={puedeVerEstudiantes ? "filled" : "outlined"}
            sx={{
              "& .MuiChip-icon": {
                color: "common.white !important",
              },
            }}
          />
        </Stack>

        <Box component="form" onSubmit={handleBuscarEstudiantes}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Filtrar asistencia de estudiantes
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={profesoradoOptions}
                  value={estudianteProfesorado}
                  onChange={(_, value) => setEstudianteProfesorado(value)}
                  loading={profesoradosLoading}
                  disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                  fullWidth
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Profesorado"
                      placeholder="Selecciona un profesorado"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {profesoradosLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={estudiantePlanOptions}
                  value={estudiantePlan}
                  onChange={(_, value) => setEstudiantePlan(value)}
                  loading={estudiantePlanesLoading}
                  disabled={cargandoEstudiantes || !puedeVerEstudiantes || estudiantePlanOptions.length === 0}
                  fullWidth
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Plan"
                      placeholder="Selecciona un plan"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {estudiantePlanesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={estudianteMateriaOptions}
                  value={estudianteMateria}
                  onChange={(_, value) => setEstudianteMateria(value)}
                  loading={estudianteMateriasLoading}
                  disabled={
                    cargandoEstudiantes ||
                    !puedeVerEstudiantes ||
                    estudianteMateriaOptions.length === 0 ||
                    estudianteMateriasLoading
                  }
                  fullWidth
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Materia"
                      placeholder="Selecciona una materia"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {estudianteMateriasLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={estudianteComisionOptions}
                  value={estudianteComision}
                  onChange={(_, value) => setEstudianteComision(value)}
                  loading={estudianteComisionesLoading}
                  disabled={
                    cargandoEstudiantes ||
                    !puedeVerEstudiantes ||
                    estudianteComisionOptions.length === 0 ||
                    estudianteComisionesLoading
                  }
                  fullWidth
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Catedra (comision)"
                      placeholder="Selecciona una catedra"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {estudianteComisionesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Desde"
                type="date"
                value={estudianteDesde}
                onChange={(event) => setEstudianteDesde(event.target.value)}
                disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Hasta"
                type="date"
                value={estudianteHasta}
                onChange={(event) => setEstudianteHasta(event.target.value)}
                disabled={cargandoEstudiantes || !puedeVerEstudiantes}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Button type="submit" variant="contained" disabled={cargandoEstudiantes || !puedeVerEstudiantes}>
              {cargandoEstudiantes ? <CircularProgress size={20} /> : "Consultar"}
            </Button>
          </Stack>
        </Box>

        <Divider />

        {estudianteResultados.length === 0 ? (
          <Alert severity="info">Configura los filtros y presiona "Consultar" para ver clases.</Alert>
        ) : (
          <Stack spacing={1.5} sx={{ maxHeight: 260, overflowY: "auto" }}>
            {estudianteResultados.map((item) => (
              <Paper key={item.clase_id} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {item.materia} - {item.comision}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dayjs(item.fecha).format("DD/MM/YYYY")} - Turno {item.turno ?? "-"} - {item.horario ?? "Sin horario"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Estado de la clase: {item.estado_clase}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Presentes: {item.presentes} - Ausentes: {item.ausentes} - Justificados: {item.ausentes_justificados} - Total: {item.total_estudiantes}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}

        {!puedeVerEstudiantes && (
          <Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
            <WarningAmberIcon fontSize="small" />
            <Typography variant="caption">
              Tu rol no tiene acceso a este modulo. Contacta a Secretaria para habilitarlo.
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
