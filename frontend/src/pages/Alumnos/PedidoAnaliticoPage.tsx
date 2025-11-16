import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Alert, Stack, TextField, MenuItem, Button, Select, FormControl, InputLabel } from '@mui/material';
import BackButton from '@/components/ui/BackButton';
import { solicitarPedidoAnalitico, obtenerCarrerasActivas, TrayectoriaCarreraDetalleDTO } from '@/api/alumnos';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';

const PedidoAnaliticoPage: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = (useAuth?.() ?? { user:null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles||[]).some((r:string)=> ['admin','secretaria','bedel','tutor'].includes((r||'').toLowerCase())));

  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>();
  const [selectedPlanId, setSelectedPlanId] = useState<string>();

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
  },[]);

  useEffect(() => {
    let cancelled = false;
    const fetchCarreras = async () => {
      setMessage(null);
      setError(null);
      if (canGestionar && !dni.trim()) {
        setCarreras([]);
        setSelectedCarreraId("");
        setSelectedPlanId("");
        return;
      }
      setCarrerasLoading(true);
      try {
        const data = await obtenerCarrerasActivas(canGestionar ? (dni ? { dni } : undefined) : undefined);
        const list = data || [];
        if (!cancelled) {
          setCarreras(list);
          if (!list.length) {
            setSelectedCarreraId("");
            setSelectedPlanId("");
          }
        }
      } catch {
        if (!cancelled) {
          setCarreras([]);
        }
      } finally {
        if (!cancelled) {
          setCarrerasLoading(false);
        }
      }
    };
    fetchCarreras();
    return () => {
      cancelled = true;
    };
  }, [canGestionar, dni]);

  useEffect(() => {
    if (carrerasLoading) return;
    if (!carreras.length) {
      setSelectedCarreraId("");
      setSelectedPlanId("");
      return;
    }
    if (selectedCarreraId) {
      const actual = carreras.find((c) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) {
        setSelectedCarreraId("");
        setSelectedPlanId("");
        return;
      }
      if (!selectedPlanId || !actual.planes.some((p) => String(p.id) === selectedPlanId)) {
        const preferido = actual.planes.find((p) => p.vigente) || actual.planes[0] || null;
        setSelectedPlanId(preferido ? String(preferido.id) : "");
      }
      return;
    }
    if (carreras.length === 1) {
      const unica = carreras[0];
      setSelectedCarreraId(String(unica.profesorado_id));
      const preferido = unica.planes.find((p) => p.vigente) || unica.planes[0] || null;
      setSelectedPlanId(preferido ? String(preferido.id) : "");
    }
  }, [carreras, carrerasLoading, selectedCarreraId, selectedPlanId]);

  const planesDisponibles = useMemo(() => {
    if (!selectedCarreraId) return [];
    const carrera = carreras.find((c) => String(c.profesorado_id) === selectedCarreraId);
    return carrera ? carrera.planes : [];
  }, [carreras, selectedCarreraId]);

  const selectedCarreraIdNum = selectedCarreraId ? Number(selectedCarreraId) : undefined;
  const selectedPlanIdNum = selectedPlanId ? Number(selectedPlanId) : undefined;
  const requiereSeleccionCarrera = !carrerasLoading && carreras.length > 1 && !selectedCarreraId;
  const requiereSeleccionPlan = !carrerasLoading && planesDisponibles.length > 1 && !selectedPlanId;
  const puedeEnviar = Boolean(ventanaActiva) && !requiereSeleccionCarrera && !requiereSeleccionPlan && !(canGestionar && !dni.trim());

  const handleCarreraChange = (event: any) => {
    const value = String(event.target.value ?? "");
    setSelectedCarreraId(value);
    setSelectedPlanId("");
    setError(null);
    setMessage(null);
  };

  const handlePlanChange = (event: any) => {
    setSelectedPlanId(String(event.target.value ?? ""));
    setError(null);
    setMessage(null);
  };


  const handleSubmit = async () => {
    if (!puedeEnviar) {
      return;
    }
    try {
      const response = await solicitarPedidoAnalitico({
        motivo,
        motivo_otro: motivo==='otro'?motivoOtro:undefined,
        dni: canGestionar ? (dni || undefined) : undefined,
        cohorte: typeof cohorte==='number'?cohorte:undefined,
        profesorado_id: selectedPlanIdNum ? undefined : selectedCarreraIdNum,
        plan_id: selectedPlanIdNum,
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
      <BackButton fallbackPath="/alumnos" />
      <Typography variant="h4" gutterBottom>Solicitud de Pedido de Analítico</Typography>
      <Typography variant="body1" paragraph>Completa el motivo del pedido. Si hay periodo activo podrás enviar la solicitud.</Typography>
      {!ventanaActiva && (<Alert severity="warning" sx={{ mb:2 }}>No hay periodo activo para pedido de analítico.</Alert>)}

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack gap={2} sx={{ maxWidth: 480, mb:2 }}>
        {canGestionar && (
          <TextField label="DNI del estudiante (opcional)" size="small" value={dni} onChange={(e)=>setDni(e.target.value)} />
        )}
        <FormControl size="small" disabled={carrerasLoading || (canGestionar && !dni.trim() && carreras.length === 0)}>
          <InputLabel>Profesorado</InputLabel>
          <Select label="Profesorado" value={selectedCarreraId} onChange={handleCarreraChange} displayEmpty>
            {carrerasLoading && <MenuItem value="">Cargando...</MenuItem>}
            {!carrerasLoading && !carreras.length && <MenuItem value="">Sin profesorados</MenuItem>}
            {carreras.map((carrera) => (
              <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                {carrera.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {planesDisponibles.length > 1 && (
          <FormControl size="small">
            <InputLabel>Plan</InputLabel>
            <Select label="Plan" value={selectedPlanId} onChange={handlePlanChange} displayEmpty>
              {planesDisponibles.map((plan) => (
                <MenuItem key={plan.id} value={String(plan.id)}>
                  {plan.resolucion ? `Plan ${plan.resolucion}` : `Plan ${plan.id}`}
                  {plan.vigente ? ' (vigente)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
      {canGestionar && !dni.trim() && (
        <Alert severity="info" sx={{ maxWidth: 480, mb: 2 }}>
          Ingresa un DNI para solicitar el analítico de un estudiante.
        </Alert>
      )}
      {requiereSeleccionCarrera && (
        <Alert severity="info" sx={{ maxWidth: 480, mb: 2 }}>
          Selecciona un profesorado antes de continuar.
        </Alert>
      )}
      {requiereSeleccionPlan && (
        <Alert severity="info" sx={{ maxWidth: 480, mb: 2 }}>
          Selecciona un plan de estudios para el pedido.
        </Alert>
      )}
      <Button variant="contained" onClick={handleSubmit} disabled={!puedeEnviar}>Enviar Solicitud</Button>
    </Box>
  );
};

export default PedidoAnaliticoPage;
