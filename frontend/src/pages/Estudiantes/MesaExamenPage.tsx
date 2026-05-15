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
import Avatar from "@mui/material/Avatar";

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
  listarMateriasSolicitables, cancelarSolicitud,
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
  const [pendingSolicitud, setPendingSolicitud] = useState<{ materia_id: number, materia_nombre: string } | null>(null);
  const [modalidadSolicitud, setModalidadSolicitud] = useState<"REG" | "LIB">("REG");
  const [solicitando, setSolicitando] = useState(false);
  const [materiasSolicitables, setMateriasSolicitables] = useState<any[]>([]);
  const [loadingSolicitables, setLoadingSolicitables] = useState(false);
  const [pendingCancelSolicitudId, setPendingCancelSolicitudId] = useState<number | null>(null);
  const [estudianteEncontrado, setEstudianteEncontrado] = useState<{ nombre: string, dni: string } | null>(null);
  const [carrerasLoadedDni, setCarrerasLoadedDni] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchVentanas();
        const v = (data || []).filter((x) => ['MESAS_FINALES', 'MESAS_EXTRA'].includes(x.tipo));
        setVentanas(v);
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
        setCarreras([]);
        setEstudianteEncontrado(null);
        return;
      }
      // Resetear estado inmediatamente para activar guardas en otros efectos
      setCarrerasLoading(true);
      setErr(null);
      try {
        const data = await obtenerCarrerasActivas(canGestionar && dniBusqueda ? { dni: dniBusqueda } : undefined);
        if (!cancelled) {
          setCarreras(data.carreras || []);
          setEstudianteEncontrado({ nombre: data.estudiante_nombre, dni: data.estudiante_dni });
          setCarrerasLoadedDni(dniBusqueda);
          setCarrerasLoading(false);
          if (!(data.carreras || []).length) { setSelectedCarreraId(''); setSelectedPlanId(''); }
        }
      } catch (error: any) {
        if (!cancelled) {
          setErr(error?.response?.data?.message || 'No se pudieron cargar las carreras.');
          setCarreras([]);
          setCarrerasLoading(false);
        }
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
  const contextRef = React.useRef({ requiereSeleccionCarrera: false, requiereSeleccionPlan: false });
  contextRef.current = { requiereSeleccionCarrera, requiereSeleccionPlan };

  useEffect(() => {
    setErr(null); // Limpiar errores previos al cambiar de estudiante o filtros
    let cancelled = false;
    const fetchMesas = async () => {
      if (carrerasLoading || requiereSeleccionCarrera || requiereSeleccionPlan) {
        setMesas([]);
        return;
      }
      if (canGestionar && !dniBusqueda.trim()) { setMesas([]); return; }
      // Guard contra race condition: no llamar a la API si las carreras aún no se cargaron para este DNI
      if (canGestionar && dniBusqueda && carrerasLoadedDni !== dniBusqueda) { setMesas([]); return; }

      // Doble check de seguridad para evitar errores de backend en alumnos con múltiples carreras
      if (!selectedCarreraIdNum && !selectedPlanIdNum && carreras.length > 1) {
        setMesas([]);
        return;
      }

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
        if (!cancelled) { setErr(null); setMesas(data || []); }
      } catch (error: any) {
        if (!cancelled) {
          // Solo mostrar error si no estamos esperando selección (usamos ref para valor actual)
          const cur = contextRef.current;
          if (!cur.requiereSeleccionCarrera && !cur.requiereSeleccionPlan) {
            setErr(error?.response?.data?.message || 'No se pudieron cargar las mesas.');
          }
          setMesas([]);
        }
      } finally {
        if (!cancelled) setLoadingMesas(false);
      }
    };
    fetchMesas();
    return () => { cancelled = true; };
  }, [carrerasLoading, carrerasLoadedDni, requiereSeleccionCarrera, requiereSeleccionPlan, selectedCarreraIdNum, selectedPlanIdNum, tipo, ventanaId, canGestionar, dniBusqueda]);

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

  const fetchSolicitables = async () => {
    if (carrerasLoading || requiereSeleccionCarrera || requiereSeleccionPlan) {
      setMateriasSolicitables([]);
      return;
    }
    if (canGestionar && !dniBusqueda.trim()) { setMateriasSolicitables([]); return; }
    setLoadingSolicitables(true);
    try {
      const data = await listarMateriasSolicitables({
        dni: canGestionar && dniBusqueda ? dniBusqueda : undefined,
        plan_id: selectedPlanIdNum || undefined,
      });
      setMateriasSolicitables(data || []);
    } catch (error) {
      const cur = contextRef.current;
      if (!cur.requiereSeleccionCarrera && !cur.requiereSeleccionPlan) {
        console.warn("No se pudieron obtener las materias solicitables", error);
      }
    } finally {
      setLoadingSolicitables(false);
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

  useEffect(() => {
    fetchSolicitables();
  }, [dniBusqueda, modalidad, selectedPlanIdNum]);

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
        modalidad: modalidadSolicitud,
        observaciones: "",
        dni: dniBusqueda || user?.dni || ""
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

  const handleConfirmCancelacionSolicitud = async () => {
    if (!pendingCancelSolicitudId) return;
    setSolicitando(true);
    try {
      const res = await cancelarSolicitud(pendingCancelSolicitudId);
      setInfo(res.message);
      setErr(null);
      setPendingCancelSolicitudId(null);
      await fetchSolicitudes();
      await fetchSolicitables();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'No se pudo cancelar la solicitud.');
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

  const mostrarContenido = !carrerasLoading && !(canGestionar && !dniBusqueda.trim());
  const necesitaContexto = requiereSeleccionCarrera || requiereSeleccionPlan;

  const ventanaExtraInfo = useMemo(() => {
    const extra = ventanas.find(v => v.tipo === 'MESAS_EXTRA');
    if (!extra) return { habilitada: false, mensaje: 'No hay período de solicitudes extraordinarias configurado.' };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = new Date(extra.desde + 'T00:00:00');
    const hasta = new Date(extra.hasta + 'T00:00:00');
    if (!extra.activo) return { habilitada: false, mensaje: 'Las solicitudes de mesas extraordinarias están cerradas.' };
    if (hoy < desde) return { habilitada: false, mensaje: `Las solicitudes se habilitarán el ${desde.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}.` };
    if (hoy > hasta) return { habilitada: false, mensaje: `El período de solicitudes cerró el ${hasta.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}.` };
    return { habilitada: true, mensaje: '' };
  }, [ventanas]);

  return (
    <Box sx={{ p: 3, bgcolor: "#f9f5ea", minHeight: "100vh" }}>
      <Stack spacing={3} maxWidth={1180} mx="auto">
        <BackButton fallbackPath="/estudiantes" />
        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: '#5d4037' }}>Mesas de Examen</Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 220, bgcolor: "#fff" }}>
            <InputLabel id="select-ventana-label">Llamado / Período</InputLabel>
            <Select
              labelId="select-ventana-label"
              label="Llamado / Período"
              value={ventanaId}
              onChange={(e) => setVentanaId(e.target.value)}
            >
              <MenuItem value="">Todos los activos</MenuItem>
              {ventanas.map((v) => (
                <MenuItem key={v.id} value={String(v.id)}>
                  {formatDate(v.desde)} ({v.tipo === 'MESAS_FINALES' ? 'Ordinaria' : 'Extraordinaria'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {canGestionar && (
            <Stack direction="row" gap={1} flexGrow={1}>
              <TextField fullWidth size="small" label="DNI Estudiante" value={dni}
                sx={{ bgcolor: "#fff" }}
                onChange={(e) => setDni(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setDniBusqueda(dni); }} />
              <Button variant="contained"
                sx={{ bgcolor: '#B7694E', '&:hover': { bgcolor: '#5d4037' } }}
                onClick={() => setDniBusqueda(dni)}>
                Buscar
              </Button>
            </Stack>
          )}
        </Stack>

        {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

        {canGestionar && estudianteEncontrado && (
          <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#fff', border: '1px solid #e3d7bc', borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: '#B7694E' }}>{estudianteEncontrado.nombre.charAt(0)}</Avatar>
              <Box>
                <Typography variant="subtitle2" color="#B7694E" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
                  ESTUDIANTE SELECCIONADO
                </Typography>
                <Typography variant="h6" fontWeight={700} color="#5d4037">
                  {estudianteEncontrado.nombre}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  DNI: {estudianteEncontrado.dni}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {mostrarContenido && !necesitaContexto && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                aria-label="Categorías de mesas"
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': { fontWeight: 600, fontSize: '0.95rem', textTransform: 'none' },
                  '& .Mui-selected': { color: '#B7694E' },
                  '& .MuiTabs-indicator': { backgroundColor: '#B7694E' }
                }}
              >
                <Tab icon={<CalendarMonthIcon fontSize="small" />} iconPosition="start" label={tabLabel('Inscripción Mesa Ordinaria', mesasDisponibles.length)} />
                <Tab icon={<SendIcon fontSize="small" />} iconPosition="start" label={tabLabel('Mesa Extraordinaria', solicitudes.length)} />
                <Tab icon={<TaskAltIcon fontSize="small" />} iconPosition="start" label={tabLabel('Cronograma de Mesas', misInscripciones.length)} />
                <Tab icon={<ErrorOutlineIcon fontSize="small" />} iconPosition="start" label={tabLabel('No habilitadas', mesasBloqueadas.length)} />
                <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label={tabLabel('Aprobadas', materiasAprobadas.length)} />
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
                        <Box
                          sx={{ p: 2.5, mb: 2, borderRadius: 2, border: "1px solid #d4c4a5", bgcolor: "#fefbf4" }}
                        >
                          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700} color="#5d4037">
                                {mesa.materia?.nombre ?? mesa.materia_nombre}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {mesa.modalidad === 'LIB' ? 'Libre' : 'Regular'}
                                {mesa.hora_desde ? ` · ${mesa.hora_desde}` : ''}
                                {mesa.aula ? ` · Aula ${mesa.aula}` : ''}
                              </Typography>
                              <Stack direction="row" spacing={1} mt={1}>
                                <Chip size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} label="Habilitada" />
                              </Stack>
                            </Box>
                            <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#fff", minWidth: 200, display: 'flex', alignItems: 'center' }}>
                              <Button
                                variant="contained"
                                fullWidth
                                sx={{ bgcolor: '#B7694E', '&:hover': { bgcolor: '#5d4037' } }}
                                onClick={() => setPendingInscripcion({ mesa })}
                                disabled={inscribiendoId === mesa.id}
                              >
                                Inscribirme
                              </Button>
                            </Box>
                          </Stack>
                        </Box>
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
                  <SendIcon color="primary" /> Solicitudes de Mesa Extraordinaria
                </Typography>

                {loadingSolicitudes ? <LinearProgress sx={{ mb: 2 }} /> : (
                  <Stack spacing={2}>
                    <Grid container spacing={2}>
                      {solicitudes.map(s => (
                        <Grid item xs={12} md={6} key={s.id}>
                          <Card variant="outlined">
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box sx={{ flex: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <Typography variant="subtitle2" fontWeight={700}>{s.materia_nombre}</Typography>
                                    {s.modalidad && (
                                      <Chip
                                        label={s.modalidad === 'REG' ? 'Regular' : 'Libre'}
                                        size="small"
                                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: s.modalidad === 'REG' ? '#1976d2' : '#ed6c02', color: '#fff', fontWeight: 700 }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="caption" color="textSecondary">Solicitado el {formatDate(s.fecha_solicitud)}</Typography>
                                </Box>
                                <Chip
                                  label={s.estado_display}
                                  color={s.estado === 'PRO' ? 'success' : s.estado === 'REC' ? 'error' : 'warning'}
                                  size="small"
                                  variant="outlined"
                                />
                                {s.estado === 'PEN' && (
                                  <Button
                                    size="small"
                                    color="error"
                                    onClick={() => setPendingCancelSolicitudId(s.id)}
                                    disabled={solicitando}
                                    sx={{ ml: 1, minWidth: 'auto', px: 1 }}
                                  >
                                    Anular
                                  </Button>
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>

                    {solicitudes.length === 0 && <Typography variant="body2" color="textSecondary">No tenés solicitudes registradas.</Typography>}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" fontWeight={700} color="#5d4037" gutterBottom>Seleccioná la materia que deseás solicitar para este llamado extraordinario:</Typography>

                    {!ventanaExtraInfo.habilitada && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {ventanaExtraInfo.mensaje}
                      </Alert>
                    )}

                    {loadingSolicitables ? <LinearProgress sx={{ mt: 1 }} /> : (() => {
                      const yaEnMesa = (mid: number) => mesasDisponibles.some(m => (m.materia?.id ?? m.materia_id) === mid);
                      const yaSolicitada = (mid: number) => solicitudes.some(s => s.materia_id === mid && s.estado === 'PEN');
                      const reg = materiasSolicitables.filter(m => m.modalidad === 'REG' && !yaEnMesa(m.materia_id) && !yaSolicitada(m.materia_id));
                      const lib = materiasSolicitables.filter(m => m.modalidad === 'LIB' && !yaEnMesa(m.materia_id) && !yaSolicitada(m.materia_id));

                      const MateriasGrid = ({ lista, label, isLibre }: { lista: typeof materiasSolicitables, label: string, isLibre: boolean }) => {
                        type MatSol = typeof materiasSolicitables[number];
                        const porAnio: Record<string, MatSol[]> = {};
                        for (const m of lista) {
                          const key = `${m.anio}`;
                          if (!porAnio[key]) porAnio[key] = [];
                          porAnio[key].push(m);
                        }

                        return (
                          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e3d7bc', bgcolor: '#fff', height: '100%' }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom color="#5d4037">
                              {label}
                            </Typography>
                            {lista.length === 0 ? (
                              <Alert severity="info" sx={{ bgcolor: '#fefbf4', border: '1px solid #e3d7bc', color: '#5d4037' }}>No hay materias disponibles en esta modalidad.</Alert>
                            ) : (
                              <Stack spacing={3}>
                                {Object.entries(porAnio).sort((a, b) => Number(a[0]) - Number(b[0])).map(([anio, mats]) => (
                                  <Box key={anio}>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#B7694E' }}>{anio}º año</Typography>
                                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                                      {mats.map(m => (
                                        <Box key={`${m.materia_id}-${m.modalidad}`} sx={{ p: 2, borderRadius: 2, border: '1px solid #d4c4a5', bgcolor: '#fefbf4' }}>
                                          <Stack direction="column" justifyContent="space-between" spacing={1} height="100%">
                                            <Box>
                                              <Typography variant="h6" fontSize="0.9rem" fontWeight={700} color="#5d4037" sx={{ lineHeight: 1.2 }}>{m.materia_nombre}</Typography>
                                              <Typography variant="caption" color="text.secondary" display="block">{m.plan_resolucion}</Typography>
                                              <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                                                {isLibre
                                                  ? <Chip size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }} label="Libre" />
                                                  : <Chip size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} label="Regular" />
                                                }
                                                <Chip size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#efebe9', color: '#5d4037', fontWeight: 600 }} label="Solicitar" />
                                              </Stack>
                                            </Box>
                                            <Box sx={{ mt: 'auto', pt: 1 }}>
                                              <Button
                                                variant="contained"
                                                size="small"
                                                fullWidth
                                                sx={{ bgcolor: '#B7694E', '&:hover': { bgcolor: '#5d4037' }, fontSize: '0.75rem', py: 0.5 }}
                                                onClick={() => { setModalidadSolicitud(m.modalidad as 'REG' | 'LIB'); setPendingSolicitud({ materia_id: m.materia_id, materia_nombre: m.materia_nombre }); }}
                                                disabled={!ventanaId || !ventanaExtraInfo.habilitada}
                                              >
                                                {ventanaExtraInfo.habilitada ? 'Solicitar Mesa' : 'Solicitudes cerradas'}
                                              </Button>
                                            </Box>
                                          </Stack>
                                        </Box>
                                      ))}
                                    </Box>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Paper>
                        );
                      };

                      return (
                        <Grid container spacing={3} sx={{ mt: 0.5 }}>
                          <Grid item xs={12} md={6}>
                            <MateriasGrid lista={reg} label="Regular" isLibre={false} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <MateriasGrid lista={lib} label="Libre" isLibre={true} />
                          </Grid>
                        </Grid>
                      );
                    })()}
                  </Stack>
                )}
              </Box>
            )}

            {/* TAB 2: MI AGENDA */}
            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#5d4037' }}>
                  <TaskAltIcon color="success" /> Cronograma de Mesas Inscriptas
                </Typography>
                {loadingTrayectoria ? <LinearProgress sx={{ mb: 2 }} /> : (
                  <>
                    {misInscripciones.length === 0 ? (
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fff', border: '1px solid #e3d7bc' }}>
                        <Typography color="textSecondary">No tenés inscripciones activas para este llamado.</Typography>
                      </Paper>
                    ) : (
                      <Grid container spacing={2}>
                        {misInscripciones.map((mi) => (
                          <Grid item xs={12} md={6} lg={4} key={mi.id}>
                            <Box sx={{ p: 2.5, borderRadius: 2, border: "1px solid #d4c4a5", bgcolor: "#fefbf4", height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <Stack gap={1}>
                                <Typography variant="subtitle1" fontWeight={700} color="#5d4037">{mi.materia_nombre}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  <b>{MESA_TIPO_LABEL[mi.tipo] ?? mi.tipo}</b> · {formatDate(mi.fecha)} {mi.hora_desde && ` · ${mi.hora_desde}`}
                                </Typography>
                                {mi.aula && <Typography variant="body2" color="textSecondary">Aula: {mi.aula}</Typography>}
                                <Divider sx={{ my: 0.5, borderColor: '#e3d7bc' }} />
                                {mi.tribunal && (
                                  <Box sx={{ bgcolor: '#fff', p: 1, borderRadius: 1, border: '1px solid #cbb891' }}>
                                    <Typography variant="caption" fontWeight={700} display="block" color="#B7694E">TRIBUNAL:</Typography>
                                    <Typography variant="caption" display="block">Pres: {mi.tribunal.presidente || '-'}</Typography>
                                    <Typography variant="caption" display="block">Voc: {mi.tribunal.vocal1 || '-'}</Typography>
                                  </Box>
                                )}
                              <Button size="small" color="error" variant="outlined" fullWidth sx={{ mt: 1 }}
                                onClick={() => setPendingBaja({ mesaId: mi.mesa_id, materiaNombre: mi.materia_nombre })}
                                disabled={!mi.puede_baja}
                              >
                                {!mi.puede_baja ? 'Baja no permitida (Período cerrado)' : 'Anular inscripción'}
                              </Button>
                              </Stack>
                            </Box>
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
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#5d4037' }}>
                  <ErrorOutlineIcon color="warning" /> Materias no habilitadas
                </Typography>
                {mesasBloqueadas.length === 0 ? (
                  <Alert severity="success" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32' }}>No hay mesas bloqueadas para este período.</Alert>
                ) : (
                  <Grid container spacing={2}>
                    {mesasBloqueadas.map(({ mesa, motivo }) => (
                      <Grid item xs={12} md={6} lg={4} key={mesa.id}>
                        <Box sx={{ p: 2, opacity: 0.8, borderRadius: 2, border: '1px solid #d4c4a5', bgcolor: '#fefbf4', borderLeft: '4px solid', borderLeftColor: getMotivoColor(motivo) === 'error' ? 'error.main' : 'warning.main' }}>
                          <Typography variant="subtitle2" fontWeight={700} color="#5d4037">{mesa.materia?.nombre ?? mesa.materia_nombre}</Typography>
                          <Typography variant="caption" display="block" color="textSecondary">
                            {MESA_TIPO_LABEL[mesa.tipo] ?? mesa.tipo} · {formatDate(mesa.fecha)}
                          </Typography>
                          <Chip label={motivo} size="small" color={getMotivoColor(motivo)} variant="outlined" sx={{ mt: 1 }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}

            {/* TAB 4: APROBADAS */}
            {activeTab === 4 && (
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#5d4037' }}>
                  <HistoryIcon color="primary" /> Historial de Finales
                </Typography>
                {materiasAprobadas.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#fff', border: '1px solid #e3d7bc' }}>
                    <Typography color="textSecondary">No se registraron materias aprobadas.</Typography>
                  </Paper>
                ) : (
                  <Grid container spacing={2}>
                    {materiasAprobadas.map((mat) => (
                      <Grid item xs={12} md={6} lg={4} key={mat.materia_id}>
                        <Box sx={{ p: 2.5, borderRadius: 2, border: '1px solid #d4c4a5', bgcolor: '#fefbf4', borderLeft: '4px solid', borderLeftColor: '#2e7d32' }}>
                          <Typography variant="subtitle2" fontWeight={700} color="#5d4037">{mat.materia_nombre}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                            <Typography variant="body2" color="#2e7d32" fontWeight={700}>Nota: {mat.final?.nota || '-'}</Typography>
                            <Typography variant="caption" color="textSecondary">{formatDate(mat.final?.fecha_iso)}</Typography>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}
          </>
        )}

        {mostrarContenido && necesitaContexto && (
          <Box sx={{ mt: 4 }}>
            <Alert severity="info" sx={{ mb: 3, bgcolor: '#fff', border: '1px solid #e3d7bc', color: '#5d4037' }}>El estudiante tiene múltiples carreras o planes activos. Seleccioná uno para continuar.</Alert>
            <Grid container spacing={3}>
              {requiereSeleccionCarrera && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom color="#5d4037">Seleccioná Profesorado:</Typography>
                  <Stack spacing={1}>
                    {carreras.map((c) => (
                      <Button
                        key={c.profesorado_id}
                        variant="outlined"
                        onClick={() => setSelectedCarreraId(String(c.profesorado_id))}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 2, borderColor: '#d4c4a5', color: '#5d4037', '&:hover': { bgcolor: '#fefbf4', borderColor: '#B7694E' } }}
                      >
                        {c.nombre}
                      </Button>
                    ))}
                  </Stack>
                </Grid>
              )}

              {requiereSeleccionPlan && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom color="#5d4037">Seleccioná Plan de Estudio:</Typography>
                  <Stack spacing={1}>
                    {planesDisponibles.map((p) => (
                      <Button
                        key={p.id}
                        variant="outlined"
                        onClick={() => setSelectedPlanId(String(p.id))}
                        sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 2, borderColor: '#d4c4a5', color: '#5d4037', '&:hover': { bgcolor: '#fefbf4', borderColor: '#B7694E' } }}
                      >
                        Plan {p.resolucion} {p.vigente ? '(Vigente)' : ''}
                      </Button>
                    ))}
                  </Stack>
                  {carreras.length > 1 && (
                    <Button size="small" sx={{ mt: 2, color: '#B7694E' }} onClick={() => { setSelectedCarreraId(''); setSelectedPlanId(''); }}>
                      Volver a elegir carrera
                    </Button>
                  )}
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* DIALOGS */}
        <Dialog open={!!pendingInscripcion} onClose={() => setPendingInscripcion(null)}>
          <DialogTitle sx={{ color: '#5d4037', fontWeight: 700 }}>Confirmar Inscripción</DialogTitle>
          <DialogContent>
            <Typography>¿Confirmas tu inscripción a la mesa de <b>{pendingInscripcion?.mesa.materia?.nombre || pendingInscripcion?.mesa.materia_nombre}</b>?</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Fecha: {pendingInscripcion && formatDate(pendingInscripcion.mesa.fecha)}</Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPendingInscripcion(null)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Button variant="contained" onClick={handleConfirmInscripcion} disabled={inscribiendoId !== null} sx={{ bgcolor: '#B7694E', '&:hover': { bgcolor: '#5d4037' } }}>
              Confirmar
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!pendingBaja} onClose={() => setPendingBaja(null)}>
          <DialogTitle sx={{ color: '#5d4037', fontWeight: 700 }}>Anular Inscripción</DialogTitle>
          <DialogContent>
            <Typography>¿Estás seguro que deseas anular tu inscripción a <b>{pendingBaja?.materiaNombre}</b>?</Typography>
            <Alert severity="warning" sx={{ mt: 2 }}>Esta acción liberará tu cupo en la mesa.</Alert>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPendingBaja(null)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={handleConfirmBaja}>Anular</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!pendingSolicitud} onClose={() => setPendingSolicitud(null)}>
          <DialogTitle sx={{ color: '#5d4037', fontWeight: 700 }}>Solicitar Mesa Extraordinaria</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>¿Confirmás la solicitud de mesa para <b>{pendingSolicitud?.materia_nombre}</b>?</Typography>
            <Chip
              label={modalidadSolicitud === 'REG' ? 'Modalidad: Regular' : 'Modalidad: Libre'}
              sx={{ mb: 2, bgcolor: modalidadSolicitud === 'REG' ? '#e8f5e9' : '#fff3e0', color: modalidadSolicitud === 'REG' ? '#2e7d32' : '#e65100', fontWeight: 700 }}
              size="small"
            />
            <Typography variant="body2" color="textSecondary">Bedelía evaluará si hay demanda suficiente y docentes disponibles para armar la mesa.</Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPendingSolicitud(null)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Button variant="contained" onClick={handleConfirmSolicitud} disabled={solicitando} sx={{ bgcolor: '#B7694E', '&:hover': { bgcolor: '#5d4037' } }}>
              Enviar Solicitud
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!pendingCancelSolicitudId} onClose={() => setPendingCancelSolicitudId(null)}>
          <DialogTitle sx={{ color: '#5d4037', fontWeight: 700 }}>Anular Solicitud</DialogTitle>
          <DialogContent>
            <Typography>¿Estás seguro que deseas anular esta solicitud de mesa extraordinaria?</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Esta acción eliminará el pedido y la materia volverá a estar disponible para solicitar si el período sigue abierto.</Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPendingCancelSolicitudId(null)} sx={{ color: 'text.secondary' }}>Cerrar</Button>
            <Button color="error" variant="contained" onClick={handleConfirmCancelacionSolicitud} disabled={solicitando}>Eliminar Pedido</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
};

export default MesaExamenPage;
