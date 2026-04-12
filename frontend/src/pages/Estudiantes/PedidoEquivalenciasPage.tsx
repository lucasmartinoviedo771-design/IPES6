import React, { useState, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { DNI_COMPLETO_LENGTH } from "./pedido-equivalencias/utils";
import { usePedidoEquivalencias } from "./pedido-equivalencias/usePedidoEquivalencias";
import PedidosListPanel from "./pedido-equivalencias/PedidosListPanel";
import TrayectoFormPanel from "./pedido-equivalencias/TrayectoFormPanel";

const PedidoEquivalenciasPage: React.FC = () => {
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

  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1) {
       handleNuevoPedido(); // Reset form when going to "New"
    }
  };

  const onNuevoPedidoFromList = () => {
    setTabValue(1);
    handleNuevoPedido();
  };

  const otorgadas = useMemo(() => {
    const list: any[] = [];
    pedidos.forEach(p => {
        p.materias.forEach(m => {
            if (m.resultado === 'otorgada') {
                list.push({
                    ...m,
                    profesorado: p.profesorado_destino_nombre,
                    resolucion: p.plan_destino_resolucion,
                    disposicion: p.titulos_disposicion_numero || p.titulos_nota_numero
                });
            }
        });
    });
    return list;
  }, [pedidos]);

  return (
    <Box sx={{ p: 3, bgcolor: "#fdfcf9", minHeight: "100vh" }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Trámites de Equivalencias"
        subtitle="Gestioná tus solicitudes de equivalencia interna o externa y consultá tus resultados."
      />

      {canGestionar && (
        <TextField
          label="DNI del estudiante"
          value={dniManual}
          onChange={(event) => setDniManual(event.target.value.replace(/\D/g, ""))}
          fullWidth
          size="small"
          sx={{ maxWidth: 360, mb: 3, mt: 2 }}
          helperText="Ingresá el DNI para gestionar en nombre del estudiante."
          inputProps={{ maxLength: DNI_COMPLETO_LENGTH, inputMode: "numeric", pattern: "[0-9]*" }}
          error={dniParcial}
        />
      )}

      {requiereDni ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {dniObjetivo.length === 0
            ? "Ingresá un DNI de 8 dígitos para ver los trámites."
            : "Completá los 8 dígitos del DNI para continuar."}
        </Alert>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
            <Tabs 
                value={tabValue} 
                onChange={handleTabChange}
                sx={{
                    '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '1rem' },
                    '& .Mui-selected': { color: '#8b4513' },
                    '& .MuiTabs-indicator': { backgroundColor: '#8b4513' }
                }}
            >
              <Tab label="Pedidos en curso" />
              <Tab label="Hacer un pedido" disabled={!ventanaActiva} />
              <Tab label="Equivalencias otorgadas" />
            </Tabs>
          </Box>

          {!ventanaActiva && tabValue === 1 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No hay una ventana activa para registrar nuevos pedidos de equivalencias.
            </Alert>
          )}

          {tabValue === 0 && (
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
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed #ccc' }}>
                        <Typography color="text.secondary">
                            Seleccioná un pedido del listado para ver su detalle o estado.
                        </Typography>
                    </Paper>
                )}
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && ventanaActiva && (
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
          )}

          {tabValue === 2 && (
            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e3d7bc' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Materias Otorgadas por Equivalencia
              </Typography>
              {otorgadas.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                    Aún no tenés materias otorgadas por equivalencia.
                </Typography>
              ) : (
                <List>
                  {otorgadas.map((m, idx) => (
                    <React.Fragment key={idx}>
                        <ListItem sx={{ py: 2 }}>
                            <ListItemText 
                                primary={
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {m.nombre}
                                    </Typography>
                                }
                                secondary={
                                    <Stack spacing={0.5} mt={0.5}>
                                        <Typography variant="body2">{m.profesorado} - {m.resolucion}</Typography>
                                        {m.disposicion && (
                                            <Typography variant="caption" color="primary" fontWeight={600}>
                                                Disposición/Nota: {m.disposicion}
                                            </Typography>
                                        )}
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
          )}
        </>
      )}
    </Box>
  );
};

export default PedidoEquivalenciasPage;
