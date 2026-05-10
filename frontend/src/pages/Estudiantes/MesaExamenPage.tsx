import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
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
import { formatDate } from '@/utils/date';
import {
  listarMesas, inscribirMesa, bajaMesa,
  obtenerHistorialEstudiante, obtenerCarrerasActivas,
  obtenerTrayectoriaEstudiante,
  TrayectoriaCarreraDetalleDTO, MesaListadoItemDTO, TrayectoriaMesaDTO,
} from '@/api/estudiantes';
import { CartonMateriaDTO } from '@/api/estudiantes/types';
import { hasAnyRole } from '@/utils/roles';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useAuth } from '@/context/AuthContext';
import BackButton from '@/components/ui/BackButton';
import FinalConfirmationDialog from '@/components/ui/FinalConfirmationDialog';

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

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchVentanas();
        const v = (data || []).filter((x) => ['MESAS_FINALES', 'MESAS_EXTRA'].includes(x.tipo));
        setVentanas(v);
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
    if (canGestionar && !dniBusqueda.trim()) { setMisInscripciones([]); setMateriasAprobadas([]); return; }
    setLoadingTrayectoria(true);
    try {
      const t = await obtenerTrayectoriaEstudiante(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
      setMisInscripciones((t.mesas || []).filter(m => m.estado === 'INS'));
      const aprobadas: CartonMateriaDTO[] = [];
      for (const plan of t.carton || []) {
        for (const mat of plan.materias || []) {
          if (mat.final?.condicion === 'APR') aprobadas.push(mat);
        }
      }
      setMateriasAprobadas(aprobadas);
    } catch (error) {
      console.warn("No se pudo obtener la trayectoria", error);
    } finally {
      setLoadingTrayectoria(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (canGestionar && !dniBusqueda.trim()) {
        setHistorial({ aprobadas: [], regularizadas: [], inscriptas_actuales: [] });
        setMisInscripciones([]); setMateriasAprobadas([]); return;
      }
      try {
        const h = await obtenerHistorialEstudiante(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
        setHistorial({ aprobadas: h.aprobadas || [], regularizadas: h.regularizadas || [], inscriptas_actuales: h.inscriptas_actuales || [] });
        await fetchTrayectoria();
      } catch (error) {
        console.warn("No se pudo obtener el historial", error);
      }
    })();
  }, [dniBusqueda, canGestionar]);

  // Agrupa mesas por llamado según orden cronológico de fechas únicas.
  // La primera fecha encontrada = Primer Llamado, la segunda = Segundo Llamado.
  const agruparPorLlamado = (lista: MesaListadoItemDTO[]) => {
    const fechasUnicas = [...new Set(lista.map(m => m.fecha))].sort();
    if (fechasUnicas.length <= 1) return [{ llamado: 'Primer Llamado', fecha: fechasUnicas[0] ?? '', mesas: lista }];
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
      // Si la materia ya está aprobada, no mostrar la mesa en ninguna tab
      if (historial.aprobadas.includes(materiaId)) continue;
      const reqAPR: number[] = mesa.correlativas_aprob || [];
      let esDisponible = reqAPR.every(id => historial.aprobadas.includes(id));
      if (esDisponible && mesa.modalidad === 'REG') esDisponible = historial.regularizadas.includes(materiaId);
      if (esDisponible && mesa.modalidad === 'LIB') {
        esDisponible = !historial.regularizadas.includes(materiaId) && !historial.inscriptas_actuales.includes(materiaId);
      }
      if (esDisponible && modalidad && mesa.modalidad !== modalidad) esDisponible = false;
      // Si tuvo un intento fallido registrado, va a bloqueadas aunque pasara los filtros anteriores
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
      setActiveTab(1);
    } finally {
      setInscribiendoId(null);
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

  const mostrarContenido = !carrerasLoading && !(canGestionar && !dniBusqueda.trim());
  const necesitaContexto = requiereSeleccionCarrera || requiereSeleccionPlan;

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/estudiantes" />
      <Typography variant="h4" gutterBottom>Mesas de Examen</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
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
            <MenuItem value="REG">Regular</MenuItem>
            <MenuItem value="LIB">Libre</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Periodo</InputLabel>
          <Select label="Periodo" value={ventanaId} onChange={(e) => setVentanaId(e.target.value)}>
            <MenuItem value="">Todos los activos</MenuItem>
            {ventanas.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {formatDate(v.desde)} – {formatDate(v.hasta)} ({v.tipo === 'MESAS_FINALES' ? 'Ordinarias' : 'Extraordinarias'})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }} disabled={carrerasLoading}>
          <InputLabel>Profesorado</InputLabel>
          <Select label="Profesorado" value={selectedCarreraId}
            onChange={(e) => { setSelectedCarreraId(String(e.target.value ?? '')); setSelectedPlanId(''); }}>
            {carrerasLoading && <MenuItem value="">Cargando...</MenuItem>}
            {!carrerasLoading && !carreras.length && <MenuItem value="">Sin profesorados</MenuItem>}
            {carreras.map((c) => <MenuItem key={c.profesorado_id} value={String(c.profesorado_id)}>{c.nombre}</MenuItem>)}
          </Select>
        </FormControl>
        {planesDisponibles.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Plan</InputLabel>
            <Select label="Plan" value={selectedPlanId} onChange={(e) => setSelectedPlanId(String(e.target.value ?? ''))}>
              {planesDisponibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.resolucion ? `Plan ${p.resolucion}` : `Plan ${p.id}`}{p.vigente ? ' (vigente)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {canGestionar && (
          <Stack direction="row" gap={1}>
            <TextField size="small" label="DNI estudiante" value={dni}
              onChange={(e) => setDni(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setDniBusqueda(dni); }} />
            <Button variant="contained" onClick={() => setDniBusqueda(dni)} disabled={carrerasLoading}>Buscar</Button>
          </Stack>
        )}
      </Stack>

      {canGestionar && !dniBusqueda.trim() && <Alert severity="info" sx={{ mb: 2 }}>Ingresá un DNI para gestionar las mesas de un estudiante.</Alert>}
      {requiereSeleccionCarrera && <Alert severity="info" sx={{ mb: 2 }}>Seleccioná un profesorado para ver las mesas.</Alert>}
      {requiereSeleccionPlan && <Alert severity="info" sx={{ mb: 2 }}>Seleccioná un plan de estudios para filtrar las mesas.</Alert>}
      {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {mostrarContenido && !necesitaContexto && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} textColor="primary" indicatorColor="primary">
              <Tab label={tabLabel('Inscripción', misInscripciones.length + mesasDisponibles.length)} />
              <Tab label={tabLabel('No habilitadas', mesasBloqueadas.length)} />
              <Tab label={tabLabel('Aprobadas', materiasAprobadas.length)} />
            </Tabs>
          </Box>

          {/* TAB 0: INSCRIPCIÓN */}
          {activeTab === 0 && (
            <Box>
              {loadingMesas ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
              ) : (
                <>
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="primary" gutterBottom>
                      Mis inscripciones activas
                    </Typography>
                    {loadingTrayectoria ? (
                      <CircularProgress size={20} />
                    ) : misInscripciones.length === 0 ? (
                      <Alert severity="info" variant="outlined">No tenés inscripciones activas en este período.</Alert>
                    ) : (
                      <Grid container spacing={1.5}>
                        {misInscripciones.map((mi) => (
                          <Grid item xs={12} md={6} lg={4} key={mi.id}>
                            <Paper variant="outlined" sx={{ p: 1.5, borderLeft: '5px solid', borderLeftColor: 'primary.main' }}>
                              <Stack gap={0.5}>
                                <Typography variant="subtitle2" fontWeight={700}>{mi.materia_nombre}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {MESA_TIPO_LABEL[mi.tipo] ?? mi.tipo} · {formatDate(mi.fecha)}
                                </Typography>
                                <Button size="small" color="error" variant="outlined"
                                  onClick={() => setPendingBaja({ mesaId: mi.mesa_id, materiaNombre: mi.materia_nombre })}
                                  disabled={inscribiendoId !== null}>
                                  Anular inscripción
                                </Button>
                              </Stack>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                    <Divider sx={{ my: 3 }} />
                  </Box>

                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Disponibles para inscribirse
                  </Typography>
                  {mesasDisponibles.length === 0 ? (
                    <Alert severity="info">No hay mesas disponibles con los filtros seleccionados.</Alert>
                  ) : (() => {
                    const grupos = agruparPorLlamado(mesasDisponibles);
                    const MesaCard = ({ mesa }: { mesa: MesaListadoItemDTO }) => (
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                        <Stack gap={0.5}>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {mesa.materia?.nombre ?? mesa.materia_nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'}
                            {mesa.hora_desde ? ` · ${mesa.hora_desde}${mesa.hora_hasta ? ' - ' + mesa.hora_hasta : ''}` : ''}
                          </Typography>
                          {mesa.aula && <Typography variant="caption" color="text.secondary">Aula: {mesa.aula}</Typography>}
                          {mesa.tribunal && (mesa.tribunal.presidente || mesa.tribunal.vocal1) && (
                            <Box sx={{ mt: 0.5, p: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary' }}>Tribunal</Typography>
                              {mesa.tribunal.presidente && <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem' }}>Pres: {mesa.tribunal.presidente}</Typography>}
                              {(mesa.tribunal.vocal1 || mesa.tribunal.vocal2) && (
                                <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem' }}>
                                  Voc: {[mesa.tribunal.vocal1, mesa.tribunal.vocal2].filter(Boolean).join(' / ')}
                                </Typography>
                              )}
                            </Box>
                          )}
                          <Button size="small" variant="contained" sx={{ mt: 0.5 }}
                            onClick={() => setPendingInscripcion({ mesa })}
                            disabled={inscribiendoId === mesa.id}>
                            Inscribirme
                          </Button>
                        </Stack>
                      </Paper>
                    );
                    // Un solo llamado: lista normal
                    if (grupos.length === 1) return (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                          <Chip label={`${grupos[0].llamado} — ${formatDate(grupos[0].fecha)}`} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                          <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                        </Box>
                        {grupos[0].mesas.map(m => <MesaCard key={m.id} mesa={m} />)}
                      </Box>
                    );
                    // Dos o más llamados: columnas lado a lado
                    return (
                      <Grid container spacing={2}>
                        {grupos.map(({ llamado, fecha, mesas: grupo }, idx) => (
                          <Grid item xs={12} md={6} key={fecha}>
                            <Box sx={{
                              p: 2, borderRadius: 2, border: '2px solid',
                              borderColor: idx === 0 ? 'primary.main' : 'secondary.main',
                              bgcolor: idx === 0 ? 'primary.50' : 'secondary.50',
                              height: '100%',
                            }}>
                              <Box sx={{ textAlign: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={800}
                                  color={idx === 0 ? 'primary.main' : 'secondary.main'}>
                                  {llamado}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                  {formatDate(fecha)}
                                </Typography>
                              </Box>
                              <Divider sx={{ mb: 2 }} />
                              {grupo.map(m => <MesaCard key={m.id} mesa={m} />)}
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

          {/* TAB 1: NO HABILITADAS */}
          {activeTab === 1 && (
            <Box>
              {loadingMesas ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
              ) : mesasBloqueadas.length === 0 ? (
                <Alert severity="success">No hay mesas bloqueadas para este período.</Alert>
              ) : (
                <Grid container spacing={1.5}>
                  {mesasBloqueadas.map(({ mesa, motivo }) => (
                    <Grid item xs={12} md={6} lg={4} key={mesa.id}>
                      <Paper variant="outlined" sx={{
                        p: 1.5, opacity: 0.85,
                        borderLeft: '5px solid',
                        borderLeftColor: getMotivoColor(motivo) === 'error' ? 'error.main' : getMotivoColor(motivo) === 'warning' ? 'warning.main' : 'grey.400',
                      }}>
                        <Stack gap={0.5}>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {mesa.materia?.nombre ?? mesa.materia_nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'} · {formatDate(mesa.fecha)}
                          </Typography>
                          <Chip
                            label={motivo}
                            size="small"
                            color={getMotivoColor(motivo)}
                            variant="outlined"
                            sx={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}
                          />
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* TAB 2: APROBADAS */}
          {activeTab === 2 && (
            <Box>
              {loadingTrayectoria ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
              ) : materiasAprobadas.length === 0 ? (
                <Alert severity="info">No hay materias aprobadas registradas.</Alert>
              ) : (
                <Grid container spacing={1.5}>
                  {materiasAprobadas.map((mat) => (
                    <Grid item xs={12} sm={6} md={4} key={mat.materia_id}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderLeft: '5px solid', borderLeftColor: 'success.main' }}>
                        <Stack gap={0.25}>
                          <Typography variant="subtitle2" fontWeight={700}>{mat.materia_nombre}</Typography>
                          {mat.anio && <Typography variant="caption" color="text.secondary">{mat.anio}º año</Typography>}
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip label="Aprobada" size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                            {mat.final?.nota && <Chip label={`Nota: ${mat.final.nota}`} size="small" color="success" sx={{ fontSize: '0.7rem' }} />}
                          </Stack>
                          {mat.final?.fecha && (
                            <Typography variant="caption" color="text.secondary">Fecha: {mat.final.fecha}</Typography>
                          )}
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

      <FinalConfirmationDialog
        open={Boolean(pendingInscripcion)}
        onConfirm={handleConfirmInscripcion}
        onCancel={() => { if (inscribiendoId === null) setPendingInscripcion(null); }}
        contextText={pendingInscripcion ? `inscripción a la mesa de ${pendingInscripcion.mesa.materia?.nombre ?? pendingInscripcion.mesa.materia_nombre}` : ''}
        loading={inscribiendoId !== null}
      />

      <FinalConfirmationDialog
        open={Boolean(pendingBaja)}
        onConfirm={async () => {
          if (!pendingBaja) return;
          setInscribiendoId(pendingBaja.mesaId);
          try {
            const res = await bajaMesa({ mesa_id: pendingBaja.mesaId, dni: canGestionar ? (dniBusqueda || undefined) : undefined });
            setInfo(res.message);
            setErr(null);
            setPendingBaja(null);
            await fetchTrayectoria();
          } catch (e: any) {
            setErr(e?.response?.data?.message || 'No se pudo anular la inscripción. Verificá que falten más de 48hs hábiles.');
          } finally {
            setInscribiendoId(null);
          }
        }}
        onCancel={() => setPendingBaja(null)}
        contextText={pendingBaja ? `anulación definitiva de tu inscripción a la mesa de ${pendingBaja.materiaNombre}` : ''}
        loading={inscribiendoId !== null}
        confirmColor="error"
        confirmLabel="Anular Inscripción"
      />
    </Box>
  );
};

export default MesaExamenPage;
