import React from 'react';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { client as api } from '@/api/client';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import {
  solicitarPedidoAnalitico,
  marcarAnaliticoConfeccionado,
  marcarAnaliticoEntregado,
  obtenerCarrerasActivas,
  TrayectoriaCarreraDetalleDTO,
} from '@/api/estudiantes';
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { TramitesNavTabs } from "@/components/ui/TramitesNavTabs";
import { useAuth } from "@/context/AuthContext";

type EstadoPedido = 'PEND' | 'CONF' | 'ENTR';

type Pedido = {
  id: number;
  dni: string;
  apellido_nombre: string;
  profesorado?: string;
  cohorte?: number;
  fecha_solicitud: string;
  motivo?: string;
  motivo_otro?: string;
  estado?: EstadoPedido;
};

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  PEND: 'Pendiente',
  CONF: 'Confeccionado',
  ENTR: 'Entregado',
};

const ESTADO_COLOR: Record<EstadoPedido, 'default' | 'warning' | 'success' | 'info'> = {
  PEND: 'warning',
  CONF: 'info',
  ENTR: 'success',
};

const MOTIVO_LABEL: Record<string, string> = {
  equivalencia: 'Pedido de equivalencia',
  beca: 'Becas',
  control: 'Control',
  otro: 'Otro',
};

