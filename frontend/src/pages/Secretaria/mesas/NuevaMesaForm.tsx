import React from 'react';
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import CircularProgress from "@mui/material/CircularProgress";
import { VentanaDto } from '@/api/ventanas';
import { PlanDTO } from '@/api/cargaNotas';
import { DocenteDTO } from '@/api/docentes';
import { Mesa, MateriaOption, MesaModalidad } from './types';
import { MESA_MODALIDAD_LABEL } from './constants';
import { buildVentanaLabel, formatDocenteLabel } from './utils';

interface NuevaMesaFormProps {
  ventanas: VentanaDto[];
  ventanaNueva: string;
  setVentanaNueva: (v: string) => void;
  profesorados: { id: number; nombre: string }[];
  profesoradoNueva: string;
  setProfesoradoNueva: (v: string) => void;
  planesNueva: PlanDTO[];
  planNueva: string;
  setPlanNueva: (v: string) => void;
  anioNueva: string;
  setAnioNueva: (v: string) => void;
  cuatrimestreNueva: string;
  setCuatrimestreNueva: (v: string) => void;
  cuatrimestreOptionsNueva: { value: string; label: string }[];
  availableAniosNueva: number[];
  materiasFiltradas: MateriaOption[];
  form: Partial<Mesa> & { ventana_id?: number };
  setForm: React.Dispatch<React.SetStateAction<Partial<Mesa> & { ventana_id?: number }>>;
  mesaEspecial: boolean;
  mesaTipoLabel: string | null;
  handleMesaEspecialChange: (checked: boolean) => void;
  modalidadesSeleccionadas: MesaModalidad[];
  handleToggleModalidad: (modalidad: MesaModalidad, enabled: boolean) => void;
  docentesLista: DocenteDTO[];
  docentesLoading: boolean;
  tribunalDocentes: { presidente: DocenteDTO | null; vocal1: DocenteDTO | null; vocal2: DocenteDTO | null };
  handleTribunalChange: (rol: 'presidente' | 'vocal1' | 'vocal2', value: DocenteDTO | null) => void;
  onGuardar: () => void;
}

