import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, Stack, TextField, MenuItem, Button } from '@mui/material';
import { solicitarPedidoAnalitico } from '@/api/alumnos';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';
import { useTestMode } from '@/context/TestModeContext';

const PedidoAnaliticoPage: React.FC = () => {
  const { enabled: testMode } = useTestMode();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = (useAuth?.() ?? { user:null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles||[]).some((r:string)=> ['admin','secretaria','bedel','tutor'].includes((r||'').toLowerCase())));

  const [ventanaActiva, setVentanaActiva] = useState<VentanaDto | null>(null);
  const [motivo, setMotivo] = useState<'equivalencia'|'beca'|'control'|'otro'>('equivalencia');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [dni, setDni] = useState('');
  const [cohorte, setCohorte] = useState<number|''>('');

  useEffect(()=>{
    (async()=>{
      try{
        const data = await fetchVentanas({ tipo: 'ANALITICOS' });
        const v = (data || []).find((x) => x.activo);
        setVentanaActiva(v || null);
      }catch{
        setVentanaActiva(null);
      }
    })();
  },[testMode]);

  const handleSubmit = async () => {
    try {
      const response = await solicitarPedidoAnalitico({
        motivo,
        motivo_otro: motivo==='otro'?motivoOtro:undefined,
        dni: canGestionar ? (dni || undefined) : undefined,
        cohorte: typeof cohorte==='number'?cohorte:undefined,
      });
      setMessage(response.message);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al solicitar pedido de analítico.');
      setMessage(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Solicitud de Pedido de Analítico</Typography>
      <Typography variant="body1" paragraph>Completa el motivo del pedido. Si hay periodo activo podrás enviar la solicitud.</Typography>
      {testMode && <Alert severity="info" sx={{ mb:2 }}>Modo prueba: las habilitaciones se simulan sin tocar la base de datos.</Alert>}
      {!ventanaActiva && (<Alert severity="warning" sx={{ mb:2 }}>No hay periodo activo para pedido de analítico.</Alert>)}

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack gap={2} sx={{ maxWidth: 480, mb:2 }}>
        {canGestionar && (
          <TextField label="DNI del estudiante (opcional)" size="small" value={dni} onChange={(e)=>setDni(e.target.value)} />
        )}
        <TextField select label="Motivo" size="small" value={motivo} onChange={(e)=>setMotivo(e.target.value as any)}>
          <MenuItem value="equivalencia">Pedido de equivalencia</MenuItem>
          <MenuItem value="beca">Becas</MenuItem>
          <MenuItem value="control">Control</MenuItem>
          <MenuItem value="otro">Otro</MenuItem>
        </TextField>
        {motivo==='otro' && (
          <TextField label="Detalle del motivo" size="small" value={motivoOtro} onChange={(e)=>setMotivoOtro(e.target.value)} />
        )}
        <TextField label="Cohorte (año de ingreso)" size="small" type="number" value={cohorte} onChange={(e)=> setCohorte(e.target.value? Number(e.target.value): '')} />
      </Stack>
      <Button variant="contained" onClick={handleSubmit} disabled={!ventanaActiva}>Enviar Solicitud</Button>
    </Box>
  );
};

export default PedidoAnaliticoPage;
