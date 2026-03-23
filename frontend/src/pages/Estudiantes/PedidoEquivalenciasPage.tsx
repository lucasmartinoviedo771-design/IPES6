import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
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

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Pedido de equivalencias"
        subtitle="Generá la nota oficial (Anexo A o B) y gestioná tus presentaciones ante Secretaría."
      />

      {!ventanaActiva && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No hay una ventana activa para registrar pedidos de equivalencias.
        </Alert>
      )}

      {canGestionar && (
        <TextField
          label="DNI del estudiante"
          value={dniManual}
          onChange={(event) => setDniManual(event.target.value.replace(/\D/g, ""))}
          fullWidth
          size="small"
          sx={{ maxWidth: 360, mb: 2 }}
          helperText="Ingresá los 8 dígitos del DNI del estudiante para gestionar en su nombre."
          inputProps={{ maxLength: DNI_COMPLETO_LENGTH, inputMode: "numeric", pattern: "[0-9]*" }}
          error={dniParcial}
        />
      )}

      {requiereDni && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {dniObjetivo.length === 0
            ? "Ingresá un DNI de 8 dígitos para cargar o revisar los pedidos."
            : "Completá los 8 dígitos del DNI para continuar."}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={4}>
          <PedidosListPanel
            pedidos={pedidos}
            loadingPedidos={loadingPedidos}
            selectedId={selectedId}
            eliminandoId={eliminandoId}
            descargando={descargando}
            canGestionar={canGestionar}
            onSelectPedido={handleSelectPedido}
            onNuevoPedido={handleNuevoPedido}
            onEliminar={handleEliminar}
            onDescargar={handleDescargar}
          />
        </Grid>

        <Grid item xs={12} lg={8}>
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default PedidoEquivalenciasPage;
