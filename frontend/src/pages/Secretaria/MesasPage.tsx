import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Stack, TextField, MenuItem, Grid, Paper, Button, Alert } from '@mui/material';
import { client as api } from '@/api/client';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useTestMode } from '@/context/TestModeContext';
import { listarPlanes, listarProfesorados, PlanDTO, ProfesoradoDTO } from '@/api/cargaNotas';

const CUATRIMESTRE_LABEL: Record<string, string> = {
  ANU: 'Anual',
  PCU: '1° cuatrimestre',
  SCU: '2° cuatrimestre',
};

const BASE_CUATRIMESTRE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ANU', label: 'Anual' },
  { value: 'PCU', label: '1° cuatrimestre' },
  { value: 'SCU', label: '2° cuatrimestre' },
];

const DEFAULT_ANIO_OPTIONS = Array.from({ length: 6 }, (_value, index) => index + 1);

type Mesa = {
  id:number;
  materia_id:number;
  materia_nombre:string;
  profesorado_id:number | null;
  profesorado_nombre:string | null;
  plan_id:number | null;
  plan_resolucion:string | null;
  anio_cursada:number | null;
  regimen:string | null;
  tipo:string;
  fecha:string;
  hora_desde?:string;
  hora_hasta?:string;
  aula?:string;
  cupo:number;
};

