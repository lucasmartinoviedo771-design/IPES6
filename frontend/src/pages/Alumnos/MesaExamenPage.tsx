import React, { useEffect, useState } from 'react';
import { Button, TextField, Typography, Box, Alert, MenuItem, Select, FormControl, InputLabel, Grid, Paper, Stack } from '@mui/material';
import { listarMesas, inscribirMesa, obtenerHistorialAlumno } from '@/api/alumnos';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';

const MesaExamenPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user:null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles||[]).some((r:string)=> ['admin','secretaria','bedel'].includes((r||'').toLowerCase())));
  const [dni, setDni] = useState('');
  const [tipo, setTipo] = useState<'FIN'|'EXT'|''>('');
  const [modalidad, setModalidad] = useState<'REG'|'LIB'|''>('');
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [mesas, setMesas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<{ aprobadas:number[]; regularizadas:number[]; inscriptas_actuales:number[] }>({ aprobadas:[], regularizadas:[], inscriptas_actuales:[] });
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(()=>{
    (async()=>{
      try{
        const data = await fetchVentanas();
        const v = (data||[]).filter((x)=> ['MESAS_FINALES','MESAS_EXTRA'].includes(x.tipo));
        setVentanas(v);
        if (v.length) setVentanaId(String(v[0].id));
      }catch{}
    })();
  },[]);

  useEffect(()=>{ (async()=>{
    try{
      const data = await listarMesas({
        tipo: tipo || undefined,
        modalidad: modalidad || undefined,
        ventana_id: ventanaId ? Number(ventanaId) : undefined,
      });
      setMesas(data||[]);
    }catch{ setMesas([]); }
  })(); }, [tipo, modalidad, ventanaId]);

  useEffect(()=>{ (async()=>{
    try{
      const h = await obtenerHistorialAlumno(canGestionar && dni ? { dni } : undefined);
      setHistorial({
        aprobadas: h.aprobadas || [],
        regularizadas: h.regularizadas || [],
        inscriptas_actuales: h.inscriptas_actuales || [],
      });
    }catch{}
  })(); }, [dni]);

  const onInscribir = async (mesaId:number)=>{
    try{
      const res = await inscribirMesa({ mesa_id: mesaId, dni: canGestionar ? (dni||undefined) : undefined });
      setInfo(res.message);
      setErr(null);
    }catch(e:any){ setErr(e?.response?.data?.message || 'No se pudo inscribir'); setInfo(null); }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Mesas de Examen</Typography>
      <Typography variant="body1" paragraph>Inscribite a mesas habilitadas. Evita superposición y respeta correlatividades.</Typography>
      {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mb:2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={tipo} onChange={(e)=>setTipo(e.target.value as any)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="FIN">Final</MenuItem>
            <MenuItem value="EXT">Extraordinaria</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Modalidad</InputLabel>
          <Select label="Modalidad" value={modalidad} onChange={(e)=>setModalidad(e.target.value as any)}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="REG">Regulares</MenuItem>
            <MenuItem value="LIB">Libres</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Periodo</InputLabel>
          <Select label="Periodo" value={ventanaId} onChange={(e)=>setVentanaId(e.target.value)}>
            {ventanas.map((v)=> (
              <MenuItem key={v.id} value={String(v.id)}>
                {new Date(v.desde).toLocaleDateString()} - {new Date(v.hasta).toLocaleDateString()} ({v.tipo === 'MESAS_FINALES' ? 'FINALES' : 'EXTRA'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {canGestionar && (
          <TextField size="small" label="DNI estudiante (opcional)" value={dni} onChange={(e)=>setDni(e.target.value)} />
        )}
      </Stack>

      <Grid container spacing={1.5}>
        <>
          {mesas.filter((m:any)=>{
            const reqAPR:number[] = m.correlativas_aprob || [];
            const tieneAPR = reqAPR.every((id)=> historial.aprobadas.includes(id));
            if (!tieneAPR) return false;
            const materiaId = m.materia?.id ?? m.materia_id;
            if (m.modalidad === 'REG') {
              return historial.regularizadas.includes(materiaId);
            }
            const estaRegular = historial.regularizadas.includes(materiaId);
            const cursando = historial.inscriptas_actuales.includes(materiaId);
            return !estaRegular && !cursando;
          }).map((m:any)=> (
            <Grid item xs={12} md={6} lg={4} key={m.id}>
              <Paper variant="outlined" sx={{ p:1.5 }}>
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">{m.materia.nombre} - {m.tipo} ({m.modalidad === 'LIB' ? 'Libre' : 'Regular'})</Typography>
                  <Typography variant="body2" color="text.secondary">{new Date(m.fecha).toLocaleDateString()} {m.hora_desde ? (m.hora_desde + (m.hora_hasta? ' - ' + m.hora_hasta : '')) : ''} - {m.aula || ''}</Typography>
                  <Button size="small" variant="contained" onClick={()=>onInscribir(m.id)}>Inscribirme</Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!mesas.length && (
            <Grid item xs={12}><Alert severity="info">No hay mesas disponibles con los filtros seleccionados.</Alert></Grid>
          )}
        </>
      </Grid>
    </Box>
  );
};

export default MesaExamenPage;
