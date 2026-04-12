import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { formatDate } from '@/utils/date';
import { listarMesas, inscribirMesa, bajaMesa, obtenerHistorialEstudiante, obtenerCarrerasActivas, obtenerTrayectoriaEstudiante, TrayectoriaCarreraDetalleDTO, MesaListadoItemDTO, TrayectoriaMesaDTO } from '@/api/estudiantes';
import { hasAnyRole } from '@/utils/roles';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';
import BackButton from '@/components/ui/BackButton';
import FinalConfirmationDialog from '@/components/ui/FinalConfirmationDialog';

const MESA_TIPO_LABEL: Record<string, string> = {
  FIN: 'Ordinaria',
  EXT: 'Extraordinaria',
  ESP: 'Especial',
};

const getMesaTipoLabel = (tipo: string) => MESA_TIPO_LABEL[tipo] ?? tipo;

const MesaExamenPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dniParam = searchParams.get('dni');
  const canGestionar = hasAnyRole(user, ['admin', 'secretaria', 'bedel']);
  const isEstudiante = hasAnyRole(user, ['estudiante']);
  const initialDni = dniParam || (isEstudiante && !canGestionar ? user?.dni || '' : '');

  const [dni, setDni] = useState(initialDni);
  const [tipo, setTipo] = useState<'FIN' | 'EXT' | 'ESP' | ''>('');
  const [modalidad, setModalidad] = useState<'REG' | 'LIB' | ''>('');
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [mesas, setMesas] = useState<MesaListadoItemDTO[]>([]);
  const [historial, setHistorial] = useState<{ aprobadas: number[]; regularizadas: number[]; inscriptas_actuales: number[] }>({ aprobadas: [], regularizadas: [], inscriptas_actuales: [] });
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [pendingInscripcion, setPendingInscripcion] = useState<{ mesa: MesaListadoItemDTO } | null>(null);
  const [pendingBaja, setPendingBaja] = useState<{ mesaId: number; materiaNombre: string } | null>(null);
  const [inscribiendoId, setInscribiendoId] = useState<number | null>(null);
  const [misInscripciones, setMisInscripciones] = useState<TrayectoriaMesaDTO[]>([]);
  const [loadingTrayectoria, setLoadingTrayectoria] = useState(false);

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
      const actual = carreras.find((c: any) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) {
        setSelectedCarreraId('');
        setSelectedPlanId('');
        return;
      }
      if (!selectedPlanId || !actual.planes.some((p: any) => String(p.id) === selectedPlanId)) {
        const preferido = actual.planes.find((p: any) => p.vigente) || actual.planes[0] || null;
        setSelectedPlanId(preferido ? String(preferido.id) : '');
      }
      return;
    }
    if (carreras.length === 1) {
      const unica = carreras[0];
      setSelectedCarreraId(String(unica.profesorado_id));
      const preferido = unica.planes.find((p: any) => p.vigente) || unica.planes[0] || null;
      setSelectedPlanId(preferido ? String(preferido.id) : '');
    }
  }, [carreras, carrerasLoading, selectedCarreraId, selectedPlanId]);

  const planesDisponibles = useMemo(() => {
    if (!selectedCarreraId) return [];
    const carrera = carreras.find((c: any) => String(c.profesorado_id) === selectedCarreraId);
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


  const fetchTrayectoria = async () => {
    setLoadingTrayectoria(true);
    try {
      const t = await obtenerTrayectoriaEstudiante(canGestionar && dni ? { dni } : undefined);
      setMisInscripciones((t.mesas || []).filter(m => m.estado === 'INSCRIPTO'));
    } catch (error) {
      console.warn("No se pudo obtener la trayectoria del estudiante", error);
    } finally {
      setLoadingTrayectoria(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const h = await obtenerHistorialEstudiante(canGestionar && dni ? { dni } : undefined);
        setHistorial({
          aprobadas: h.aprobadas || [],
          regularizadas: h.regularizadas || [],
          inscriptas_actuales: h.inscriptas_actuales || [],
        });
        await fetchTrayectoria();
      } catch (error) {
        console.warn("No se pudo obtener el historial del estudiante", error);
      }
    })();
  }, [dni, canGestionar]);

  const handleOpenInscripcionConfirm = (mesa: MesaListadoItemDTO) => {
    setPendingInscripcion({ mesa });
  };

  const handleCancelInscripcionConfirm = () => {
    if (inscribiendoId !== null) return;
    setPendingInscripcion(null);
  };

  const handleConfirmInscripcion = async () => {
    if (!pendingInscripcion) return;
    const mesaId = pendingInscripcion.mesa.id;
    setInscribiendoId(mesaId);
    try {
      const res = await inscribirMesa({ mesa_id: mesaId, dni: canGestionar ? (dni || undefined) : undefined });
      setInfo(res.message);
      setErr(null);
      setPendingInscripcion(null);
    } catch (e: any) {
      const data = e?.response?.data;
      let message = typeof data === 'string' ? data : data?.message || data?.detail || e?.message || 'No se pudo inscribir';
      if (data?.faltantes?.length) {
        message = `${message}: ${data.faltantes.join(', ')}`;
      }
      setErr(message);
      setInfo(null);
    } finally {
      setInscribiendoId(null);
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/estudiantes" />
      <Typography variant="h4" gutterBottom>Mesas de Examen</Typography>
      <Typography variant="body1" paragraph>Inscribite a mesas habilitadas. Evita superposición y respeta correlatividades.</Typography>
      {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="FIN">Ordinaria</MenuItem>
            <MenuItem value="EXT">Extraordinaria</MenuItem>
            <MenuItem value="ESP">Especial</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Modalidad</InputLabel>
          <Select label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value as any)}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="REG">Regulares</MenuItem>
            <MenuItem value="LIB">Libres</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Periodo</InputLabel>
          <Select label="Periodo" value={ventanaId} onChange={(e) => setVentanaId(e.target.value)}>
            {ventanas.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {formatDate(v.desde)} - {formatDate(v.hasta)} ({v.tipo === 'MESAS_FINALES' ? 'Ordinarias' : 'Extraordinarias'})
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
          <TextField size="small" label="DNI estudiante (opcional)" value={dni} onChange={(e) => setDni(e.target.value)} />
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

      {misInscripciones.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" color="primary" gutterBottom sx={{ fontWeight: 600 }}>Mis inscripciones activas</Typography>
          <Grid container spacing={1.5}>
            {misInscripciones.map((mi) => (
              <Grid item xs={12} md={6} lg={4} key={mi.id}>
                <Paper variant="outlined" sx={{ p: 1.5, borderLeft: '6px solid #B7694E' }}>
                  <Stack gap={0.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{mi.materia_nombre}</Typography>
                    <Typography variant="body2">{mi.tipo_display} | {formatDate(mi.fecha)}</Typography>
                    <Button 
                      size="small" 
                      color="error" 
                      variant="outlined" 
                      onClick={() => setPendingBaja({ mesaId: mi.mesa_id, materiaNombre: mi.materia_nombre })}
                      disabled={inscribiendoId !== null}
                    >
                      Anular inscripción
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Catálogo de mesas disponibles</Typography>
      <Grid container spacing={1.5}>
        <>
          {mesas.filter((mesa) => {
            const reqAPR: number[] = mesa.correlativas_aprob || [];
            const tieneAPR = reqAPR.every((id) => historial.aprobadas.includes(id));
            if (!tieneAPR) return false;
            
            // Si ya está inscripto en ESTA mesa específica, no mostrarla en el catálogo de "pendientes"
            if (misInscripciones.some(mi => mi.mesa_id === mesa.id)) return false;

            const materiaId = mesa.materia?.id ?? mesa.materia_id;
            if (mesa.modalidad === 'REG') {
              return historial.regularizadas.includes(materiaId);
            }
            const estaRegular = historial.regularizadas.includes(materiaId);
            const cursando = historial.inscriptas_actuales.includes(materiaId);
            return !estaRegular && !cursando;
          }).map((mesa) => (
            <Grid item xs={12} md={6} lg={4} key={mesa.id}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">{mesa.materia?.nombre ?? mesa.materia_nombre} - {getMesaTipoLabel(mesa.tipo)} ({mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'})</Typography>
                  <Typography variant="body2" color="text.secondary">{formatDate(mesa.fecha)} {mesa.hora_desde ? (mesa.hora_desde + (mesa.hora_hasta ? ' - ' + mesa.hora_hasta : '')) : ''} - {mesa.aula || ''}</Typography>
                  {mesa.codigo && (
                    <Typography variant="caption" color="text.secondary">
                      Código: {mesa.codigo}
                    </Typography>
                  )}
                  <Button size="small" variant="contained" onClick={() => handleOpenInscripcionConfirm(mesa)} disabled={inscribiendoId === mesa.id}>Inscribirme</Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
          {!mesas.length && (
            <Grid item xs={12}><Alert severity="info">No hay mesas disponibles con los filtros seleccionados.</Alert></Grid>
          )}
        </>
      </Grid>
      <FinalConfirmationDialog
        open={Boolean(pendingInscripcion)}
        onConfirm={handleConfirmInscripcion}
        onCancel={handleCancelInscripcionConfirm}
        contextText={
          pendingInscripcion
            ? `inscripción a la mesa de ${pendingInscripcion.mesa.materia?.nombre ?? pendingInscripcion.mesa.materia_nombre}`
            : "inscripción seleccionada"
        }
        loading={inscribiendoId !== null}
      />

      <FinalConfirmationDialog
        open={Boolean(pendingBaja)}
        onConfirm={async () => {
          if (!pendingBaja) return;
          setInscribiendoId(pendingBaja.mesaId);
          try {
            const res = await bajaMesa({ mesa_id: pendingBaja.mesaId, dni: canGestionar ? (dni || undefined) : undefined });
            setInfo(res.message);
            setErr(null);
            setPendingBaja(null);
            await fetchTrayectoria();
          } catch (e: any) {
             const message = e?.response?.data?.message || 'No se pudo anular la inscripción. Verificá que falten más de 48hs hábiles.';
             setErr(message);
          } finally {
            setInscribiendoId(null);
          }
        }}
        onCancel={() => setPendingBaja(null)}
        contextText={
          pendingBaja
            ? `anulación definitiva de tu inscripción a la mesa de ${pendingBaja.materiaNombre}`
            : "baja seleccionada"
        }
        loading={inscribiendoId !== null}
        confirmColor="error"
        confirmLabel="Anular Inscripción"
      />
    </Box>
  );
};

export default MesaExamenPage;