export default function MesasPage(){
  const { enabled: testMode } = useTestMode();
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [tipo, setTipo] = useState('');
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
    const [planesFiltro, setPlanesFiltro] = useState<PlanDTO[]>([]);
  const [planesNueva, setPlanesNueva] = useState<PlanDTO[]>([]);
  const [profesoradoFiltro, setProfesoradoFiltro] = useState<string>('');
  const [planFiltro, setPlanFiltro] = useState<string>('');
  const [anioFiltro, setAnioFiltro] = useState<string>('');
  const [cuatrimestreFiltro, setCuatrimestreFiltro] = useState<string>('');
  const [materiaFiltro, setMateriaFiltro] = useState<string>('');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [form, setForm] = useState<Partial<Mesa> & { ventana_id?: number }>({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });
  const [profesoradoNueva, setProfesoradoNueva] = useState<string>('');
  const [planNueva, setPlanNueva] = useState<string>('');
  const [anioNueva, setAnioNueva] = useState<string>('');
  const [cuatrimestreNueva, setCuatrimestreNueva] = useState<string>('');
    const [materias, setMaterias] = useState<any[]>([]);

  const loadVentanas = async()=>{
    const data = await fetchVentanas();
    setVentanas((data||[]).filter(v=> ['MESAS_FINALES','MESAS_LIBRES','MESAS_EXTRA'].includes(v.tipo)));
  };
  const loadProfesorados = async()=>{
    try{
      const data = await listarProfesorados();
      setProfesorados(data);
    }catch{
      setProfesorados([]);
    }
  };
  const loadMesas = async()=>{
    try{
      const params: Record<string, unknown> = {};
      if (ventanaId) params.ventana_id = Number(ventanaId);
      if (tipo) params.tipo = tipo;
      if (materiaFiltro) params.materia_nombre = materiaFiltro;
      if (profesoradoFiltro) params.profesorado_id = Number(profesoradoFiltro);
      if (planFiltro) params.plan_id = Number(planFiltro);
      if (anioFiltro) params.anio = Number(anioFiltro);
      if (cuatrimestreFiltro) params.cuatrimestre = cuatrimestreFiltro;
      const { data } = await api.get<Mesa[]>(`/mesas`, { params });
      setMesas(data||[]);
    }catch (error){
      console.error('No se pudieron obtener las mesas', error);
      setMesas([]);
    }
  };
  useEffect(()=>{ loadVentanas(); loadProfesorados(); },[testMode]);
  useEffect(()=>{
    if (!profesoradoFiltro){
      setPlanesFiltro([]);
      setPlanFiltro('');
      return;
    }
    const fetchPlanes = async()=>{
      try{
        const data = await listarPlanes(Number(profesoradoFiltro));
        setPlanesFiltro(data);
      }catch{
        setPlanesFiltro([]);
      }
    };
    fetchPlanes();
  },[profesoradoFiltro]);

  useEffect(()=>{
    if (!profesoradoNueva){
      setPlanesNueva([]);
      setPlanNueva('');
      return;
    }
    const fetchPlanes = async()=>{
      try{
        const data = await listarPlanes(Number(profesoradoNueva));
        setPlanesNueva(data);
      }catch{
        setPlanesNueva([]);
      }
    };
    fetchPlanes();
  },[profesoradoNueva]);
  useEffect(()=>{ loadMesas(); },[ventanaId, tipo, materiaFiltro, profesoradoFiltro, planFiltro, anioFiltro, cuatrimestreFiltro]);

      
    const materiasFiltradas = useMemo(() => {
      return materias
        .filter(m => !anioNueva || m.anio === Number(anioNueva))
        .filter(m => !cuatrimestreNueva || m.cuatrimestre === cuatrimestreNueva);
    }, [materias, anioNueva, cuatrimestreNueva]);
  const availableAnios = useMemo(() => {
    const valores = new Set<number>();
    mesas.forEach(m => {
      if (typeof m.anio_cursada === 'number') {
        valores.add(m.anio_cursada);
      }
    });
    const base = [...DEFAULT_ANIO_OPTIONS];
    valores.forEach(v => {
      if (!base.includes(v)) {
        base.push(v);
      }
    });
    return base.sort((a, b) => a - b);
  }, [mesas]);

  const cuatrimestreOptions = useMemo(() => {
    const extras: string[] = [];
    mesas.forEach(m => {
      if (m.regimen && !BASE_CUATRIMESTRE_OPTIONS.some(option => option.value === m.regimen)) {
        extras.push(m.regimen);
      }
    });
    const dedup = Array.from(new Set(extras)).map(value => ({
      value,
      label: CUATRIMESTRE_LABEL[value] || value,
    }));
    return [...BASE_CUATRIMESTRE_OPTIONS, ...dedup];
  }, [mesas]);

  const guardar = async()=>{
    if (testMode) {
      alert('Modo prueba activo: no se guardan cambios en la base de datos.');
      return;
    }
    const payload:any = { ...form };
    if (ventanaId) payload.ventana_id = Number(ventanaId);
    await api.post(`/mesas`, payload);
    setForm({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });
    loadMesas();
  };
  const eliminar = async(id:number)=>{
    if (testMode) {
      alert('Modo prueba activo: no se eliminan registros reales.');
      return;
    }
    await api.delete(`/mesas/${id}`);
    loadMesas();
  };

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" fontWeight={800}>Mesas de Examen</Typography>
      <Typography variant="body2" color="text.secondary">ABM de mesas por periodo y tipo</Typography>
      {testMode && <Alert severity="info" sx={{ mt:1 }}>Modo prueba: los periodos se simulan y no se guardarán cambios en la base.</Alert>}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt:3 }}>Nueva mesa</Typography>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:1, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Profesorado"
          size="small"
          value={profesoradoNueva}
          onChange={(e)=>setProfesoradoNueva(e.target.value)}
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
          onChange={(e)=>setPlanNueva(e.target.value)}
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
          onChange={(e)=>setAnioNueva(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {availableAnios.map(anio => (
            <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Cuatrimestre"
          size="small"
          value={cuatrimestreNueva}
          onChange={(e)=>setCuatrimestreNueva(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {cuatrimestreOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
                <TextField
          select
          label="Materia"
          size="small"
          value={form.materia_id || ''}
          onChange={(e)=>setForm(f=>({...f, materia_id: Number(e.target.value)}))}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {materiasFiltradas.map(m => (
            <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Tipo" size="small" value={form.tipo || ''} onChange={(e)=>setForm(f=>({...f, tipo: e.target.value}))}>
        <MenuItem value="FIN">Final</MenuItem>
        <MenuItem value="LIB">Libre</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
        </TextField>
        <TextField label="Fecha" size="small" type="date" value={form.fecha || ''} onChange={(e)=>setForm(f=>({...f, fecha: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora desde" size="small" type="time" value={form.hora_desde || ''} onChange={(e)=>setForm(f=>({...f, hora_desde: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora hasta" size="small" type="time" value={form.hora_hasta || ''} onChange={(e)=>setForm(f=>({...f, hora_hasta: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Aula" size="small" value={form.aula || ''} onChange={(e)=>setForm(f=>({...f, aula: e.target.value}))} />
        <TextField label="Cupo" size="small" type="number" value={form.cupo ?? 0} onChange={(e)=>setForm(f=>({...f, cupo: Number(e.target.value)}))} />
        <Button variant="contained" onClick={guardar} disabled={testMode}>Guardar</Button>
      </Stack>

      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:2, flexWrap: 'wrap' }}>
        <TextField select label="Periodo" size="small" value={ventanaId} onChange={(e)=>setVentanaId(e.target.value)} sx={{ minWidth: 220 }}>
          {ventanas.map(v=> (
            <MenuItem key={v.id} value={String(v.id)}>
              {new Date(v.desde).toLocaleDateString()} - {new Date(v.hasta).toLocaleDateString()} ({v.tipo.replace('MESAS_','_')})
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Tipo" size="small" value={tipo} onChange={(e)=>setTipo(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="FIN">Final</MenuItem>
          <MenuItem value="LIB">Libre</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
        </TextField>
        <TextField
          label="Nombre de la materia"
          size="small"
          value={materiaFiltro}
                    onChange={(e) => setMateriaFiltro(e.target.value)}
          sx={{ minWidth: 240 }}
        />

      </Stack>

      <Grid container spacing={1.5} sx={{ mt:2 }}>
        {mesas.map(m => {
          const horaDesde = m.hora_desde ? m.hora_desde.slice(0, 5) : '';
          const horaHasta = m.hora_hasta ? m.hora_hasta.slice(0, 5) : '';
          const regimenLabel = m.regimen ? (CUATRIMESTRE_LABEL[m.regimen] || m.regimen) : '-';
          return (
            <Grid item xs={12} md={6} lg={4} key={m.id}>
              <Paper variant="outlined" sx={{ p:1.5 }}>
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">#{m.id} — {m.tipo} — {new Date(m.fecha).toLocaleDateString()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {m.materia_nombre} (#{m.materia_id}) | {m.profesorado_nombre ?? 'Sin profesorado'} | Plan {m.plan_resolucion ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Año {m.anio_cursada ?? '-'} | {regimenLabel} | {`${horaDesde}${horaHasta ? ` - ${horaHasta}` : ''}${m.aula ? ` | ${m.aula}` : ''}`} | Cupo: {m.cupo}
                  </Typography>
                  <Stack direction="row" gap={1}>
                    <Button size="small" color="error" onClick={()=>eliminar(m.id)} disabled={testMode}>Eliminar</Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  );
}