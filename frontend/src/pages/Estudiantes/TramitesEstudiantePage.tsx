import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { solicitarPedidoAnalitico, obtenerCarrerasActivas, TrayectoriaCarreraDetalleDTO } from "@/api/estudiantes";
import { fetchVentanas, VentanaDto } from "@/api/ventanas";
import { useAuth } from "@/context/AuthContext";
import { usePedidoEquivalencias } from "./pedido-equivalencias/usePedidoEquivalencias";
import PedidosListPanel from "./pedido-equivalencias/PedidosListPanel";
import TrayectoFormPanel from "./pedido-equivalencias/TrayectoFormPanel";
import { DNI_COMPLETO_LENGTH } from "./pedido-equivalencias/utils";

// ── Estilos tabs ────────────────────────────────────────────────────────────
const TAB_SX = {
  "& .MuiTab-root": { fontWeight: 600, textTransform: "none", fontSize: "1rem", minHeight: 52 },
  "& .Mui-selected": { color: "#8b4513" },
  "& .MuiTabs-indicator": { backgroundColor: "#8b4513" },
};

// ── Tab 0: Mi Analítico ─────────────────────────────────────────────────────
const MiAnaliticoTab: React.FC = () => {
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const canGestionar = !!user && (user.is_superuser || (user.roles || []).some((r: string) => ["admin", "secretaria", "bedel", "tutor"].includes((r || "").toLowerCase())));

  const [ventanaActiva, setVentanaActiva] = useState<VentanaDto | null>(null);
  const [carreras, setCarreras] = useState<TrayectoriaCarreraDetalleDTO[]>([]);
  const [carrerasLoading, setCarrerasLoading] = useState(false);
  const [selectedCarreraId, setSelectedCarreraId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [motivo, setMotivo] = useState<"equivalencia" | "beca" | "control" | "otro">("equivalencia");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [dni, setDni] = useState("");
  const [cohorte, setCohorte] = useState<number | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVentanas({ tipo: "ANALITICOS" })
      .then((data) => setVentanaActiva((data || []).find((x) => x.activo) || null))
      .catch(() => setVentanaActiva(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (canGestionar && !dni.trim()) { setCarreras([]); setSelectedCarreraId(""); setSelectedPlanId(""); return; }
    setCarrerasLoading(true);
    obtenerCarrerasActivas(canGestionar ? (dni ? { dni } : undefined) : undefined)
      .then((data) => { if (!cancelled) setCarreras(data || []); })
      .catch(() => { if (!cancelled) setCarreras([]); })
      .finally(() => { if (!cancelled) setCarrerasLoading(false); });
    return () => { cancelled = true; };
  }, [canGestionar, dni]);

  useEffect(() => {
    if (carrerasLoading || !carreras.length) { if (!carrerasLoading) { setSelectedCarreraId(""); setSelectedPlanId(""); } return; }
    if (selectedCarreraId) {
      const actual = carreras.find((c) => String(c.profesorado_id) === selectedCarreraId);
      if (!actual) { setSelectedCarreraId(""); setSelectedPlanId(""); return; }
      if (!selectedPlanId || !actual.planes.some((p) => String(p.id) === selectedPlanId)) {
        const pref = actual.planes.find((p) => p.vigente) || actual.planes[0] || null;
        setSelectedPlanId(pref ? String(pref.id) : "");
      }
      return;
    }
    if (carreras.length === 1) {
      const u = carreras[0];
      setSelectedCarreraId(String(u.profesorado_id));
      const pref = u.planes.find((p) => p.vigente) || u.planes[0] || null;
      setSelectedPlanId(pref ? String(pref.id) : "");
    }
  }, [carreras, carrerasLoading, selectedCarreraId, selectedPlanId]);

  const planesDisponibles = useMemo(() => {
    const c = carreras.find((x) => String(x.profesorado_id) === selectedCarreraId);
    return c ? c.planes : [];
  }, [carreras, selectedCarreraId]);

  const requiereCarrera = !carrerasLoading && carreras.length > 1 && !selectedCarreraId;
  const requierePlan = !carrerasLoading && planesDisponibles.length > 1 && !selectedPlanId;
  const puedeEnviar = !!ventanaActiva && !requiereCarrera && !requierePlan && !(canGestionar && !dni.trim());

  const handleSubmit = async () => {
    if (!puedeEnviar) return;
    try {
      const res = await solicitarPedidoAnalitico({
        motivo,
        motivo_otro: motivo === "otro" ? motivoOtro : undefined,
        dni: canGestionar ? (dni || undefined) : undefined,
        cohorte: typeof cohorte === "number" ? cohorte : undefined,
        profesorado_id: selectedPlanId ? undefined : (selectedCarreraId ? Number(selectedCarreraId) : undefined),
        plan_id: selectedPlanId ? Number(selectedPlanId) : undefined,
      });
      setMessage(res.message);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al solicitar pedido de analítico.");
      setMessage(null);
    }
  };

  return (
    <Box>
      {!ventanaActiva && <Alert severity="warning" sx={{ mb: 2 }}>No hay período activo para pedido de analítico.</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Completá el motivo del pedido. Una vez enviado, te notificaremos cuando tu analítico esté listo para retirar.
      </Typography>

      <Stack gap={2} sx={{ maxWidth: 480 }}>
        {canGestionar && (
          <TextField label="DNI del estudiante" size="small" value={dni} onChange={(e) => setDni(e.target.value)} />
        )}
        <FormControl size="small" disabled={carrerasLoading || (canGestionar && !dni.trim() && !carreras.length)}>
          <InputLabel>Profesorado</InputLabel>
          <Select label="Profesorado" value={selectedCarreraId} onChange={(e) => { setSelectedCarreraId(String(e.target.value)); setSelectedPlanId(""); }}>
            {carrerasLoading && <MenuItem value="">Cargando...</MenuItem>}
            {!carrerasLoading && !carreras.length && <MenuItem value="">Sin profesorados</MenuItem>}
            {carreras.map((c) => <MenuItem key={c.profesorado_id} value={String(c.profesorado_id)}>{c.nombre}</MenuItem>)}
          </Select>
        </FormControl>
        {planesDisponibles.length > 1 && (
          <FormControl size="small">
            <InputLabel>Plan</InputLabel>
            <Select label="Plan" value={selectedPlanId} onChange={(e) => setSelectedPlanId(String(e.target.value))}>
              {planesDisponibles.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.resolucion ? `Plan ${p.resolucion}` : `Plan ${p.id}`}{p.vigente ? " (vigente)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <TextField select label="Motivo" size="small" value={motivo} onChange={(e) => setMotivo(e.target.value as any)}>
          <MenuItem value="equivalencia">Pedido de equivalencia</MenuItem>
          <MenuItem value="beca">Becas</MenuItem>
          <MenuItem value="control">Control</MenuItem>
          <MenuItem value="otro">Otro</MenuItem>
        </TextField>
        {motivo === "otro" && (
          <TextField label="Detalle del motivo" size="small" value={motivoOtro} onChange={(e) => setMotivoOtro(e.target.value)} />
        )}
        <TextField label="Cohorte (año de ingreso)" size="small" type="number" value={cohorte} onChange={(e) => setCohorte(e.target.value ? Number(e.target.value) : "")} />
      </Stack>

      {requiereCarrera && <Alert severity="info" sx={{ maxWidth: 480, mt: 2 }}>Seleccioná un profesorado antes de continuar.</Alert>}
      {requierePlan && <Alert severity="info" sx={{ maxWidth: 480, mt: 2 }}>Seleccioná un plan de estudios.</Alert>}
      {canGestionar && !dni.trim() && <Alert severity="info" sx={{ maxWidth: 480, mt: 2 }}>Ingresá un DNI para gestionar en nombre del estudiante.</Alert>}

      <Button variant="contained" onClick={handleSubmit} disabled={!puedeEnviar} sx={{ mt: 3 }}>
        Enviar Solicitud
      </Button>
    </Box>
  );
};

// ── Tab 2: Equivalencias otorgadas ──────────────────────────────────────────
const EquivalenciasOtorgadasTab: React.FC<{ pedidos: any[] }> = ({ pedidos }) => {
  const otorgadas = useMemo(() => {
    const list: any[] = [];
    pedidos.forEach((p) => {
      p.materias.forEach((m: any) => {
        if (m.resultado === "otorgada") {
          list.push({ ...m, profesorado: p.profesorado_destino_nombre, resolucion: p.plan_destino_resolucion, disposicion: p.titulos_disposicion_numero || p.titulos_nota_numero });
        }
      });
    });
    return list;
  }, [pedidos]);

  return (
    <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e3d7bc" }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Materias otorgadas por equivalencia</Typography>
      {otorgadas.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>Aún no tenés materias otorgadas por equivalencia.</Typography>
      ) : (
        <List>
          {otorgadas.map((m, idx) => (
            <React.Fragment key={idx}>
              <ListItem sx={{ py: 2 }}>
                <ListItemText
                  primary={<Typography variant="subtitle1" fontWeight={600}>{m.nombre}</Typography>}
                  secondary={
                    <Stack spacing={0.5} mt={0.5}>
                      <Typography variant="body2">{m.profesorado} — {m.resolucion}</Typography>
                      {m.disposicion && <Typography variant="caption" color="primary" fontWeight={600}>Disposición/Nota: {m.disposicion}</Typography>}
                    </Stack>
                  }
                />
                <Chip label="OTORGADA" color="success" size="small" variant="outlined" />
              </ListItem>
              {idx < otorgadas.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

// ── Página principal ────────────────────────────────────────────────────────
const TramitesEstudiantePage: React.FC = () => {
  const [tab, setTab] = useState(0);

  const {
    canGestionar, dniManual, setDniManual, dniObjetivo, requiereDni, dniParcial,
    ventanaActiva,
    pedidos, loadingPedidos, selectedId, selectedPedido, puedeEditar,
    handleSelectPedido, handleNuevoPedido, handleEliminar,
    form, setForm, materias,
    tipoSeleccionado, esAnexoA, esAnexoB, datosDeshabilitados,
    puedeGuardar, puedeDescargar, saving, descargando, eliminandoId,
    carrerasDestino, carrerasEstudiante, carrerasLoading, planesOrigenDisponibles,
    trayectoriaLoading,
    handleMateriaChange, handleAddMateria, handleRemoveMateria,
    handleGuardar, handleDescargar,
  } = usePedidoEquivalencias();

  const onNuevoPedidoFromList = () => handleNuevoPedido();

  return (
    <Box sx={{ p: 3, bgcolor: "#fdfcf9", minHeight: "100vh" }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Mis Trámites"
        subtitle="Gestioná tus pedidos de analítico, equivalencias y consultá tus resultados."
      />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, mt: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={TAB_SX}>
          <Tab label="Mi Analítico" icon={<AssignmentIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Pedir equivalencia" icon={<CompareArrowsIcon fontSize="small" />} iconPosition="start" disabled={!ventanaActiva && pedidos.length === 0} />
          <Tab label="Equivalencias otorgadas" icon={<CheckCircleOutlineIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab 0: Mi Analítico */}
      {tab === 0 && <MiAnaliticoTab />}

      {/* Tab 1: Equivalencias */}
      {tab === 1 && (
        <>
          {canGestionar && (
            <TextField
              label="DNI del estudiante"
              value={dniManual}
              onChange={(e) => setDniManual(e.target.value.replace(/\D/g, ""))}
              fullWidth
              size="small"
              sx={{ maxWidth: 360, mb: 3 }}
              helperText="Ingresá el DNI para gestionar en nombre del estudiante."
              inputProps={{ maxLength: DNI_COMPLETO_LENGTH, inputMode: "numeric", pattern: "[0-9]*" }}
              error={dniParcial}
            />
          )}
          {requiereDni ? (
            <Alert severity="info">
              {dniObjetivo.length === 0 ? "Ingresá un DNI de 8 dígitos para ver los trámites." : "Completá los 8 dígitos del DNI para continuar."}
            </Alert>
          ) : (
            <>
              {!ventanaActiva && (
                <Alert severity="warning" sx={{ mb: 2 }}>No hay una ventana activa para registrar nuevos pedidos de equivalencias.</Alert>
              )}
              <Grid container spacing={3}>
                <Grid item xs={12} lg={4}>
                  <PedidosListPanel
                    pedidos={pedidos}
                    loadingPedidos={loadingPedidos}
                    selectedId={selectedId}
                    eliminandoId={eliminandoId}
                    descargando={descargando}
                    canGestionar={canGestionar}
                    onSelectPedido={handleSelectPedido}
                    onNuevoPedido={onNuevoPedidoFromList}
                    onEliminar={handleEliminar}
                    onDescargar={handleDescargar}
                  />
                </Grid>
                <Grid item xs={12} lg={8}>
                  {selectedId ? (
                    <TrayectoFormPanel
                      form={form}
                      setForm={setForm}
                      materias={materias}
                      selectedId={selectedId}
                      puedeEditar={puedeEditar}
                      datosDeshabilitados={datosDeshabilitados}
                      esAnexoA={esAnexoA}
                      esAnexoB={esAnexoB}
                      puedeGuardar={puedeGuardar}
                      puedeDescargar={puedeDescargar}
                      saving={saving}
                      descargando={descargando}
                      carrerasDestino={carrerasDestino}
                      carrerasEstudiante={carrerasEstudiante}
                      carrerasLoading={carrerasLoading}
                      planesOrigenDisponibles={planesOrigenDisponibles}
                      trayectoriaLoading={trayectoriaLoading}
                      selectedPedido={selectedPedido}
                      onMateriaChange={handleMateriaChange}
                      onAddMateria={handleAddMateria}
                      onRemoveMateria={handleRemoveMateria}
                      onGuardar={handleGuardar}
                      onDescargar={handleDescargar}
                    />
                  ) : ventanaActiva ? (
                    <TrayectoFormPanel
                      form={form}
                      setForm={setForm}
                      materias={materias}
                      selectedId={null}
                      puedeEditar={true}
                      datosDeshabilitados={datosDeshabilitados}
                      esAnexoA={esAnexoA}
                      esAnexoB={esAnexoB}
                      puedeGuardar={puedeGuardar}
                      puedeDescargar={false}
                      saving={saving}
                      descargando={false}
                      carrerasDestino={carrerasDestino}
                      carrerasEstudiante={carrerasEstudiante}
                      carrerasLoading={carrerasLoading}
                      planesOrigenDisponibles={planesOrigenDisponibles}
                      trayectoriaLoading={trayectoriaLoading}
                      selectedPedido={null}
                      onMateriaChange={handleMateriaChange}
                      onAddMateria={handleAddMateria}
                      onRemoveMateria={handleRemoveMateria}
                      onGuardar={handleGuardar}
                      onDescargar={handleDescargar}
                    />
                  ) : (
                    <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3, border: "1px dashed #ccc" }}>
                      <Typography color="text.secondary">Seleccioná un pedido del listado para ver su detalle o estado.</Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}

      {/* Tab 2: Equivalencias otorgadas */}
      {tab === 2 && <EquivalenciasOtorgadasTab pedidos={pedidos} />}
    </Box>
  );
};

export default TramitesEstudiantePage;
