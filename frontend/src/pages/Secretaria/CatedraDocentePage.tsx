import React, { useEffect, useMemo, useState } from 'react';
import { client as axios } from '@/api/client';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import HorarioFilters from '@/components/horarios/HorarioFilters';
import EditIcon from '@mui/icons-material/Edit';

type Materia = { id: number; nombre: string; horas_semana: number; regimen: string; anio_cursada: number };
type Docente = { id: number; apellido?: string; nombre?: string; dni: string };

type Filters = {
  profesoradoId: number | null;
  planId: number | null;
  anioLectivo: number | null;
  anioCarrera: number | null;
  cuatrimestre: 1 | 2 | null;
  turnoId: number | null;
};

type Asignacion = { docenteId: number; rol: 'TITULAR'|'INTERINO'|'SUPLENTE'; estado: 'ACTIVO'|'STANDBY' };

export default function CatedraDocentePage() {
  const [filters, setFilters] = useState<Filters>({
    profesoradoId: null,
    planId: null,
    anioLectivo: new Date().getFullYear(),
    anioCarrera: null,
    cuatrimestre: null,
    turnoId: null,
  });

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);

  const [dlgOpen, setDlgOpen] = useState<boolean>(false);
  const [dlgMateria, setDlgMateria] = useState<Materia | null>(null);
  const [dlgAsignaciones, setDlgAsignaciones] = useState<Asignacion[]>([]);

  useEffect(() => { axios.get<Docente[]>('/docentes').then(r => setDocentes(r.data)).catch(()=>setDocentes([])); }, []);

  useEffect(() => {
    if (filters.planId && filters.anioCarrera) {
      axios.get<Materia[]>(`/planes/${filters.planId}/materias`, { params: { anio_cursada: filters.anioCarrera } })
        .then(({ data }) => {
          const norm = (s: string) => (s||'').toUpperCase().trim();
          const filtered = filters.cuatrimestre
            ? data.filter(m => norm(m.regimen)==='ANU' || norm(m.regimen)===(filters.cuatrimestre===1?'PCU':'SCU'))
            : data;
          setMaterias(filtered);
        })
        .catch(()=> setMaterias([]));
    } else {
      setMaterias([]);
    }
  }, [filters.planId, filters.anioCarrera, filters.cuatrimestre]);

  const handleFilterChange = (nf: any) => setFilters(nf);
  const handleMateriaChange = (_: number | null) => {};

  const openGestion = (m: Materia) => {
    setDlgMateria(m);
    // TODO: fetch asignaciones reales cuando tengamos backend
    setDlgAsignaciones([]);
    setDlgOpen(true);
  };

  const addAsignacion = () => setDlgAsignaciones(prev => ([...prev, { docenteId: 0, rol: 'TITULAR', estado: 'ACTIVO' }]));
  const updAsignacion = (idx: number, patch: Partial<Asignacion>) => setDlgAsignaciones(prev => prev.map((a,i)=> i===idx?{...a, ...patch}:a));
  const delAsignacion = (idx: number) => setDlgAsignaciones(prev => prev.filter((_,i)=> i!==idx));

  const guardarAsignaciones = async () => {
    // TODO: POST real al backend. Por ahora log y cerrar.
    
    setDlgOpen(false);
  };

  return (
    <div className="center-page">
      <h1 className="text-3xl font-extrabold mb-1">Cátedra - Docente</h1>
      <p className="text-gray-600 mb-6">Asigna docentes (titulares, interinos y suplentes) a cada espacio curricular.</p>

      <section className="card mb-4">
        <HorarioFilters
          profesoradoId={filters.profesoradoId}
          planId={filters.planId}
          anioLectivo={filters.anioLectivo}
          anioCarrera={filters.anioCarrera}
          cuatrimestre={filters.cuatrimestre}
          turnoId={filters.turnoId}
          selectedMateriaId={null}
          onChange={handleFilterChange}
          onMateriaChange={handleMateriaChange}
        />
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Espacios curriculares</h2>
          <div className="text-sm text-gray-600">{materias.length} materias</div>
        </div>
        <div className="overflow-x-auto">
          <table className="timetable w-full">
            <thead>
              <tr>
                <th style={{width: 80}}>Año</th>
                <th>Espacio Curricular</th>
                <th style={{width: 120}}>Regimen</th>
                <th style={{width: 250}}>Profesores</th>
                <th style={{width: 80}}></th>
              </tr>
            </thead>
            <tbody>
              {materias.map(m => (
                <tr key={m.id}>
                  <td className="timetable__hour">{m.anio_cursada}º</td>
                  <td>{m.nombre}</td>
                  <td>{m.regimen}</td>
                  <td><span className="text-gray-500">Sin asignaciones</span></td>
                  <td>
                    <IconButton size="small" onClick={() => openGestion(m)} title="Gestionar"><EditIcon fontSize="small"/></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dlgOpen} onClose={()=>setDlgOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Gestionar cátedra
          <Typography component="div" variant="body2" color="text.secondary">
            {dlgMateria?.nombre} — Año {dlgMateria?.anio_cursada} — Regimen {dlgMateria?.regimen}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2}>
            {dlgAsignaciones.map((a, idx) => (
              <Grid key={idx} container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Select fullWidth size="small" value={a.docenteId?String(a.docenteId):''} onChange={(e)=>updAsignacion(idx,{ docenteId: e.target.value===''?0:Number(e.target.value) })} displayEmpty>
                    <MenuItem value="">Seleccione docente</MenuItem>
                    {docentes.map(d => (
                      <MenuItem key={d.id} value={String(d.id)}>{d.apellido ? `${d.apellido}, ${d.nombre}` : d.dni}</MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Select fullWidth size="small" value={a.rol} onChange={(e)=>updAsignacion(idx,{ rol: e.target.value as any })}>
                    <MenuItem value="TITULAR">Titular</MenuItem>
                    <MenuItem value="INTERINO">Interino</MenuItem>
                    <MenuItem value="SUPLENTE">Suplente</MenuItem>
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select fullWidth size="small" value={a.estado} onChange={(e)=>updAsignacion(idx,{ estado: e.target.value as any })}>
                    <MenuItem value="ACTIVO">Activo</MenuItem>
                    <MenuItem value="STANDBY">Standby</MenuItem>
                  </Select>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button color="error" size="small" onClick={()=>delAsignacion(idx)}>Quitar</Button>
                </Grid>
              </Grid>
            ))}
            <Button variant="outlined" onClick={addAsignacion}>Agregar docente</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setDlgOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardarAsignaciones}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

