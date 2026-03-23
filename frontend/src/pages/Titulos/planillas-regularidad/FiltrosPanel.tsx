import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";

import {
  type PlanDTO,
  type ProfesoradoDTO,
  type MateriaOptionDTO,
} from "@/api/cargaNotas";
import { CUATRIMESTRE_LABELS } from "./utils";

type Props = {
  anioLectivo: string;
  setAnioLectivo: (v: string) => void;
  profesoradoId: string;
  setProfesoradoId: (v: string) => void;
  planId: string;
  setPlanId: (v: string) => void;
  anioCursada: string;
  setAnioCursada: (v: string) => void;
  cuatrimestre: string;
  setCuatrimestre: (v: string) => void;
  materiaId: string;
  setMateriaId: (v: string) => void;
  profesorados: ProfesoradoDTO[];
  planes: PlanDTO[];
  uniqueAnios: number[];
  uniqueAniosCursada: number[];
  filteredMateriasOptions: MateriaOptionDTO[];
  lookupLoading: boolean;
};

const FiltrosPanel = ({
  anioLectivo,
  setAnioLectivo,
  profesoradoId,
  setProfesoradoId,
  planId,
  setPlanId,
  anioCursada,
  setAnioCursada,
  cuatrimestre,
  setCuatrimestre,
  materiaId,
  setMateriaId,
  profesorados,
  planes,
  uniqueAnios,
  uniqueAniosCursada,
  filteredMateriasOptions,
  lookupLoading,
}: Props) => {
  const disableFilters = lookupLoading;

  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Año lectivo"
            value={anioLectivo}
            onChange={(event) => setAnioLectivo(event.target.value)}
            fullWidth
            disabled={disableFilters}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            {uniqueAnios.map((anio) => (
              <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            select
            label="Profesorado"
            value={profesoradoId}
            onChange={(event) => {
              setProfesoradoId(event.target.value);
              setPlanId("");
              setMateriaId("");
            }}
            fullWidth
            disabled={disableFilters}
          >
            <MenuItem value=""><em>Seleccionar</em></MenuItem>
            {profesorados.map((prof) => (
              <MenuItem key={prof.id} value={prof.id}>{prof.nombre}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Plan"
            value={planId}
            onChange={(event) => {
              setPlanId(event.target.value);
              setMateriaId("");
            }}
            fullWidth
            disabled={!profesoradoId || disableFilters}
          >
            <MenuItem value=""><em>Seleccionar</em></MenuItem>
            {planes.map((plan) => (
              <MenuItem key={plan.id} value={plan.id}>{plan.resolucion}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={1}>
          <TextField
            select
            label="Año"
            value={anioCursada}
            onChange={(event) => setAnioCursada(event.target.value)}
            fullWidth
            disabled={!planId || disableFilters}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            {uniqueAniosCursada.map((a) => (
              <MenuItem key={a} value={String(a)}>{a}º</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Cuatrimestre"
            value={cuatrimestre}
            onChange={(event) => setCuatrimestre(event.target.value)}
            fullWidth
            disabled={!planId || disableFilters}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            {Object.entries(CUATRIMESTRE_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Materia"
            value={materiaId}
            onChange={(event) => setMateriaId(event.target.value)}
            fullWidth
            disabled={!planId || disableFilters}
          >
            <MenuItem value=""><em>Todas</em></MenuItem>
            {filteredMateriasOptions.map((materia) => (
              <MenuItem key={materia.id} value={materia.id}>{materia.nombre}</MenuItem>
            ))}
          </TextField>
        </Grid>
        {lookupLoading && (
          <Grid item xs={12} md={0} sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} />
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default FiltrosPanel;
