import React from 'react';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import type { Profesorado, Plan } from '../types';

interface FilterBarProps {
  profesorados: Profesorado[];
  profId: number | '';
  setProfId: (val: number | '') => void;
  planes: Plan[];
  planId: number | '';
  setPlanId: (val: number | '') => void;
  anio: number | '';
  setAnio: (val: number | '') => void;
  filter: string;
  setFilter: (val: string) => void;
  regimen: string | '';
  setRegimen: (val: string | '') => void;
  formato: string | '';
  setFormato: (val: string | '') => void;
}

export function FilterBar({
  profesorados,
  profId,
  setProfId,
  planes,
  planId,
  setPlanId,
  anio,
  setAnio,
  filter,
  setFilter,
  regimen,
  setRegimen,
  formato,
  setFormato,
}: FilterBarProps) {
  return (
    <>
      <Grid item xs={12} md={4}>
        <FormControl fullWidth size="small">
          <InputLabel>Profesorado</InputLabel>
          <Select label="Profesorado" value={profId} onChange={e => setProfId(e.target.value as number | '')}>
            <MenuItem value="">Seleccione</MenuItem>
            {profesorados.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={4}>
        <FormControl fullWidth size="small" disabled={!profId}>
          <InputLabel>Plan</InputLabel>
          <Select label="Plan" value={planId} onChange={e => setPlanId(e.target.value as number | '')}>
            <MenuItem value="">Seleccione</MenuItem>
            {planes.map(pl => <MenuItem key={pl.id} value={pl.id}>{pl.resolucion}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={4}>
        <FormControl fullWidth size="small">
          <InputLabel>Año (carrera)</InputLabel>
          <Select label="Año (carrera)" value={anio} onChange={e => setAnio(e.target.value as number | '')}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value={1}>1º año</MenuItem>
            <MenuItem value={2}>2º año</MenuItem>
            <MenuItem value={3}>3º año</MenuItem>
            <MenuItem value={4}>4º año</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <TextField fullWidth size="small" label="Buscar materia" value={filter} onChange={e => setFilter(e.target.value)} />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Régimen</InputLabel>
          <Select label="Régimen" value={regimen} onChange={e => setRegimen(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ANU">Anual</MenuItem>
            <MenuItem value="PCU">1º cuatrimestre</MenuItem>
            <MenuItem value="SCU">2º cuatrimestre</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Formato</InputLabel>
          <Select label="Formato" value={formato} onChange={e => setFormato(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ASI">Asignatura</MenuItem>
            <MenuItem value="PRA">Práctica</MenuItem>
            <MenuItem value="MOD">Módulo</MenuItem>
            <MenuItem value="TAL">Taller</MenuItem>
            <MenuItem value="LAB">Laboratorio</MenuItem>
            <MenuItem value="SEM">Seminario</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </>
  );
}