export function NuevaMesaForm({
  ventanas,
  ventanaNueva,
  setVentanaNueva,
  profesorados,
  profesoradoNueva,
  setProfesoradoNueva,
  planesNueva,
  planNueva,
  setPlanNueva,
  anioNueva,
  setAnioNueva,
  cuatrimestreNueva,
  setCuatrimestreNueva,
  cuatrimestreOptionsNueva,
  availableAniosNueva,
  materiasFiltradas,
  form,
  setForm,
  mesaEspecial,
  mesaTipoLabel,
  handleMesaEspecialChange,
  modalidadesSeleccionadas,
  handleToggleModalidad,
  docentesLista,
  docentesLoading,
  tribunalDocentes,
  handleTribunalChange,
  onGuardar,
}: NuevaMesaFormProps) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
      <TextField
        select
        label="Periodo"
        size="small"
        value={ventanaNueva}
        onChange={(e) => setVentanaNueva(e.target.value)}
        sx={{ minWidth: 220 }}
        disabled={mesaEspecial}
        helperText={mesaEspecial ? 'No aplica para mesas especiales.' : undefined}
      >
        <MenuItem value="">Seleccionar</MenuItem>
        {ventanas.map(v => (
          <MenuItem key={v.id} value={String(v.id)}>{buildVentanaLabel(v)}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Profesorado"
        size="small"
        value={profesoradoNueva}
        onChange={(e) => setProfesoradoNueva(e.target.value)}
        sx={{ minWidth: 240 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {profesorados.map(p => (
          <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Plan de estudio"
        size="small"
        value={planNueva}
        onChange={(e) => setPlanNueva(e.target.value)}
        sx={{ minWidth: 200 }}
        disabled={!profesoradoNueva}
      >
        <MenuItem value="">Todos</MenuItem>
        {planesNueva.map(p => (
          <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Año cursada"
        size="small"
        value={anioNueva}
        onChange={(e) => setAnioNueva(e.target.value)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {availableAniosNueva.map(anio => (
          <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Cuatrimestre"
        size="small"
        value={cuatrimestreNueva}
        onChange={(e) => setCuatrimestreNueva(e.target.value)}
        sx={{ minWidth: 180 }}
      >
        {cuatrimestreOptionsNueva.map(option => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Materia"
        size="small"
        value={form.materia_id ?? ''}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            materia_id: e.target.value ? Number(e.target.value) : undefined,
          }))
        }
        sx={{ minWidth: 240 }}
        disabled={!planNueva || !materiasFiltradas.length}
      >
        <MenuItem value="">Seleccionar</MenuItem>
        {materiasFiltradas.map(m => (
          <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
        ))}
      </TextField>
      <Box sx={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={600}>Tipo de mesa</Typography>
        <Typography variant="body2" color={mesaTipoLabel ? 'text.primary' : 'text.secondary'}>
          {mesaEspecial
            ? 'Especial (sin periodo definido)'
            : mesaTipoLabel
              ? `Tipo actual: ${mesaTipoLabel}`
              : 'Selecciona un periodo para determinar el tipo.'}
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={mesaEspecial}
              onChange={(e) => handleMesaEspecialChange(e.target.checked)}
            />
          }
          label="Crear como mesa especial (no requiere periodo)"
        />
      </Box>
      <FormControl component="fieldset" sx={{ minWidth: 220 }}>
        <FormLabel component="legend">Modalidades</FormLabel>
        <FormGroup row sx={{ mt: 0.5 }}>
          {(['REG', 'LIB'] as MesaModalidad[]).map((modalidad) => (
            <FormControlLabel
              key={modalidad}
              control={
                <Checkbox
                  size="small"
                  checked={modalidadesSeleccionadas.includes(modalidad)}
                  onChange={(e) => handleToggleModalidad(modalidad, e.target.checked)}
                />
              }
              label={MESA_MODALIDAD_LABEL[modalidad]}
            />
          ))}
        </FormGroup>
      </FormControl>
      <Box sx={{ minWidth: 280, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Tribunal evaluador</Typography>
        <Autocomplete
          size="small"
          options={docentesLista}
          value={tribunalDocentes.presidente}
          getOptionLabel={formatDocenteLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={docentesLoading}
          onChange={(_event, value) => handleTribunalChange('presidente', value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Titular / Presidente"
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {docentesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <Autocomplete
          size="small"
          options={docentesLista}
          value={tribunalDocentes.vocal1}
          getOptionLabel={formatDocenteLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={docentesLoading}
          onChange={(_event, value) => handleTribunalChange('vocal1', value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Vocal 1"
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {docentesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <Autocomplete
          size="small"
          options={docentesLista}
          value={tribunalDocentes.vocal2}
          getOptionLabel={formatDocenteLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={docentesLoading}
          onChange={(_event, value) => handleTribunalChange('vocal2', value)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Vocal 2"
              size="small"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {docentesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>
      <TextField label="Fecha" size="small" type="date" value={form.fecha || ''} onChange={(e) => setForm(f => ({ ...f, fecha: e.target.value }))} InputLabelProps={{ shrink: true }} />
      <TextField label="Hora desde" size="small" type="time" value={form.hora_desde || ''} onChange={(e) => setForm(f => ({ ...f, hora_desde: e.target.value }))} InputLabelProps={{ shrink: true }} />
      <TextField label="Hora hasta" size="small" type="time" value={form.hora_hasta || ''} onChange={(e) => setForm(f => ({ ...f, hora_hasta: e.target.value }))} InputLabelProps={{ shrink: true }} />
      <TextField label="Aula" size="small" value={form.aula || ''} onChange={(e) => setForm(f => ({ ...f, aula: e.target.value }))} />
      <TextField label="Cupo" size="small" type="number" value={form.cupo ?? 0} onChange={(e) => setForm(f => ({ ...f, cupo: Number(e.target.value) }))} />
      <Button variant="contained" onClick={onGuardar}>Guardar</Button>
    </Stack>
  );
}