export default function AnaliticosPage() {
  const { user } = useAuth();
  const roles = ((user?.roles || []) as string[]).map(r => (r || '').toLowerCase());
  const puedeMarcarEstado = roles.some(r => ['admin', 'secretaria', 'bedel'].includes(r));

  const [ventanas, setVentanas] = React.useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = React.useState<string>('');
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dniFilter, setDniFilter] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<{
    dni: string;
    motivo: 'equivalencia' | 'beca' | 'control' | 'otro';
    motivo_otro?: string;
    cohorte?: number | '';
  }>({ dni: '', motivo: 'equivalencia', motivo_otro: '', cohorte: '' });
  const [carrerasModal, setCarrerasModal] = React.useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasModalLoading, setCarrerasModalLoading] = React.useState(false);
  const [selectedCarreraModal, setSelectedCarreraModal] = React.useState<string>('');
  const [selectedPlanModal, setSelectedPlanModal] = React.useState<string>('');
  const [loadingAction, setLoadingAction] = React.useState<number | null>(null);

  const resetModalState = () => {
    setCarrerasModal([]);
    setSelectedCarreraModal('');
    setSelectedPlanModal('');
    setCarrerasModalLoading(false);
    setForm({ dni: '', motivo: 'equivalencia', motivo_otro: '', cohorte: '' });
    setError(null);
  };

  const loadVentanas = async () => {
    try {
      const data = await fetchVentanas();
      const v = (data || []).filter(v => v.tipo === 'ANALITICOS');
      setVentanas(v);
      if (v.length) setVentanaId(String(v[0].id));
    } catch { setError('No se pudieron cargar ventanas'); }
  };
  React.useEffect(() => { loadVentanas(); }, []);

  React.useEffect(() => {
    if (!creating) return;
    if (!form.dni.trim()) {
      setCarrerasModal([]);
      setSelectedCarreraModal('');
      setSelectedPlanModal('');
      return;
    }
    let cancelled = false;
    const fetchCarreras = async () => {
      setCarrerasModalLoading(true);
      try {
        const data = await obtenerCarrerasActivas({ dni: form.dni.trim() });
        if (!cancelled) {
          setCarrerasModal(data || []);
          if (!(data || []).length) { setSelectedCarreraModal(''); setSelectedPlanModal(''); }
        }
      } catch {
        if (!cancelled) setCarrerasModal([]);
      } finally {
        if (!cancelled) setCarrerasModalLoading(false);
      }
    };
    fetchCarreras();
    return () => { cancelled = true; };
  }, [creating, form.dni]);

  React.useEffect(() => {
    if (!creating || carrerasModalLoading) return;
    if (!carrerasModal.length) { setSelectedCarreraModal(''); setSelectedPlanModal(''); return; }
    if (selectedCarreraModal) {
      const actual = carrerasModal.find(c => String(c.profesorado_id) === selectedCarreraModal);
      if (!actual) { setSelectedCarreraModal(''); setSelectedPlanModal(''); return; }
      if (!selectedPlanModal || !actual.planes.some(p => String(p.id) === selectedPlanModal)) {
        const preferido = actual.planes.find(p => p.vigente) || actual.planes[0] || null;
        setSelectedPlanModal(preferido ? String(preferido.id) : '');
      }
      return;
    }
    if (carrerasModal.length === 1) {
      const unica = carrerasModal[0];
      setSelectedCarreraModal(String(unica.profesorado_id));
      const preferido = unica.planes.find(p => p.vigente) || unica.planes[0] || null;
      setSelectedPlanModal(preferido ? String(preferido.id) : '');
    }
  }, [creating, carrerasModal, carrerasModalLoading, selectedCarreraModal, selectedPlanModal]);

  const planesModal = React.useMemo(() => {
    if (!selectedCarreraModal) return [];
    const carrera = carrerasModal.find(c => String(c.profesorado_id) === selectedCarreraModal);
    return carrera ? carrera.planes : [];
  }, [carrerasModal, selectedCarreraModal]);

  const requiereSeleccionCarreraModal = creating && !carrerasModalLoading && carrerasModal.length > 1 && !selectedCarreraModal;
  const requiereSeleccionPlanModal = creating && !carrerasModalLoading && planesModal.length > 1 && !selectedPlanModal;

  const loadPedidos = async (id: number) => {
    try {
      const { data } = await api.get<Pedido[]>(`/estudiantes/analiticos_ext`, {
        params: { ventana_id: id, dni: dniFilter || undefined },
      });
      setPedidos(data || []);
    } catch { setPedidos([]); }
  };
  React.useEffect(() => { if (ventanaId) loadPedidos(Number(ventanaId)); }, [ventanaId, dniFilter]);

  const [descargando, setDescargando] = React.useState(false);

  const descargarPDF = async () => {
    if (!ventanaId) return;
    try {
      setDescargando(true);
      setError(null);
      const params: Record<string, string> = { ventana_id: ventanaId };
      if (dniFilter) params.dni = dniFilter;
      const response = await api.get(`/estudiantes/analiticos_ext/pdf`, { params, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analiticos_${ventanaId}${dniFilter ? `_${dniFilter}` : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch { setError('No se pudo descargar el PDF.'); }
    finally { setDescargando(false); }
  };

  const crearPedido = async () => {
    try {
      if (!form.dni.trim()) { setError('Ingresa un DNI para generar el pedido.'); return; }
      if (requiereSeleccionCarreraModal || requiereSeleccionPlanModal) {
        setError('Selecciona profesorado y plan antes de continuar.'); return;
      }
      const payload = {
        dni: form.dni || undefined,
        motivo: form.motivo,
        motivo_otro: form.motivo === 'otro' ? (form.motivo_otro || undefined) : undefined,
        cohorte: typeof form.cohorte === 'number' ? form.cohorte : undefined,
        profesorado_id: selectedPlanModal ? undefined : (selectedCarreraModal ? Number(selectedCarreraModal) : undefined),
        plan_id: selectedPlanModal ? Number(selectedPlanModal) : undefined,
      } as Parameters<typeof solicitarPedidoAnalitico>[0];
      await solicitarPedidoAnalitico(payload);
      setCreating(false);
      resetModalState();
      if (ventanaId) await loadPedidos(Number(ventanaId));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear el pedido');
    }
  };

  const handleConfeccionado = async (pedidoId: number) => {
    setLoadingAction(pedidoId);
    setError(null);
    try {
      await marcarAnaliticoConfeccionado(pedidoId);
      if (ventanaId) await loadPedidos(Number(ventanaId));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo marcar como confeccionado.');
    } finally { setLoadingAction(null); }
  };

  const handleEntregado = async (pedidoId: number) => {
    setLoadingAction(pedidoId);
    setError(null);
    try {
      await marcarAnaliticoEntregado(pedidoId);
      if (ventanaId) await loadPedidos(Number(ventanaId));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo marcar como entregado.');
    } finally { setLoadingAction(null); }
  };

  return (
    <Box sx={{ p: 2 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero title="Trámites Académicos" subtitle="Gestioná analíticos, equivalencias y cambios de comisión." />
      <TramitesNavTabs />


      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mt: 2 }}>
        <TextField select label="Periodo (Ventana)" size="small" value={ventanaId} onChange={e => setVentanaId(e.target.value)} sx={{ minWidth: 260 }}>
          {ventanas.map(v => (
            <MenuItem key={v.id} value={String(v.id)}>
              {new Date(v.desde).toLocaleDateString()} – {new Date(v.hasta).toLocaleDateString()} {v.activo ? '[Activo]' : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="DNI (opcional)" size="small" value={dniFilter} onChange={e => setDniFilter(e.target.value)} sx={{ maxWidth: 200 }} />
        <Button variant="contained" onClick={descargarPDF} disabled={!ventanaId || descargando}>
          {descargando ? 'Generando...' : 'Descargar PDF'}
        </Button>
        <Button variant="outlined" onClick={() => { resetModalState(); setCreating(true); }} disabled={!ventanaId}>
          Nuevo pedido
        </Button>
      </Stack>

      <Grid container spacing={1.5} sx={{ mt: 2 }}>
        {pedidos.map((p, i) => {
          const estado = p.estado ?? 'PEND';
          const isLoading = loadingAction === p.id;
          return (
            <Grid item xs={12} md={6} lg={4} key={p.id ?? i}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack gap={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{p.apellido_nombre}</Typography>
                      <Typography variant="body2" color="text.secondary">DNI: {p.dni}</Typography>
                    </Box>
                    <Chip
                      label={ESTADO_LABEL[estado] ?? estado}
                      color={ESTADO_COLOR[estado] ?? 'default'}
                      size="small"
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    {p.profesorado || '-'}{p.cohorte ? ` · Cohorte ${p.cohorte}` : ''}
                  </Typography>
                  {p.motivo && (
                    <Typography variant="caption" color="text.secondary">
                      Motivo: {MOTIVO_LABEL[p.motivo] ?? p.motivo}
                      {p.motivo === 'otro' && p.motivo_otro ? ` — ${p.motivo_otro}` : ''}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Solicitado: {new Date(p.fecha_solicitud).toLocaleString()}
                  </Typography>

                  {/* Acciones según estado — solo bedel/secretaria/admin */}
                  {puedeMarcarEstado && (
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {estado === 'PEND' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <AssignmentTurnedInIcon />}
                        disabled={isLoading}
                        onClick={() => handleConfeccionado(p.id)}
                      >
                        Marcar confeccionado
                      </Button>
                    )}
                    {estado === 'CONF' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                        disabled={isLoading}
                        onClick={() => handleEntregado(p.id)}
                      >
                        Marcar entregado
                      </Button>
                    )}
                  </Stack>
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
        {!pedidos.length && (
          <Grid item xs={12}><Alert severity="info">No hay pedidos en el periodo seleccionado.</Alert></Grid>
        )}
      </Grid>

      {/* Dialog nuevo pedido */}
      <Dialog open={creating} onClose={() => { setCreating(false); resetModalState(); }} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo pedido de analítico</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            <TextField label="DNI del estudiante" size="small" value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} />
            <FormControl size="small" disabled={!form.dni.trim() || carrerasModalLoading}>
              <InputLabel>Profesorado</InputLabel>
              <Select
                label="Profesorado"
                value={selectedCarreraModal}
                onChange={e => { setSelectedCarreraModal(String(e.target.value)); setSelectedPlanModal(''); setError(null); }}
                displayEmpty
              >
                {carrerasModalLoading && <MenuItem value="">Cargando...</MenuItem>}
                {!carrerasModalLoading && !carrerasModal.length && <MenuItem value="">Sin profesorados</MenuItem>}
                {carrerasModal.map(c => (
                  <MenuItem key={c.profesorado_id} value={String(c.profesorado_id)}>{c.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {planesModal.length > 1 && (
              <FormControl size="small">
                <InputLabel>Plan</InputLabel>
                <Select label="Plan" value={selectedPlanModal} onChange={e => { setSelectedPlanModal(String(e.target.value)); setError(null); }}>
                  {planesModal.map(p => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {p.resolucion ? `Plan ${p.resolucion}` : `Plan ${p.id}`}{p.vigente ? ' (vigente)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField select label="Motivo" size="small" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value as any }))}>
              <MenuItem value="equivalencia">Pedido de equivalencia</MenuItem>
              <MenuItem value="beca">Becas</MenuItem>
              <MenuItem value="control">Control</MenuItem>
              <MenuItem value="otro">Otro</MenuItem>
            </TextField>
            {form.motivo === 'otro' && (
              <TextField label="Detalle del motivo" size="small" value={form.motivo_otro || ''} onChange={e => setForm(f => ({ ...f, motivo_otro: e.target.value }))} />
            )}
            <TextField
              label="Cohorte (año de ingreso)"
              size="small"
              type="number"
              value={form.cohorte || ''}
              onChange={e => setForm(f => ({ ...f, cohorte: e.target.value ? Number(e.target.value) : '' }))}
            />
            {requiereSeleccionCarreraModal && <Alert severity="info">Selecciona un profesorado.</Alert>}
            {requiereSeleccionPlanModal && <Alert severity="info">Selecciona un plan.</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreating(false); resetModalState(); }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={crearPedido}
            disabled={!form.dni.trim() || carrerasModalLoading || requiereSeleccionCarreraModal || requiereSeleccionPlanModal}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
