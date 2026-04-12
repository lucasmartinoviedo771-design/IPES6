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
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
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
    <Box sx={{ mt: 1 }}>
      <Grid container spacing={3}>
        {/* BLOQUE ACADÉMICO */}
        <Grid item xs={12}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 1 }} />
              Referencia Académica
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Periodo de Mesa"
                  size="small"
                  fullWidth
                  value={ventanaNueva}
                  onChange={(e) => setVentanaNueva(e.target.value)}
                  disabled={mesaEspecial}
                  error={!mesaEspecial && !ventanaNueva}
                >
                  <MenuItem value="">Seleccionar periodo...</MenuItem>
                  {ventanas.map(v => (
                    <MenuItem key={v.id} value={String(v.id)}>{buildVentanaLabel(v)}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Profesorado / Carrera"
                  size="small"
                  fullWidth
                  value={profesoradoNueva}
                  onChange={(e) => setProfesoradoNueva(e.target.value)}
                >
                  <MenuItem value="">Seleccionar carrera...</MenuItem>
                  {profesorados.map(p => (
                    <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Plan de estudio"
                  size="small"
                  fullWidth
                  value={planNueva}
                  onChange={(e) => setPlanNueva(e.target.value)}
                  disabled={!profesoradoNueva}
                >
                  <MenuItem value="">Seleccionar plan...</MenuItem>
                  {planesNueva.map(p => (
                    <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Año de la Materia"
                  size="small"
                  fullWidth
                  value={anioNueva}
                  onChange={(e) => setAnioNueva(e.target.value)}
                >
                  <MenuItem value="">Todos los años</MenuItem>
                  {availableAniosNueva.map(anio => (
                    <MenuItem key={anio} value={String(anio)}>{anio}º Año</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label="Cuatrimestre / Régimen"
                  size="small"
                  fullWidth
                  value={cuatrimestreNueva}
                  onChange={(e) => setCuatrimestreNueva(e.target.value)}
                >
                  {cuatrimestreOptionsNueva.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Asignatura (Materia)"
                  size="small"
                  fullWidth
                  value={form.materia_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      materia_id: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  disabled={!planNueva || !materiasFiltradas.length}
                  error={!form.materia_id}
                >
                  <MenuItem value="">Seleccionar asignatura...</MenuItem>
                  {materiasFiltradas.map(m => (
                    <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </Grid>

        {/* BLOQUE TRIBUNAL Y CONFIGURACIÓN */}
        <Grid item xs={12} md={5}>
          <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 2, bgcolor: '#fafafa', height: '100%' }}>
            <Typography variant="subtitle2" color="primary" fontWeight={700} gutterBottom>
              Tribunal Evaluador
            </Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
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
                    placeholder="Buscar docente..." 
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
                    placeholder="Buscar docente..." 
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
                    placeholder="Buscar docente..." 
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

              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {mesaEspecial ? 'Mesa Especial configurada' : (mesaTipoLabel ? `Tipo: ${mesaTipoLabel}` : 'Pendiente de periodo')}
                </Typography>
                <FormControlLabel
                  control={<Checkbox size="small" checked={mesaEspecial} onChange={(e) => handleMesaEspecialChange(e.target.checked)} />}
                  label={<Typography variant="body2">¿Es Mesa Especial?</Typography>}
                />
              </Box>
            </Stack>
          </Box>
        </Grid>

        {/* BLOQUE LOGÍSTICA */}
        <Grid item xs={12} md={7}>
          <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" color="primary" fontWeight={700} gutterBottom>
              Logística y Modalidad
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={3}>
                <TextField label="Fecha 1º Llamado" size="small" fullWidth type="date" value={form.fecha || ''} onChange={(e) => setForm(f => ({ ...f, fecha: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Fecha 2º Llamado (Opcional)" size="small" fullWidth type="date" value={form.fecha2 || ''} onChange={(e) => setForm(f => ({ ...f, fecha2: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField label="Desde" size="small" fullWidth type="time" value={form.hora_desde || ''} onChange={(e) => setForm(f => ({ ...f, hora_desde: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField label="Aula / Espacio (Opcional)" placeholder="Ej: Aula 4, Zoom, etc." size="small" fullWidth value={form.aula || ''} onChange={(e) => setForm(f => ({ ...f, aula: e.target.value }))} />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField label="Cupo (Opcional)" size="small" fullWidth type="number" value={form.cupo ?? 0} onChange={(e) => setForm(f => ({ ...f, cupo: Number(e.target.value) }))} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: '4px 8px', height: '40px' }}>
                  <FormGroup row>
                    {(['REG', 'LIB'] as MesaModalidad[]).map((modalidad) => (
                      <FormControlLabel
                        key={modalidad}
                        control={<Checkbox size="small" checked={modalidadesSeleccionadas.includes(modalidad)} onChange={(e) => handleToggleModalidad(modalidad, e.target.checked)} />}
                        label={<Typography variant="caption">{MESA_MODALIDAD_LABEL[modalidad]}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ flexGrow: 1 }} />
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
               <Typography variant="caption" color="text.secondary">
                  Verifica que los datos del tribunal y horario sean correctos antes de guardar.
               </Typography>
               <Button variant="contained" size="large" onClick={onGuardar} sx={{ px: 4, py: 1.2, fontWeight: 700, borderRadius: 2 }}>
                 Guardar Mesa
               </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
