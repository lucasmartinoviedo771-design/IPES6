import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Divider from "@mui/material/Divider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Container from "@mui/material/Container";

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SendIcon from '@mui/icons-material/Send';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';

import { formatDate } from '@/utils/date';
import {
  listarMesas, inscribirMesa, bajaMesa,
  obtenerHistorialEstudiante, obtenerCarrerasActivas,
  obtenerTrayectoriaEstudiante,
  solicitarMesa, listarMisSolicitudes,
  TrayectoriaCarreraDetalleDTO, MesaListadoItemDTO, TrayectoriaMesaDTO,
  SolicitudMesaOutDTO,
} from '@/api/estudiantes';
import { CartonMateriaDTO } from '@/api/estudiantes/types';
import { hasAnyRole } from '@/utils/roles';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';
import BackButton from '@/components/ui/BackButton';

const MESA_TIPO_LABEL: Record<string, string> = {
  FIN: 'Ordinaria', EXT: 'Extraordinaria', ESP: 'Especial',
};

function calcularMotivoBloqueo(
  mesa: MesaListadoItemDTO,
  historial: { aprobadas: number[]; regularizadas: number[]; inscriptas_actuales: number[] },
  failedAttempts: Map<number, string>,
): string {
  if (failedAttempts.has(mesa.id)) return failedAttempts.get(mesa.id)!;
  const materiaId = mesa.materia?.id ?? mesa.materia_id;
  const reqAPR: number[] = mesa.correlativas_aprob || [];
  if (!reqAPR.every(id => historial.aprobadas.includes(id))) return 'Faltan correlativas aprobadas';
  if (mesa.modalidad === 'REG' && !historial.regularizadas.includes(materiaId)) return 'Sin regularidad vigente';
  if (mesa.modalidad === 'LIB') {
    if (historial.inscriptas_actuales.includes(materiaId)) return 'Cursando actualmente';
    if (historial.regularizadas.includes(materiaId)) return 'Tiene regularidad → inscribirse en Regular';
  }
  return 'No habilitada';
}

function getMotivoColor(motivo: string): 'warning' | 'error' | 'default' {
  if (motivo.includes('correlativa') || motivo.includes('regularidad') || motivo.includes('Regular')) return 'warning';
  if (motivo.includes('agotado') || motivo.includes('aprobada') || motivo.includes('superada')) return 'error';
  return 'default';
}

const MesaExamenPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dniParam = searchParams.get('dni');
  const canGestionar = hasAnyRole(user, ['admin', 'secretaria', 'bedel']);
  const isEstudiante = hasAnyRole(user, ['estudiante']);
  const initialDni = dniParam || (isEstudiante && !canGestionar ? user?.dni || '' : '');

  const [activeTab, setActiveTab] = useState(0);
  const [dni, setDni] = useState(initialDni);
  const [dniBusqueda, setDniBusqueda] = useState(initialDni);
  const [tipo, setTipo] = useState<'FIN' | 'EXT' | 'ESP' | ''>('');
  const [modalidad, setModalidad] = useState<'REG' | 'LIB' | ''>('');
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [mesas, setMesas] = useState<MesaListadoItemDTO[]>([]);
  const [historial, setHistorial] = useState<{ aprobadas: number[]; regularizadas: number[]; inscriptas_actuales: number[] }>({ aprobadas: [], regularizadas: [], inscriptas_actuales: [] });
  const [materiasAprobadas, setMateriasAprobadas] = useState<CartonMateriaDTO[]>([]);
  const [materiasPlan, setMateriasPlan] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedCarreraId, setSelectedCarreraId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [pendingInscripcion, setPendingInscripcion] = useState<{ mesa: MesaListadoItemDTO } | null>(null);
  const [pendingBaja, setPendingBaja] = useState<{ mesaId: number; materiaNombre: string } | null>(null);
  const [inscribiendoId, setInscribiendoId] = useState<number | null>(null);
  const [misInscripciones, setMisInscripciones] = useState<TrayectoriaMesaDTO[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(false);
  const [loadingTrayectoria, setLoadingTrayectoria] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<Map<number, string>>(new Map());
  const [solicitudes, setSolicitudes] = useState<SolicitudMesaOutDTO[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [pendingSolicitud, setPendingSolicitud] = useState<{ materia_id: number; materia_nombre: string } | null>(null);
  const [solicitando, setSolicitando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchVentanas();
        const v = (data || []).filter((x) => ['MESAS_FINALES', 'MESAS_EXTRA'].includes(x.tipo));
        setVentanas(v);
        // Si hay una ventana activa de tipo EXTRA, seleccionarla por defecto
        const extra = v.find(x => x.tipo === 'MESAS_EXTRA');
        if (extra) setVentanaId(String(extra.id));
      } catch (error) {
        console.warn("No se pudieron cargar las ventanas", error);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchCarreras = async () => {
      if (canGestionar && !dniBusqueda.trim()) {
        setCarreras([]); setSelectedCarreraId(''); setSelectedPlanId(''); return;
      }
      setCarrerasLoading(true);
      try {
        const data = await obtenerCarrerasActivas(canGestionar ? (dniBusqueda ? { dni: dniBusqueda } : undefined) : undefined);
        if (!cancelled) {
          setCarreras(data || []);
          if (!(data || []).length) { setSelectedCarreraId(''); setSelectedPlanId(''); }
        }
      } catch {
        if (!cancelled) setCarreras([]);
      } finally {
        if (!cancelled) setCarrerasLoading(false);
      }
    };
    fetchCarreras();
    return () => { cancelled = true; };
  }, [canGestionar, dniBusqueda]);

  useEffect(() => {
    if (carrerasLoading) return;
    if (!carreras.length) { setSelectedCarreraId(''); setSelectedPlanId(''); return; }
    if (selectedCarreraId) {
      const actual = carreras.find((c: any) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) { setSelectedCarreraId(''); setSelectedPlanId(''); return; }
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
      if (carrerasLoading || requiereSeleccionCarrera || requiereSeleccionPlan) { setMesas([]); return; }
      if (canGestionar && !dniBusqueda.trim()) { setMesas([]); return; }
      setLoadingMesas(true);
      try {
        const data = await listarMesas({
          tipo: tipo || undefined,
          ventana_id: ventanaId ? Number(ventanaId) : undefined,
          profesorado_id: selectedPlanIdNum ? undefined : selectedCarreraIdNum,
          plan_id: selectedPlanIdNum,
          dni: canGestionar ? (dniBusqueda || undefined) : undefined,
          solo_rendibles: !canGestionar || (canGestionar && !!dniBusqueda.trim()),
        });
        if (!cancelled) { setMesas(data || []); setErr(null); }
      } catch (error: any) {
        if (!cancelled) { setErr(error?.response?.data?.message || 'No se pudieron cargar las mesas.'); setMesas([]); }
      } finally {
        if (!cancelled) setLoadingMesas(false);
      }
    };
    fetchMesas();
    return () => { cancelled = true; };
  }, [carrerasLoading, requiereSeleccionCarrera, requiereSeleccionPlan, selectedCarreraIdNum, selectedPlanIdNum, tipo, ventanaId, canGestionar, dniBusqueda]);

  const fetchTrayectoria = async () => {
    if (canGestionar && !dniBusqueda.trim()) { setMisInscripciones([]); setMateriasAprobadas([]); setMateriasPlan([]); return; }
    setLoadingTrayectoria(true);
    try {
      const t = await obtenerTrayectoriaEstudiante(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
      setMisInscripciones((t.mesas || []).filter(m => m.estado === 'INS'));
      
      const aprobadas: CartonMateriaDTO[] = [];
      const planMaterias: any[] = [];
      for (const plan of t.carton || []) {
        for (const mat of plan.materias || []) {
          planMaterias.push(mat);
          if (mat.final?.condicion === 'APR') aprobadas.push(mat);
        }
      }
      setMateriasAprobadas(aprobadas);
      setMateriasPlan(planMaterias);
    } catch (error) {
      console.warn("No se pudo obtener la trayectoria", error);
    } finally {
      setLoadingTrayectoria(false);
    }
  };

  const fetchSolicitudes = async () => {
    if (canGestionar && !dniBusqueda.trim()) { setSolicitudes([]); return; }
    setLoadingSolicitudes(true);
    try {
      const data = await listarMisSolicitudes(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
      setSolicitudes(data || []);
    } catch (error) {
      console.warn("No se pudieron obtener las solicitudes", error);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (canGestionar && !dniBusqueda.trim()) {
        setHistorial({ aprobadas: [], regularizadas: [], inscriptas_actuales: [] });
        return;
      }
      try {
        const h = await obtenerHistorialEstudiante(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
        setHistorial({ aprobadas: h.aprobadas || [], regularizadas: h.regularizadas || [], inscriptas_actuales: h.inscriptas_actuales || [] });
        await fetchTrayectoria();
        await fetchSolicitudes();
      } catch (error) {
        console.warn("No se pudo obtener el historial", error);
      }
    })();
  }, [dniBusqueda, canGestionar]);

  const agruparPorLlamado = (lista: MesaListadoItemDTO[]) => {
    const fechasUnicas = [...new Set(lista.map(m => m.fecha))].sort();
    if (fechasUnicas.length <= 1) return [{ llamado: 'Llamado Único', fecha: fechasUnicas[0] ?? '', mesas: lista }];
    return fechasUnicas.map((fecha, idx) => ({
      llamado: idx === 0 ? 'Primer Llamado' : idx === 1 ? 'Segundo Llamado' : `${idx + 1}º Llamado`,
      fecha,
      mesas: lista.filter(m => m.fecha === fecha),
    }));
  };

  const { mesasDisponibles, mesasBloqueadas } = useMemo(() => {
    const disponibles: MesaListadoItemDTO[] = [];
    const bloqueadas: Array<{ mesa: MesaListadoItemDTO; motivo: string }> = [];
    for (const mesa of mesas) {
      if (misInscripciones.some(mi => mi.mesa_id === mesa.id)) continue;
      const materiaId = mesa.materia?.id ?? mesa.materia_id;
      if (historial.aprobadas.includes(materiaId)) continue;
      const reqAPR: number[] = mesa.correlativas_aprob || [];
      let esDisponible = reqAPR.every(id => historial.aprobadas.includes(id));
      if (esDisponible && mesa.modalidad === 'REG') esDisponible = historial.regularizadas.includes(materiaId);
      if (esDisponible && mesa.modalidad === 'LIB') {
        esDisponible = !historial.regularizadas.includes(materiaId) && !historial.inscriptas_actuales.includes(materiaId);
      }
      if (esDisponible && modalidad && mesa.modalidad !== modalidad) esDisponible = false;
      if (esDisponible && failedAttempts.has(mesa.id)) esDisponible = false;

      if (esDisponible) {
        disponibles.push(mesa);
      } else {
        bloqueadas.push({ mesa, motivo: calcularMotivoBloqueo(mesa, historial, failedAttempts) });
      }
    }
    return { mesasDisponibles: disponibles, mesasBloqueadas: bloqueadas };
  }, [mesas, historial, misInscripciones, failedAttempts, modalidad]);

  const handleConfirmInscripcion = async () => {
    if (!pendingInscripcion) return;
    const mesa = pendingInscripcion.mesa;
    setInscribiendoId(mesa.id);
    try {
      const res = await inscribirMesa({ mesa_id: mesa.id, dni: canGestionar ? (dniBusqueda || undefined) : undefined });
      setInfo(res.message);
      setErr(null);
      setPendingInscripcion(null);
      await fetchTrayectoria();
    } catch (e: any) {
      const data = e?.response?.data;
      let message = typeof data === 'string' ? data : data?.message || data?.detail || e?.message || 'No se pudo inscribir';
      if (data?.faltantes?.length) message = `${message}: ${data.faltantes.join(', ')}`;
      setFailedAttempts(prev => new Map(prev).set(mesa.id, message));
      setErr(message);
      setInfo(null);
      setPendingInscripcion(null);
      setActiveTab(3);
    } finally {
      setInscribiendoId(null);
    }
  };

  const handleConfirmBaja = async () => {
    if (!pendingBaja) return;
    setInscribiendoId(pendingBaja.mesaId);
    try {
      const res = await bajaMesa({ mesa_id: pendingBaja.mesaId, dni: canGestionar ? (dniBusqueda || undefined) : undefined });
      setInfo(res.message);
      setErr(null);
      setPendingBaja(null);
      await fetchTrayectoria();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'No se pudo anular la inscripción.');
    } finally {
      setInscribiendoId(null);
    }
  };

  const handleConfirmSolicitud = async () => {
    if (!pendingSolicitud || !ventanaId) return;
    setSolicitando(true);
    try {
      const res = await solicitarMesa({
        materia_id: pendingSolicitud.materia_id,
        ventana_id: Number(ventanaId),
        dni: canGestionar ? (dniBusqueda || undefined) : undefined
      });
      setInfo(res.message);
      setErr(null);
      setPendingSolicitud(null);
      await fetchSolicitudes();
      setActiveTab(1);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'No se pudo enviar la solicitud.');
    } finally {
      setSolicitando(false);
    }
  };

  const tabLabel = (label: string, count?: number) => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <Chip label={count} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
      )}
    </Stack>
  );

  const materiasAprobadasSet = useMemo(() => new Set(historial.aprobadas), [historial.aprobadas]);
  const mostrarContenido = !carrerasLoading && !(canGestionar && !dniBusqueda.trim());
  const necesitaContexto = requiereSeleccionCarrera || requiereSeleccionPlan;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <BackButton fallbackPath="/estudiantes" />
      <Typography variant="h4" fontWeight={700} gutterBottom>Mesas de Examen</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Tipo</InputLabel>
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="FIN">Ordinaria</MenuItem>
            <MenuItem value="EXT">Extraordinaria</MenuItem>
            <MenuItem value="ESP">Especial</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Modalidad</InputLabel>
          <Select label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value as any)}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="REG">Regular</MenuItem>
            <MenuItem value="LIB">Libre</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Llamado / Período</InputLabel>
          <Select label="Llamado / Período" value={ventanaId} onChange={(e) => setVentanaId(e.target.value)}>
            <MenuItem value="">Todos los activos</MenuItem>
            {ventanas.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {formatDate(v.desde)} ({v.tipo === 'MESAS_FINALES' ? 'Ord.' : 'Extra.'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {canGestionar && (
          <Stack direction="row" gap={1} flexGrow={1}>
            <TextField fullWidth size="small" label="DNI Estudiante" value={dni}
              onChange={(e) => setDni(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setDniBusqueda(dni); }} />
            <Button variant="contained" onClick={() => setDniBusqueda(dni)}>Buscar</Button>
          </Stack>
        )}
      </Stack>

      {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {mostrarContenido && !necesitaContexto && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, v) => setActiveTab(v)} 
              textColor="primary" 
              indicatorColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab icon={<CalendarMonthIcon fontSize="small"/>} iconPosition="start" label={tabLabel('Inscribirme', mesasDisponibles.length)} />
              <Tab icon={<SendIcon fontSize="small"/>} iconPosition="start" label={tabLabel('Mis Solicitudes', solicitudes.length)} />
              <Tab icon={<TaskAltIcon fontSize="small"/>} iconPosition="start" label={tabLabel('Mi Agenda', misInscripciones.length)} />
              <Tab icon={<ErrorOutlineIcon fontSize="small"/>} iconPosition="start" label={tabLabel('No habilitadas', mesasBloqueadas.length)} />
              <Tab icon={<HistoryIcon fontSize="small"/>} iconPosition="start" label={tabLabel('Aprobadas', materiasAprobadas.length)} />
            </Tabs>
          </Box>

          {/* TAB 0: INSCRIBIRME */}
          {activeTab === 0 && (
            <Box>
              {loadingMesas ? <LinearProgress sx={{ mb: 2 }} /> : (
                <>
                  <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarMonthIcon color="primary" /> Mesas Disponibles
                  </Typography>
                  {mesasDisponibles.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <Typography color="textSecondary">No se encontraron mesas disponibles para los filtros seleccionados.</Typography>
                    </Paper>
                  ) : (() => {
                    const grupos = agruparPorLlamado(mesasDisponibles);
                    const MesaCard = ({ mesa }: { mesa: MesaListadoItemDTO }) => (
                      <Card variant="outlined" sx={{ mb: 2, '&:hover': { boxShadow: 1 } }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {mesa.materia?.nombre ?? mesa.materia_nombre}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'}
                                {mesa.hora_desde ? ` · ${mesa.hora_desde}` : ''}
                                {mesa.aula ? ` · Aula ${mesa.aula}` : ''}
                              </Typography>
                            </Box>
                            <Button size="small" variant="contained"
                              onClick={() => setPendingInscripcion({ mesa })}
                              disabled={inscribiendoId === mesa.id}>
                              Inscribirme
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                    
                    return (
                      <Grid container spacing={2}>
                        {grupos.map((grupo, idx) => (
                          <Grid item xs={12} md={grupos.length > 1 ? 6 : 12} key={idx}>
                            <Box sx={{ mb: 2 }}>
                              <Divider textAlign="left" sx={{ mb: 2 }}>
                                <Chip label={`${grupo.llamado} - ${formatDate(grupo.fecha)}`} color="primary" size="small" />
                              </Divider>
                              {grupo.mesas.map(m => <MesaCard key={m.id} mesa={m} />)}
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    );
                  })()}
                </>
              )}
            </Box>
          )}

          {/* TAB 1: MIS SOLICITUDES */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SendIcon color="primary" /> Mis Solicitudes
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Si necesitás rendir una materia que <b>no figura en el cronograma</b> y estamos en período de inscripciones extraordinarias, podés solicitarla aquí.
              </Alert>

              {loadingSolicitudes ? <LinearProgress sx={{ mb: 2 }} /> : (
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    {solicitudes.map(s => (
                      <Grid item xs={12} md={6} key={s.id}>
                        <Card variant="outlined">
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700}>{s.materia_nombre}</Typography>
                                <Typography variant="caption" color="textSecondary">Solicitado el {formatDate(s.fecha_solicitud)}</Typography>
                              </Box>
                              <Chip 
                                label={s.estado_display} 
                                color={s.estado === 'PRO' ? 'success' : s.estado === 'REC' ? 'error' : 'warning'} 
                                size="small" 
                                variant="outlined"
                              />
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  
                  {solicitudes.length === 0 && <Typography variant="body2" color="textSecondary">No tenés solicitudes registradas.</Typography>}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" fontWeight={700}>Nueva Solicitud</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>Seleccioná la materia que deseás solicitar para este llamado extraordinario:</Typography>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {materiasPlan
                      .filter(m => !materiasAprobadasSet.has(m.id))
                      .filter(m => !mesasDisponibles.some(mesa => mesa.materia_id === m.id))
                      .filter(m => !solicitudes.some(sol => sol.materia_id === m.id && sol.estado === 'PEN'))
                      .map(m => (
                        <Grid item xs={12} sm={6} md={4} key={m.id}>
                          <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" fontWeight={600}>{m.nombre}</Typography>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              startIcon={<AddCircleIcon />}
                              sx={{ mt: 1.5 }}
                              onClick={() => setPendingSolicitud({ materia_id: m.id, materia_nombre: m.nombre })}
                              disabled={!ventanaId}
                            >
                              Solicitar Mesa
                            </Button>
                          </Paper>
                        </Grid>
                      ))
                    }
                  </Grid>
                </Stack>
              )}
            </Box>
          )}

          {/* TAB 2: MI AGENDA */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TaskAltIcon color="success" /> Mi Agenda
              </Typography>
              {loadingTrayectoria ? <LinearProgress sx={{ mb: 2 }} /> : (
                <>
                  {misInscripciones.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                      <Typography color="textSecondary">No tenés inscripciones activas para este llamado.</Typography>
                    </Paper>
                  ) : (
                    <Grid container spacing={2}>
                      {misInscripciones.map((mi) => (
                        <Grid item xs={12} md={6} lg={4} key={mi.id}>
                          <Card sx={{ borderLeft: '6px solid', borderLeftColor: 'primary.main' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Stack gap={1}>
                                <Typography variant="subtitle1" fontWeight={700}>{mi.materia_nombre}</Typography>
                                <Typography variant="body2">
                                  <b>{MESA_TIPO_LABEL[mi.tipo] ?? mi.tipo}</b> · {formatDate(mi.fecha)} {mi.hora_desde && ` · ${mi.hora_desde}`}
                                </Typography>
                                {mi.aula && <Typography variant="body2" color="textSecondary">Aula: {mi.aula}</Typography>}
                                <Divider sx={{ my: 0.5 }} />
                                {mi.tribunal && (
                                  <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                                    <Typography variant="caption" fontWeight={700} display="block">TRIBUNAL:</Typography>
                                    <Typography variant="caption" display="block">Pres: {mi.tribunal.presidente || '-'}</Typography>
                                    <Typography variant="caption" display="block">Voc: {mi.tribunal.vocal1 || '-'}</Typography>
                                  </Box>
                                )}
                                <Button size="small" color="error" variant="outlined" fullWidth
                                  onClick={() => setPendingBaja({ mesaId: mi.mesa_id, materiaNombre: mi.materia_nombre })}
                                >
                                  Anular inscripción
                                </Button>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </>
              )}
            </Box>
          )}

          {/* TAB 3: NO HABILITADAS */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutlineIcon color="warning" /> Materias no habilitadas
              </Typography>
              {mesasBloqueadas.length === 0 ? (
                <Alert severity="success">No hay mesas bloqueadas para este período.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {mesasBloqueadas.map(({ mesa, motivo }) => (
                    <Grid item xs={12} md={6} lg={4} key={mesa.id}>
                      <Paper variant="outlined" sx={{ p: 2, opacity: 0.8, borderLeft: '4px solid', borderLeftColor: getMotivoColor(motivo) === 'error' ? 'error.main' : 'warning.main' }}>
                        <Typography variant="subtitle2" fontWeight={700}>{mesa.materia?.nombre ?? mesa.materia_nombre}</Typography>
                        <Typography variant="caption" display="block" color="textSecondary">
                          {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {formatDate(mesa.fecha)}
                        </Typography>
                        <Chip label={motivo} size="small" color={getMotivoColor(motivo)} variant="outlined" sx={{ mt: 1 }} />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* TAB 4: APROBADAS */}
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon color="primary" /> Historial de Finales
              </Typography>
              {materiasAprobadas.length === 0 ? (
                <Typography color="textSecondary">No se registraron materias aprobadas.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {materiasAprobadas.map((mat) => (
                    <Grid item xs={12} md={6} lg={4} key={mat.materia_id}>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
                        <Typography variant="subtitle2" fontWeight={700}>{mat.materia_nombre}</Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                          <Typography variant="body2" color="success.main" fontWeight={700}>Nota: {mat.final?.nota || '-'}</Typography>
                          <Typography variant="caption" color="textSecondary">{formatDate(mat.final?.fecha_iso)}</Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </>
      )}

      {/* DIALOGS */}
      <Dialog open={!!pendingInscripcion} onClose={() => setPendingInscripcion(null)}>
        <DialogTitle>Confirmar Inscripción</DialogTitle>
        <DialogContent>
          <Typography>¿Confirmas tu inscripción a la mesa de <b>{pendingInscripcion?.mesa.materia?.nombre || pendingInscripcion?.mesa.materia_nombre}</b>?</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>Fecha: {pendingInscripcion && formatDate(pendingInscripcion.mesa.fecha)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingInscripcion(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleConfirmInscripcion} disabled={inscribiendoId !== null}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingBaja} onClose={() => setPendingBaja(null)}>
        <DialogTitle>Anular Inscripción</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro que deseas anular tu inscripción a <b>{pendingBaja?.materiaNombre}</b>?</Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>Esta acción liberará tu cupo en la mesa.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingBaja(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleConfirmBaja}>Anular</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingSolicitud} onClose={() => setPendingSolicitud(null)}>
        <DialogTitle>Solicitar Mesa Extraordinaria</DialogTitle>
        <DialogContent>
          <Typography>¿Confirmas la solicitud de mesa para <b>{pendingSolicitud?.materia_nombre}</b>?</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Bedelía evaluará si hay demanda suficiente y docentes disponibles para armar la mesa.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingSolicitud(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleConfirmSolicitud} disabled={solicitando}>Enviar Solicitud</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MesaExamenPage;
