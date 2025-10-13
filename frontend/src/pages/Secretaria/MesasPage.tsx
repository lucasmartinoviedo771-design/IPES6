import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, TextField, MenuItem, Grid, Paper, Button } from '@mui/material';
import { client as api } from '@/api/client';

type Ventana = { id:number; tipo:string; desde:string; hasta:string };
type Mesa = { id:number; materia_id:number; tipo:string; fecha:string; hora_desde?:string; hora_hasta?:string; aula?:string; cupo:number };

export default function MesasPage(){
  const [ventanas, setVentanas] = useState<Ventana[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [tipo, setTipo] = useState('');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [form, setForm] = useState<Partial<Mesa> & { ventana_id?: number }>({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });

  const loadVentanas = async()=>{
    const { data } = await api.get<Ventana[]>(`/ventanas`);
    setVentanas((data||[]).filter(v=> ['MESAS_FINALES','MESAS_LIBRES','MESAS_EXTRA'].includes(v.tipo)));
  };
  const loadMesas = async()=>{
    const { data } = await api.get<Mesa[]>(`/mesas`, { params: { ventana_id: ventanaId || undefined, tipo: tipo || undefined } });
    setMesas(data||[]);
  };
  useEffect(()=>{ loadVentanas(); },[]);
  useEffect(()=>{ loadMesas(); },[ventanaId, tipo]);

  const guardar = async()=>{
    const payload:any = { ...form };
    if (ventanaId) payload.ventana_id = Number(ventanaId);
    await api.post(`/mesas`, payload);
    setForm({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });
    loadMesas();
  };
  const eliminar = async(id:number)=>{ await api.delete(`/mesas/${id}`); loadMesas(); };

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" fontWeight={800}>Mesas de Examen</Typography>
      <Typography variant="body2" color="text.secondary">ABM de mesas por periodo y tipo</Typography>

      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:2 }}>
        <TextField select label="Periodo" size="small" value={ventanaId} onChange={(e)=>setVentanaId(e.target.value)} sx={{ minWidth: 220 }}>
          {ventanas.map(v=> (
            <MenuItem key={v.id} value={String(v.id)}>{new Date(v.desde).toLocaleDateString()} – {new Date(v.hasta).toLocaleDateString()} ({v.tipo.replace('MESAS_','')})</MenuItem>
          ))}
        </TextField>
        <TextField select label="Tipo" size="small" value={tipo} onChange={(e)=>setTipo(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="PAR">Parcial</MenuItem>
          <MenuItem value="FIN">Final</MenuItem>
          <MenuItem value="LIB">Libre</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
        </TextField>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt:3 }}>Nueva mesa</Typography>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:1 }}>
        <TextField label="Materia ID" size="small" type="number" value={form.materia_id || ''} onChange={(e)=>setForm(f=>({...f, materia_id: Number(e.target.value)}))} />
        <TextField select label="Tipo" size="small" value={form.tipo || ''} onChange={(e)=>setForm(f=>({...f, tipo: e.target.value}))}>
          <MenuItem value="PAR">Parcial</MenuItem>
          <MenuItem value="FIN">Final</MenuItem>
          <MenuItem value="LIB">Libre</MenuItem>
          <MenuItem value="EXT">Extraordinaria</MenuItem>
        </TextField>
        <TextField label="Fecha" size="small" type="date" value={form.fecha || ''} onChange={(e)=>setForm(f=>({...f, fecha: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora desde" size="small" type="time" value={form.hora_desde || ''} onChange={(e)=>setForm(f=>({...f, hora_desde: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora hasta" size="small" type="time" value={form.hora_hasta || ''} onChange={(e)=>setForm(f=>({...f, hora_hasta: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Aula" size="small" value={form.aula || ''} onChange={(e)=>setForm(f=>({...f, aula: e.target.value}))} />
        <TextField label="Cupo" size="small" type="number" value={form.cupo ?? 0} onChange={(e)=>setForm(f=>({...f, cupo: Number(e.target.value)}))} />
        <Button variant="contained" onClick={guardar}>Guardar</Button>
      </Stack>

      <Grid container spacing={1.5} sx={{ mt:2 }}>
        {mesas.map(m=> (
          <Grid item xs={12} md={6} lg={4} key={m.id}>
            <Paper variant="outlined" sx={{ p:1.5 }}>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">#{m.id} — {m.tipo} — {new Date(m.fecha).toLocaleDateString()}</Typography>
                <Typography variant="body2" color="text.secondary">Materia #{m.materia_id} • {m.hora_desde || ''}{m.hora_hasta? ' - ' + m.hora_hasta : ''} • {m.aula || ''} • Cupo: {m.cupo}</Typography>
                <Stack direction="row" gap={1}>
                  <Button size="small" color="error" onClick={()=>eliminar(m.id)}>Eliminar</Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

