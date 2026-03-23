import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";

import { ESTADOS, WORKFLOW_ESTADOS, EstadoFiltro } from "./types";

interface Carrera {
  id: number;
  nombre: string;
}

interface VentanaOption {
  id: number;
  label: string;
}

interface FiltrosCardProps {
  filters: {
    profesoradoId: string;
    ventanaId: string;
    estado: EstadoFiltro;
    workflow: string;
    dni: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    profesoradoId: string;
    ventanaId: string;
    estado: EstadoFiltro;
    workflow: string;
    dni: string;
  }>>;
  profesorados: Carrera[];
  ventanaOptions: VentanaOption[];
}

const FiltrosCard: React.FC<FiltrosCardProps> = ({ filters, setFilters, profesorados, ventanaOptions }) => {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Profesorado destino</InputLabel>
              <Select
                label="Profesorado destino"
                value={filters.profesoradoId}
                onChange={(event) => setFilters((prev) => ({ ...prev, profesoradoId: String(event.target.value) }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={String(prof.id)}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Etapa</InputLabel>
              <Select
                label="Etapa"
                value={filters.workflow}
                onChange={(event) => setFilters((prev) => ({ ...prev, workflow: event.target.value }))}
              >
                {WORKFLOW_ESTADOS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Ventana</InputLabel>
              <Select
                label="Ventana"
                value={filters.ventanaId}
                onChange={(event) => setFilters((prev) => ({ ...prev, ventanaId: String(event.target.value) }))}
              >
                <MenuItem value="">Todas</MenuItem>
                {ventanaOptions.map((item) => (
                  <MenuItem key={item.id} value={String(item.id)}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Estado</InputLabel>
              <Select
                label="Estado"
                value={filters.estado}
                onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value as EstadoFiltro }))}
              >
                <MenuItem value="">Todos</MenuItem>
                {ESTADOS.map((estado) => (
                  <MenuItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="DNI del estudiante"
              value={filters.dni}
              onChange={(event) => setFilters((prev) => ({ ...prev, dni: event.target.value }))}
              fullWidth
              size="small"
              helperText={
                filters.dni && filters.dni.length > 0 && filters.dni.length < 7
                  ? "Ingresá al menos 7 dígitos para filtrar por DNI."
                  : "Opcional: filtra por un estudiante puntual."
              }
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default FiltrosCard;
