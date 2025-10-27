import React from 'react';
import { Box, Typography, Stack, Grid, Paper, TextField, MenuItem, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { client as api } from '@/api/client';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useTestMode } from '@/context/TestModeContext';
import { solicitarPedidoAnalitico } from '@/api/alumnos';

type Pedido = { dni:string; apellido_nombre:string; profesorado?:string; cohorte?:number; fecha_solicitud:string; motivo?: string; motivo_otro?: string };

export default function AnaliticosPage(){
  const { enabled: testMode } = useTestMode();
  const [ventanas, setVentanas] = React.useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = React.useState<string>('');
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dniFilter, setDniFilter] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<{dni:string; motivo:'equivalencia'|'beca'|'control'|'otro'; motivo_otro?:string; cohorte?:number|''}>({ dni:'', motivo:'equivalencia', motivo_otro:'', cohorte:'' });

  const loadVentanas = async()=>{
    try{
      const data = await fetchVentanas();
      const v = (data||[]).filter(v=> v.tipo === 'ANALITICOS');
      setVentanas(v);
      if (v.length) setVentanaId(String(v[0].id));
    }catch(err:any){ setError('No se pudieron cargar ventanas'); }
  };
  React.useEffect(()=>{ loadVentanas(); },[testMode]);

  const loadPedidos = async(id:number)=>{
    try{
      const { data } = await api.get<Pedido[]>(`/alumnos/analiticos_ext`, { params: { ventana_id: id, dni: dniFilter || undefined } });
      setPedidos(data||[]);
    }catch{ setPedidos([]); }
  };
  React.useEffect(()=>{ if(ventanaId) loadPedidos(Number(ventanaId)); },[ventanaId, dniFilter]);

  const [descargando, setDescargando] = React.useState(false);

  const descargarPDF = async ()=>{
    if (!ventanaId || testMode) return;
    try{
      setDescargando(true);
      setError(null);
      const params: Record<string, string> = { ventana_id: ventanaId };
      if (dniFilter) params.dni = dniFilter;
      const response = await api.get(`/alumnos/analiticos_ext/pdf`, { params, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = dniFilter ? `_${dniFilter}` : '';
      link.download = `analiticos_${ventanaId}${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }catch(err){
      setError('No se pudo descargar el PDF.');
    }finally{
      setDescargando(false);
    }
  };

  const crearPedido = async ()=>{
    if (testMode) {
      setError('Modo prueba activo: no se generan pedidos reales.');
      return;
    }
    try{
      const payload = {
        dni: form.dni || undefined,
        motivo: form.motivo,
        motivo_otro: form.motivo==='otro' ? (form.motivo_otro || undefined) : undefined,
        cohorte: typeof form.cohorte === 'number' ? form.cohorte : undefined,
      } as any;
      await solicitarPedidoAnalitico(payload);
      setCreating(false);
      if (ventanaId) await loadPedidos(Number(ventanaId));
    }catch(err:any){
      setError(err?.response?.data?.message || 'No se pudo crear el pedido');
    }
  }

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" fontWeight={800}>Pedidos de Analítico</Typography>
      <Typography variant="body2" color="text.secondary">Seleccione un periodo para ver y descargar en PDF</Typography>
      {testMode && <Alert severity="info" sx={{ mt:1 }}>Modo prueba activado: las ventanas se simulan temporalmente y no se guardan cambios en la base.</Alert>}
      {error && <Alert severity="error" sx={{ mt:1 }}>{error}</Alert>}
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:2 }}>
        <TextField select label="Periodo (Ventana)" size="small" value={ventanaId} onChange={(e)=>setVentanaId(e.target.value)} sx={{ minWidth: 260 }}>
          {ventanas.map(v=> (
            <MenuItem key={v.id} value={String(v.id)}>
              {new Date(v.desde).toLocaleDateString()} – {new Date(v.hasta).toLocaleDateString()} {v.activo?'[Activo]':''}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="DNI (opcional)" size="small" value={dniFilter} onChange={(e)=>setDniFilter(e.target.value)} sx={{ maxWidth: 200 }} />
        <Button variant="contained" onClick={descargarPDF} disabled={!ventanaId || testMode || descargando}>
          {descargando ? 'Generando...' : 'Descargar PDF'}
        </Button>
        <Button variant="outlined" onClick={()=>setCreating(true)} disabled={!ventanaId || testMode}>Nuevo pedido</Button>
      </Stack>

      <Grid container spacing={1.5} sx={{ mt:2 }}>
        {pedidos.map((p,i)=> (
          <Grid item xs={12} md={6} lg={4} key={i}>
            <Paper variant="outlined" sx={{ p:1.5 }}>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">{p.apellido_nombre} — {p.dni}</Typography>
                <Typography variant="body2" color="text.secondary">{p.profesorado || '-'} • Cohorte: {p.cohorte || '-'}</Typography>
                <Typography variant="caption" color="text.secondary">Solicitado: {new Date(p.fecha_solicitud).toLocaleString()}</Typography>
                {p.motivo && (
                  <Typography variant="caption" color="text.secondary">Motivo: {p.motivo === 'equivalencia' ? 'Pedido de equivalencia' : p.motivo === 'beca' ? 'Becas' : p.motivo === 'control' ? 'Control' : 'Otro'}{p.motivo === 'otro' && p.motivo_otro ? ` - ${p.motivo_otro}` : ''}</Typography>
                )}
              </Stack>
            </Paper>
          </Grid>
        ))}
        {!pedidos.length && (
          <Grid item xs={12}><Alert severity="info">No hay pedidos en el periodo seleccionado.</Alert></Grid>
        )}
      </Grid>

      <Dialog open={creating} onClose={()=>setCreating(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo pedido de analítico</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            <TextField label="DNI del estudiante" size="small" value={form.dni} onChange={(e)=>setForm(f=>({...f, dni:e.target.value}))} />
            <TextField select label="Motivo" size="small" value={form.motivo} onChange={(e)=>setForm(f=>({...f, motivo:e.target.value as any}))}>
              <MenuItem value="equivalencia">Pedido de equivalencia</MenuItem>
              <MenuItem value="beca">Becas</MenuItem>
              <MenuItem value="control">Control</MenuItem>
              <MenuItem value="otro">Otro</MenuItem>
            </TextField>
            {form.motivo==='otro' && (
              <TextField label="Detalle del motivo" size="small" value={form.motivo_otro || ''} onChange={(e)=>setForm(f=>({...f, motivo_otro:e.target.value}))} />
            )}
            <TextField label="Cohorte (año de ingreso)" size="small" type="number" value={form.cohorte || ''} onChange={(e)=>setForm(f=>({...f, cohorte: e.target.value? Number(e.target.value): ''}))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setCreating(false)}>Cancelar</Button>
          <Button variant="contained" onClick={crearPedido} disabled={!form.dni || testMode}>Crear</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
