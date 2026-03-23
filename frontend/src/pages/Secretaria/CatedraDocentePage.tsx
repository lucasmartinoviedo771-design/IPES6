import React, { useEffect, useMemo, useState } from 'react';
import { client as axios } from '@/api/client';
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import HorarioFilters from '@/components/horarios/HorarioFilters';
import EditIcon from '@mui/icons-material/Edit';
import BackButton from "@/components/ui/BackButton";
import { toast } from '@/utils/toast';
import InfoIcon from '@mui/icons-material/Info';

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

type Comision = {
  id: number;
  materia_id: number;
  anio_lectivo: number;
  codigo: string;
  turno_id: number;
  docente_id: number | null;
  docente_nombre?: string;
  rol: string;
  estado: string;
  orden: number;
};

type Asignacion = { docenteId: number; rol: string; estado: string; orden: number; id?: number };

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
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [loading, setLoading] = useState(false);

  const [dlgOpen, setDlgOpen] = useState<boolean>(false);
  const [dlgMateria, setDlgMateria] = useState<Materia | null>(null);
  const [dlgAsignaciones, setDlgAsignaciones] = useState<Asignacion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    axios.get<Docente[]>('/docentes').then(r => setDocentes(r.data)).catch(()=>setDocentes([])); 
  }, []);

  const fetchComisiones = () => {
    if (!filters.anioLectivo || !filters.planId) return;
    setLoading(true);
    axios.get<Comision[]>('/comisiones', { 
      params: { 
        anio_lectivo: filters.anioLectivo,
        plan_id: filters.planId,
        turno_id: filters.turnoId
      } 
    })
    .then(r => setComisiones(r.data))
    .catch(() => setComisiones([]))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (filters.planId && filters.anioCarrera) {
      axios.get<Materia[]>(`/planes/${filters.planId}/materias`, { params: { anio_cursada: filters.anioCarrera } })
        .then(({ data }) => {
          const norm = (s: string) => (s||'').toUpperCase().trim();
          const filtered = filters.cuatrimestre
            ? data.filter(m => norm(m.regimen)==='ANU' || norm(m.regimen)===(filters.cuatrimestre===1?'PCU':'SCU'))
            : data;
          setMaterias(filtered);
          fetchComisiones();
        })
        .catch(()=> setMaterias([]));
    } else {
      setMaterias([]);
      setComisiones([]);
    }
  }, [filters.planId, filters.anioCarrera, filters.cuatrimestre, filters.anioLectivo, filters.turnoId]);

  const handleFilterChange = (nf: any) => setFilters(nf);
  
  const openGestion = (m: Materia) => {
    setDlgMateria(m);
    const existing = comisiones.filter(c => c.materia_id === m.id);
    setDlgAsignaciones(existing.length > 0 
      ? existing.map(c => ({ docenteId: c.docente_id || 0, rol: c.rol, estado: c.estado, orden: c.orden, id: c.id }))
      : [{ docenteId: 0, rol: 'TIT', estado: 'ABI', orden: 1 }]
    );
    setDlgOpen(true);
  };

  const addAsignacion = () => {
    const maxOrder = dlgAsignaciones.reduce((max, a) => Math.max(max, a.orden), 0);
    setDlgAsignaciones(prev => ([...prev, { docenteId: 0, rol: 'SUP', estado: 'ABI', orden: maxOrder + 1 }]));
  };
  
  const updAsignacion = (idx: number, patch: Partial<Asignacion>) => setDlgAsignaciones(prev => prev.map((a,i)=> i===idx?{...a, ...patch}:a));
  const delAsignacion = (idx: number) => setDlgAsignaciones(prev => prev.filter((_,i)=> i!==idx));

  const validateAsignaciones = () => {
    // Ya no restringimos a 1 solo Titular/Interino porque materias como Práctica I, II, III y IV 
    // y otros espacios específicos pueden tener hasta 4 docentes titulares compartiendo la cátedra.
    return true;
  };

  const guardarAsignaciones = async () => {
    if (!dlgMateria || !filters.anioLectivo || !filters.turnoId) {
      toast.error("Faltan datos para guardar (Año Lectivo o Turno)");
      return;
    }

    if (!validateAsignaciones()) return;
    
    setSaving(true);
    try {
      const existing = comisiones.filter(c => c.materia_id === dlgMateria.id);
      for (const ex of existing) {
        await axios.delete(`/comisiones/${ex.id}`);
      }

      for (const asig of dlgAsignaciones) {
        if (asig.docenteId === 0) continue;
        await axios.post('/comisiones/', {
          materia_id: dlgMateria.id,
          anio_lectivo: filters.anioLectivo,
          codigo: 'A',
          turno_id: filters.turnoId,
          docente_id: asig.docenteId,
          rol: asig.rol,
          estado: asig.estado,
          orden: asig.orden
        });
      }

      toast.success("Asignaciones guardadas correctamente");
      fetchComisiones();
      setDlgOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar asignaciones");
    } finally {
      setSaving(false);
    }
  };

  const getDocentesDisplay = (materiaId: number) => {
    const list = [...comisiones]
      .filter(c => c.materia_id === materiaId && c.docente_id)
      .sort((a, b) => a.orden - b.orden);

    if (list.length === 0) return <span className="text-gray-400">Sin asignaciones</span>;
    return (
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {list.map(c => (
          <Tooltip key={c.id} title={c.estado === 'LIC' ? 'En Licencia' : 'Activo'}>
            <Chip 
              label={`${c.docente_nombre} (${c.rol})`} 
              size="small" 
              variant={c.estado === 'LIC' ? 'outlined' : 'filled'}
              color={c.rol === 'TIT' ? 'primary' : (c.rol === 'INT' ? 'info' : 'default')}
              sx={{ opacity: c.estado === 'LIC' ? 0.6 : 1 }}
            />
          </Tooltip>
        ))}
      </Stack>
    );
  };

  return (
    <div className="center-page">
      <BackButton fallbackPath="/secretaria" sx={{ mb: 2 }} />
      <h1 className="text-3xl font-extrabold mb-1">Cátedra - Docente</h1>
      <p className="text-gray-600 mb-6">Gestiona la jerarquía de docentes: Titulares, Interinos y la cadena de Suplencias.</p>

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
          onMateriaChange={()=>{}}
        />
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Espacios curriculares</h2>
          <div className="text-sm text-gray-600">
            {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {materias.length} materias
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="timetable w-full">
            <thead>
              <tr>
                <th style={{width: 80}}>Año</th>
                <th>Espacio Curricular</th>
                <th style={{width: 120}}>Regimen</th>
                <th style={{width: 450}}>Jerarquía Docente (Orden Suplencia)</th>
                <th style={{width: 80}}></th>
              </tr>
            </thead>
            <tbody>
              {materias.map(m => (
                <tr key={m.id}>
                  <td className="timetable__hour">{m.anio_cursada}º</td>
                  <td>{m.nombre}</td>
                  <td>{m.regimen}</td>
                  <td>{getDocentesDisplay(m.id)}</td>
                  <td>
                    <IconButton size="small" onClick={() => openGestion(m)} title="Gestionar"><EditIcon fontSize="small"/></IconButton>
                  </td>
                </tr>
              ))}
              {materias.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    Seleccione un Plan y Año de carrera para ver las materias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dlgOpen} onClose={()=> !saving && setDlgOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Gestionar jerarquía docente
          <Tooltip title="Jerarquía: El Titular o Interino son los principales. Si están en licencia, entra el primer Suplente (Orden 2), y así sucesivamente.">
            <IconButton size="small" sx={{ ml: 1 }}><InfoIcon fontSize="small" /></IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            {dlgAsignaciones.sort((a,b)=>a.orden-b.orden).map((a, idx) => (
              <Grid key={idx} container spacing={2} alignItems="center">
                <Grid item xs={1} sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight="bold">#{a.orden}</Typography>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Select fullWidth size="small" value={a.docenteId?String(a.docenteId):''} onChange={(e)=>updAsignacion(idx,{ docenteId: e.target.value===''?0:Number(e.target.value) })} displayEmpty>
                    <MenuItem value="">Seleccione docente</MenuItem>
                    {docentes.map(d => (
                      <MenuItem key={d.id} value={String(d.id)}>{d.apellido ? `${d.apellido}, ${d.nombre}` : d.dni}</MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select fullWidth size="small" value={a.rol} onChange={(e)=>updAsignacion(idx,{ rol: e.target.value as any })}>
                    <MenuItem value="TIT">Titular</MenuItem>
                    <MenuItem value="INT">Interino</MenuItem>
                    <MenuItem value="SUP">Suplente</MenuItem>
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Select fullWidth size="small" value={a.estado} onChange={(e)=>updAsignacion(idx,{ estado: e.target.value as any })}>
                    <MenuItem value="ABI">Activo</MenuItem>
                    <MenuItem value="LIC">En Licencia</MenuItem>
                    <MenuItem value="CER">Cerrada</MenuItem>
                  </Select>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={1}>
                    <TextField 
                      size="small" 
                      type="number" 
                      label="Orden" 
                      value={a.orden} 
                      onChange={(e)=>updAsignacion(idx,{ orden: Number(e.target.value) })}
                      inputProps={{ min: 1 }}
                    />
                    <Button color="error" size="small" onClick={()=>delAsignacion(idx)}>X</Button>
                  </Stack>
                </Grid>
              </Grid>
            ))}
            <Button variant="outlined" disabled={saving} onClick={addAsignacion}>Agregar Suplente / Otro</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setDlgOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={guardarAsignaciones} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Jerarquía'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

