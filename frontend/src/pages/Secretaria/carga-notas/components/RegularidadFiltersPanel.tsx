import React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ComisionOptionDTO,
  MateriaOptionDTO,
  PlanDTO,
  ProfesoradoDTO,
} from "@/api/cargaNotas";
import { FiltersState, cuatrimestreLabel } from "../types";

type Props = {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  profesorados: ProfesoradoDTO[];
  planes: PlanDTO[];
  materias: MateriaOptionDTO[];
  allComisiones: ComisionOptionDTO[];
  loadingProfesorados: boolean;
  loadingPlanes: boolean;
  loadingComisiones: boolean;
  uniqueAnios: number[];
  uniqueCuatrimestres: string[];
  uniqueAniosCursada: number[];
  materiaOptions: MateriaOptionDTO[];
  onGestionComisionesClick: () => void;
};

const RegularidadFiltersPanel: React.FC<Props> = ({
  filters,
  setFilters,
  profesorados,
  planes,
  materias,
  loadingProfesorados,
  loadingPlanes,
  loadingComisiones,
  uniqueAnios,
  uniqueCuatrimestres,
  uniqueAniosCursada,
  materiaOptions,
  onGestionComisionesClick,
}) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack gap={3}>
        <Typography variant="subtitle1" fontWeight={700}>
          Filtros
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6} lg={4}>
            <Autocomplete
              options={profesorados}
              loading={loadingProfesorados}
              getOptionLabel={(option) => option.nombre}
              value={profesorados.find((p) => p.id === filters.profesoradoId) ?? null}
              onChange={(_, value) =>
                setFilters((prev) => ({
                  ...prev,
                  profesoradoId: value?.id ?? null,
                  planId: null,
                  materiaId: null,
                  comisionId: null,
                  anio: null,
                  cuatrimestre: null,
                  anioCursada: null,
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Profesorado"
                  placeholder="Selecciona profesorado"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingProfesorados ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <Autocomplete
              options={planes}
              loading={loadingPlanes}
              getOptionLabel={(option) => option.resolucion}
              value={planes.find((p) => p.id === filters.planId) ?? null}
              onChange={(_, value) =>
                setFilters((prev) => ({
                  ...prev,
                  planId: value?.id ?? null,
                  materiaId: null,
                  comisionId: null,
                  anio: null,
                  cuatrimestre: null,
                  anioCursada: null,
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Plan de estudio"
                  placeholder="Resolucion"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingPlanes ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={4}>
            <FormControl fullWidth>
              <InputLabel id="anio-select">Año lectivo</InputLabel>
              <Select
                labelId="anio-select"
                label="Año lectivo"
                value={filters.anio ?? ""}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    anio: event.target.value ? Number(event.target.value) : null,
                    materiaId: null,
                    comisionId: null,
                  }))
                }
              >
                <MenuItem value="">
                  <em>TODOS</em>
                </MenuItem>
                {uniqueAnios.map((anio) => (
                  <MenuItem key={anio} value={anio}>
                    {anio}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} lg={2}>
            <FormControl fullWidth>
              <InputLabel id="cuatrimestre-select">Cuatrimestre</InputLabel>
              <Select
                labelId="cuatrimestre-select"
                label="Cuatrimestre"
                value={filters.cuatrimestre ?? ""}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    cuatrimestre: event.target.value || null,
                    materiaId: null,
                    comisionId: null,
                  }))
                }
              >
                <MenuItem value="">
                  <em>TODOS</em>
                </MenuItem>
                {uniqueCuatrimestres.map((clave) => (
                  <MenuItem key={clave} value={clave}>
                    {cuatrimestreLabel[clave] ?? clave}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} lg={2}>
            <FormControl fullWidth>
              <InputLabel id="anio-cursada-select">Año (Cursada)</InputLabel>
              <Select
                labelId="anio-cursada-select"
                label="Año (Cursada)"
                value={filters.anioCursada ?? ""}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    anioCursada: event.target.value ? Number(event.target.value) : null,
                    materiaId: null,
                    comisionId: null,
                  }))
                }
              >
                <MenuItem value="">
                  <em>TODOS</em>
                </MenuItem>
                {uniqueAniosCursada.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}º Año
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6} lg={8}>
            <Autocomplete
              options={materiaOptions}
              loading={loadingComisiones}
              getOptionLabel={(option) => {
                const etiquetaCuatrimestre = option.cuatrimestre ? cuatrimestreLabel[option.cuatrimestre] ?? option.cuatrimestre : "Anual";
                return `${option.anio ?? "-"} - ${option.nombre} (${etiquetaCuatrimestre})`;
              }}
              value={materiaOptions.find((m) => m.id === filters.materiaId) ?? null}
              onChange={(_, value) =>
                setFilters((prev) => ({
                  ...prev,
                  materiaId: value?.id ?? null,
                  comisionId: null,
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Materia"
                  placeholder="Selecciona materia"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingComisiones ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          {filters.materiaId && (
            <Grid item xs={12}>
              <Button variant="outlined" size="small" onClick={onGestionComisionesClick}>
                Gestionar Comisiones
              </Button>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Paper>
  );
};

export default RegularidadFiltersPanel;
