import React, { useEffect, useMemo, useState } from 'react';
import { Button, TextField, Typography, Box, Alert, MenuItem, Select, FormControl, InputLabel, Grid, Paper, Stack } from '@mui/material';
import { listarMesas, inscribirMesa, obtenerHistorialAlumno, obtenerCarrerasActivas, TrayectoriaCarreraDetalleDTO, MesaListadoItemDTO } from '@/api/alumnos';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';

const MESA_TIPO_LABEL: Record<string, string> = {
  FIN: 'Ordinaria',
  EXT: 'Extraordinaria',
  ESP: 'Especial',
};

const getMesaTipoLabel = (tipo: string) => MESA_TIPO_LABEL[tipo] ?? tipo;

const MesaExamenPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user:null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles||[]).some((r:string)=> ['admin','secretaria','bedel'].includes((r||'').toLowerCase())));
  const [dni, setDni] = useState('');
  const [tipo, setTipo] = useState<'FIN'|'EXT'|'ESP'|''>('');
  const [modalidad, setModalidad] = useState<'REG'|'LIB'|''>('');
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [mesas, setMesas] = useState<MesaListadoItemDTO[]>([]);
  const [historial, setHistorial] = useState<{ aprobadas:number[]; regularizadas:number[]; inscriptas_actuales:number[] }>({ aprobadas:[], regularizadas:[], inscriptas_actuales:[] });
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const handleCarreraChange = (event: any) => {
    const value = String(event.target.value ?? '');
    setSelectedCarreraId(value);
    setSelectedPlanId('');
    setErr(null);
    setInfo(null);
  };

  const handlePlanChange = (event: any) => {
    setSelectedPlanId(String(event.target.value ?? ''));
    setErr(null);
    setInfo(null);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchVentanas();
        const v = (data || []).filter((x) => ['MESAS_FINALES', 'MESAS_EXTRA'].includes(x.tipo));
        setVentanas(v);
        if (v.length) setVentanaId(String(v[0].id));
      } catch (error) {
        console.warn("No se pudieron cargar las ventanas de mesas", error);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchCarreras = async () => {
      if (canGestionar && !dni.trim()) {
        setCarreras([]);
        setSelectedCarreraId('');
        setSelectedPlanId('');
        return;
      }
      setCarrerasLoading(true);
      try {
        const data = await obtenerCarrerasActivas(canGestionar ? (dni ? { dni } : undefined) : undefined);
        const list = data || [];
        if (!cancelled) {
          setCarreras(list);
          if (!list.length) {
            setSelectedCarreraId('');
            setSelectedPlanId('');
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
      setSelectedCarreraId('');
      setSelectedPlanId('');
      return;
    }
    if (selectedCarreraId) {
      const actual = carreras.find((c) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) {
        setSelectedCarreraId('');
        setSelectedPlanId('');
        return;
      }
      if (!selectedPlanId || !actual.planes.some((p) => String(p.id) === selectedPlanId)) {
        const preferido = actual.planes.find((p) => p.vigente) || actual.planes[0] || null;
        setSelectedPlanId(preferido ? String(preferido.id) : '');
      }
      return;
    }
    if (carreras.length === 1) {
      const unica = carreras[0];
      setSelectedCarreraId(String(unica.profesorado_id));
      const preferido = unica.planes.find((p) => p.vigente) || unica.planes[0] || null;
      setSelectedPlanId(preferido ? String(preferido.id) : '');
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

  useEffect(() => {
    let cancelled = false;
    const fetchMesas = async () => {
      if (carrerasLoading) return;
      if (canGestionar && !dni.trim()) {
        setMesas([]);
        setErr(null);
        setInfo(null);
        return;
      }
      if (requiereSeleccionCarrera || requiereSeleccionPlan) {
        setMesas([]);
        setErr(null);
        return;
      }
      try {
        const data = await listarMesas({
          tipo: tipo || undefined,
          modalidad: modalidad || undefined,
          ventana_id: ventanaId ? Number(ventanaId) : undefined,
          profesorado_id: selectedPlanIdNum ? undefined : selectedCarreraIdNum,
          plan_id: selectedPlanIdNum,
          dni: canGestionar ? (dni || undefined) : undefined,
        });
        if (!cancelled) {
          setMesas(data || []);
          setErr(null);
        }
      } catch (error: any) {
        const message = error?.response?.data?.message || 'No se pudieron cargar las mesas.';
        if (!cancelled) {
          setErr(message);
          setMesas([]);
        }
      }
    };
    fetchMesas();
    return () => {
      cancelled = true;
    };
  }, [
    carrerasLoading,
    requiereSeleccionCarrera,
    requiereSeleccionPlan,
    selectedCarreraIdNum,
    selectedPlanIdNum,
    tipo,
    modalidad,
    ventanaId,
    canGestionar,
    dni,
  ]);

  
useEffect(() => {
  (async () => {
    try {
      const h = await obtenerHistorialAlumno(canGestionar && dni ? { dni } : undefined);
      setHistorial({
        aprobadas: h.aprobadas || [],
        regularizadas: h.regularizadas || [],
        inscriptas_actuales: h.inscriptas_actuales || [],
      });
    } catch (error) {
      console.warn("No se pudo obtener el historial del alumno", error);
    }
  })();
}, [dni, canGestionar]);

  const onInscribir = async (mesaId:number)=>{
    try{
      const res = await inscribirMesa({ mesa_id: mesaId, dni: canGestionar ? (dni||undefined) : undefined });
      setInfo(res.message);
      setErr(null);
    }catch(e:any){
      const data = e?.response?.data;
      let message = typeof data === 'string' ? data : data?.message || data?.detail || e?.message || 'No se pudo inscribir';
      if (data?.faltantes?.length) {
        message = `${message}: ${data.faltantes.join(', ')}`;
      }
      setErr(message);
      setInfo(null);
    }
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
            <MenuItem value="FIN">Ordinaria</MenuItem>
            <MenuItem value="EXT">Extraordinaria</MenuItem>
            <MenuItem value="ESP">Especial</MenuItem>
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
                {new Date(v.desde).toLocaleDateString()} - {new Date(v.hasta).toLocaleDateString()} ({v.tipo === 'MESAS_FINALES' ? 'Ordinarias' : 'Extraordinarias'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }} disabled={carrerasLoading || (canGestionar && !dni.trim() && carreras.length === 0)}>
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
          <FormControl size="small" sx={{ minWidth: 220 }}>
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
        {canGestionar && (
          <TextField size="small" label="DNI estudiante (opcional)" value={dni} onChange={(e)=>setDni(e.target.value)} />
        )}
      </Stack>

      {canGestionar && !dni.trim() && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ingresa un DNI para gestionar las mesas de un estudiante.
        </Alert>
      )}
      {requiereSeleccionCarrera && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona un profesorado para ver las mesas disponibles.
        </Alert>
      )}
      {requiereSeleccionPlan && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona un plan de estudios para filtrar las mesas.
        </Alert>
      )}

      <Grid container spacing={1.5}>
        <>
          {mesas.filter((mesa) => {
            const reqAPR: number[] = mesa.correlativas_aprob || [];
            const tieneAPR = reqAPR.every((id) => historial.aprobadas.includes(id));
            if (!tieneAPR) return false;
            const materiaId = mesa.materia?.id ?? mesa.materia_id;
            if (mesa.modalidad === 'REG') {
              return historial.regularizadas.includes(materiaId);
            }
            const estaRegular = historial.regularizadas.includes(materiaId);
            const cursando = historial.inscriptas_actuales.includes(materiaId);
            return !estaRegular && !cursando;
          }).map((mesa) => (
            <Grid item xs={12} md={6} lg={4} key={mesa.id}>
              <Paper variant="outlined" sx={{ p:1.5 }}>
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">{mesa.materia?.nombre ?? mesa.materia_nombre} - {getMesaTipoLabel(mesa.tipo)} ({mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'})</Typography>
                  <Typography variant="body2" color="text.secondary">{new Date(mesa.fecha).toLocaleDateString()} {mesa.hora_desde ? (mesa.hora_desde + (mesa.hora_hasta? ' - ' + mesa.hora_hasta : '')) : ''} - {mesa.aula || ''}</Typography>
                  {mesa.codigo && (
                    <Typography variant="caption" color="text.secondary">
                      Código: {mesa.codigo}
                    </Typography>
                  )}
                  <Button size="small" variant="contained" onClick={()=>onInscribir(mesa.id)}>Inscribirme</Button>
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
