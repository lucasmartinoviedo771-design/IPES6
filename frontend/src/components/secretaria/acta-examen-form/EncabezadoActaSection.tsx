import React from "react";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ACTA_TIPOS } from './constants';

interface ProfesoradoOption {
  id: number;
  nombre: string;
  planes: PlanOption[];
}

interface PlanOption {
  id: number;
  resolucion: string | null;
  materias: MateriaOption[];
}

interface MateriaOption {
  id: number;
  nombre: string;
  anio_cursada: number | null;
}

interface EncabezadoActaSectionProps {
  tipo: "REG" | "LIB";
  setTipo: (v: "REG" | "LIB") => void;
  profesoradoId: string;
  setProfesoradoId: (v: string) => void;
  setPlanId: (v: string) => void;
  setMateriaId: (v: string) => void;
  profesorados: ProfesoradoOption[];
  planesDisponibles: PlanOption[];
  planId: string;
  setPlanId2: (v: string) => void;
  selectedProfesorado: ProfesoradoOption | undefined;
  materiasDisponibles: MateriaOption[];
  materiaId: string;
  selectedPlan: PlanOption | undefined;
  fecha: string;
  setFecha: (v: string) => void;
  folio: string;
  setFolio: (v: string) => void;
  libro: string;
  setLibro: (v: string) => void;
  observaciones: string;
  setObservaciones: (v: string) => void;
}

export function EncabezadoActaSection({
  tipo,
  setTipo,
  profesoradoId,
  setProfesoradoId,
  setPlanId,
  setMateriaId,
  profesorados,
  planesDisponibles,
  planId,
  setPlanId2,
  selectedProfesorado,
  materiasDisponibles,
  materiaId,
  selectedPlan,
  fecha,
  setFecha,
  folio,
  setFolio,
  libro,
  setLibro,
  observaciones,
  setObservaciones,
}: EncabezadoActaSectionProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Encabezado del acta
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            select
            label="Tipo de acta"
            fullWidth
            value={tipo}
            onChange={(event) => setTipo(event.target.value as "REG" | "LIB")}
          >
            {ACTA_TIPOS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            select
            label="Profesorado"
            fullWidth
            value={profesoradoId}
            onChange={(event) => {
              setProfesoradoId(event.target.value);
              setPlanId("");
              setMateriaId("");
            }}
          >
            <MenuItem value="">Seleccionar</MenuItem>
            {profesorados.map((prof) => (
              <MenuItem key={prof.id} value={String(prof.id)}>
                {prof.nombre}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            select
            label="Plan de estudio"
            fullWidth
            value={planId}
            onChange={(event) => {
              setPlanId2(event.target.value);
              setMateriaId("");
            }}
            disabled={!selectedProfesorado}
          >
            <MenuItem value="">Seleccionar</MenuItem>
            {planesDisponibles.map((plan) => (
              <MenuItem key={plan.id} value={String(plan.id)}>
                {plan.resolucion}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            select
            label="Materia"
            fullWidth
            value={materiaId}
            onChange={(event) => setMateriaId(event.target.value)}
            disabled={!selectedPlan}
          >
            <MenuItem value="">Seleccionar</MenuItem>
            {materiasDisponibles.map((materia) => (
              <MenuItem key={materia.id} value={String(materia.id)}>
                {materia.nombre} {materia.anio_cursada ? `(${materia.anio_cursada}° año)` : ""}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            label="Fecha"
            type="date"
            fullWidth
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            label="Número de folio"
            fullWidth
            value={folio}
            onChange={(event) => setFolio(event.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <TextField
            label="Libro"
            fullWidth
            value={libro}
            onChange={(event) => setLibro(event.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Observaciones generales"
            fullWidth
            multiline
            minRows={2}
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}
