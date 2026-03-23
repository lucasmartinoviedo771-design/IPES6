import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";

import {
  type PlanDTO,
  type ProfesoradoDTO,
  type MateriaOptionDTO,
} from "@/api/cargaNotas";

type Props = {
  anioFiltro: string;
  setAnioFiltro: (v: string) => void;
  profesoradoId: string;
  setProfesoradoId: (v: string) => void;
  planId: string;
  setPlanId: (v: string) => void;
  materiaId: string;
  setMateriaId: (v: string) => void;
  modalidad: string;
  setModalidad: (v: string) => void;
  tipo: string;
  setTipo: (v: string) => void;
  profesorados: ProfesoradoDTO[];
  planes: PlanDTO[];
  materias: MateriaOptionDTO[];
};

const FiltrosPanel = ({
  anioFiltro,
  setAnioFiltro,
  profesoradoId,
  setProfesoradoId,
  planId,
  setPlanId,
  materiaId,
  setMateriaId,
  modalidad,
  setModalidad,
  tipo,
  setTipo,
  profesorados,
  planes,
  materias,
}: Props) => (
  <Paper sx={{ p: 3 }}>
    <Grid container spacing={2}>
      <Grid item xs={12} md={2}>
        <TextField
          label="Año (fecha mesa)"
          value={anioFiltro}
          onChange={(event) => setAnioFiltro(event.target.value)}
          fullWidth
          inputMode="numeric"
        />
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField
          select
          label="Profesorado"
          value={profesoradoId}
          onChange={(event) => {
            setProfesoradoId(event.target.value);
            setPlanId("");
          }}
          fullWidth
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
          disabled={!profesoradoId}
        >
          <MenuItem value=""><em>Seleccionar</em></MenuItem>
          {planes.map((plan) => (
            <MenuItem key={plan.id} value={plan.id}>{plan.resolucion}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          select
          label="Materia"
          value={materiaId}
          onChange={(event) => setMateriaId(event.target.value)}
          fullWidth
          disabled={!planId}
        >
          <MenuItem value=""><em>Todas</em></MenuItem>
          {materias.map((materia) => (
            <MenuItem key={materia.id} value={materia.id}>{materia.nombre}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField
          select
          label="Modalidad"
          value={modalidad}
          onChange={(event) => setModalidad(event.target.value)}
          fullWidth
        >
          <MenuItem value=""><em>Todas</em></MenuItem>
          <MenuItem value="REG">Regular</MenuItem>
          <MenuItem value="LIB">Libre</MenuItem>
        </TextField>
      </Grid>
      <Grid item xs={12} md={1}>
        <TextField
          select
          label="Tipo"
          value={tipo}
          onChange={(event) => setTipo(event.target.value)}
          fullWidth
        >
          <MenuItem value=""><em>Todos</em></MenuItem>
          <MenuItem value="FIN">Ordinaria</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
          <MenuItem value="ESP">Especial</MenuItem>
        </TextField>
      </Grid>
    </Grid>
  </Paper>
);

export default FiltrosPanel;
