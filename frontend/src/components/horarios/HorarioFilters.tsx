import React, { useState, useEffect } from 'react';
import { client as axios } from '@/api/client';
import { Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

interface Profesorado {
  id: number;
  nombre: string;
}

interface Plan {
  id: number;
  resolucion: string;
}

interface Turno {
  id: number;
  nombre: string;
}

interface Materia {
  id: number;
  nombre: string;
  horas_semana: number;
  regimen: string;
}

interface HorarioFiltersProps {
  profesoradoId: number | null;
  planId: number | null;
  anioLectivo: number | null;
  anioCarrera: number | null;
  cuatrimestre: 1 | 2 | null;
  turnoId: number | null;
  selectedMateriaId: number | null;
  onChange: (filters: {
    profesoradoId: number | null;
    planId: number | null;
    anioLectivo: number | null;
    anioCarrera: number | null;
    cuatrimestre: 1 | 2 | null;
    turnoId: number | null;
  }) => void;
  onMateriaChange: (materiaId: number | null) => void;
}

const HorarioFilters: React.FC<HorarioFiltersProps> = (props) => {
  const { profesoradoId, planId, anioLectivo, anioCarrera, cuatrimestre, turnoId, selectedMateriaId, onChange, onMateriaChange } = props;
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);

  const aniosLectivos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    axios.get<Profesorado[]>('/profesorados/').then(response => setProfesorados(response.data));
    axios.get<Turno[]>('/turnos').then(response => setTurnos(response.data));
  }, []);

  useEffect(() => {
    if (profesoradoId) {
      axios.get<Plan[]>(`/profesorados/${profesoradoId}/planes`).then(response => setPlanes(response.data));
    } else {
      setPlanes([]);
    }
  }, [profesoradoId]);

  // Cargar materias cuando haya plan y año de carrera. Filtrar por cuatrimestre: ANU o PCU/SCU según corresponda
  useEffect(() => {
    if (planId && anioCarrera) {
      axios
        .get<Materia[]>(`/planes/${planId}/materias`, { params: { anio_cursada: anioCarrera } })
        .then(({ data }) => {
          const normalize = (s: string) => (s || '').toUpperCase().trim();
          const filtered = cuatrimestre
            ? data.filter((m) => {
                const reg = normalize(m.regimen);
                const regCuatri = cuatrimestre === 1 ? 'PCU' : 'SCU';
                return reg === 'ANU' || reg === regCuatri;
              })
            : data;
          setMaterias(filtered);
        })
        .catch(() => setMaterias([]));
    } else {
      setMaterias([]);
      onMateriaChange(null);
    }
  }, [planId, anioCarrera, cuatrimestre, onMateriaChange]);

  const handleChange = (field: string, value: any) => {
    const newFilters = { ...props, [field]: value };
    if (field === 'profesoradoId') {
      newFilters.planId = null;
    }
    onChange(newFilters);
  };

  const onSel = (field: keyof HorarioFiltersProps, ev: SelectChangeEvent<string>) => {
    const raw = ev.target.value;
    const v = raw === '' ? null : Number(raw);
    handleChange(field as string, Number.isNaN(v) ? null : v);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Profesorado</InputLabel>
          <Select
            label="Profesorado"
            value={profesoradoId !== null ? String(profesoradoId) : ''}
            onChange={(e) => onSel('profesoradoId', e)}
          >
            <MenuItem value="">Seleccione</MenuItem>
            {profesorados.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small" disabled={!profesoradoId}>
          <InputLabel>Plan de Estudio</InputLabel>
          <Select
            label="Plan de Estudio"
            value={planId !== null ? String(planId) : ''}
            onChange={(e) => onSel('planId', e)}
          >
            <MenuItem value="">Seleccione</MenuItem>
            {planes.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* Materia y Turno en la misma fila */}
      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small" disabled={!planId || !anioCarrera}>
          <InputLabel>Materia</InputLabel>
          <Select
            label="Materia"
            value={selectedMateriaId !== null ? String(selectedMateriaId) : ''}
            onChange={(e) => onMateriaChange(e.target.value === '' ? null : Number(e.target.value))}
          >
            <MenuItem value="">Seleccione Materia</MenuItem>
            {materias.map((m) => (
              <MenuItem key={m.id} value={String(m.id)}>
                {m.nombre} ({m.regimen}) - {m.horas_semana} hs
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Año Lectivo</InputLabel>
          <Select
            label="Año Lectivo"
            value={anioLectivo !== null ? String(anioLectivo) : ''}
            onChange={(e) => onSel('anioLectivo', e)}
          >
            <MenuItem value="">Seleccione</MenuItem>
            {aniosLectivos.map((year) => (
              <MenuItem key={year} value={String(year)}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Año (carrera)</InputLabel>
          <Select
            label="Año (carrera)"
            value={anioCarrera !== null ? String(anioCarrera) : ''}
            onChange={(e) => onSel('anioCarrera', e)}
          >
            <MenuItem value="">Seleccione año</MenuItem>
            <MenuItem value="1">1.º año</MenuItem>
            <MenuItem value="2">2.º año</MenuItem>
            <MenuItem value="3">3.º año</MenuItem>
            <MenuItem value="4">4.º año</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Cuatrimestre</InputLabel>
          <Select
            label="Cuatrimestre"
            value={cuatrimestre !== null ? String(cuatrimestre) : ''}
            onChange={(e) => onSel('cuatrimestre', e)}
          >
            <MenuItem value="">Seleccione</MenuItem>
            <MenuItem value="1">1.º cuatrimestre</MenuItem>
            <MenuItem value="2">2.º cuatrimestre</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Turno</InputLabel>
          <Select
            label="Turno"
            value={turnoId !== null ? String(turnoId) : ''}
            onChange={(e) => onSel('turnoId', e)}
          >
            <MenuItem value="">Seleccione</MenuItem>
            {turnos.map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>{t.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};

export default HorarioFilters;
