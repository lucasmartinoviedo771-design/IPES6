import React from "react";
import Box from "@mui/material/Box";

import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { TramitesNavTabs } from "@/components/ui/TramitesNavTabs";
import { useCarreras as useCatalogoCarreras } from "@/hooks/useCarreras";
import EquivalenciaDisposicionDialog from "@/components/equivalencias/EquivalenciaDisposicionDialog";

import { usePedidosEquivalencias } from "./pedidos-equivalencias/usePedidosEquivalencias";
import FiltrosCard from "./pedidos-equivalencias/FiltrosCard";
import DisposicionesCard from "./pedidos-equivalencias/DisposicionesCard";
import PedidosTable from "./pedidos-equivalencias/PedidosTable";
import DocumentacionDialog from "./pedidos-equivalencias/DocumentacionDialog";
import EvaluacionDialog from "./pedidos-equivalencias/EvaluacionDialog";
import TitulosDialog from "./pedidos-equivalencias/TitulosDialog";
import NotificarDialog from "./pedidos-equivalencias/NotificarDialog";

const PedidosEquivalenciasPage: React.FC = () => {
  const { data: profesorados = [] } = useCatalogoCarreras();

  const {
    // roles
    isTutor,
    isEquivalencias,
    isTitulos,
    // data
    loading,
    pedidos,
    disposiciones,
    loadingDisposiciones,
    ventanaOptions,
    // filters
    filters,
    setFilters,
    // disposicion dialog
    openDisposicionDialog,
    setOpenDisposicionDialog,
    handleRegistrarDisposicion,
    // pdf
    downloadingId,
    handleDescargarPDF,
    // enviar
    enviandoId,
    handleEnviarPedido,
    // documentacion dialog
    documentacionDialog,
    documentacionForm,
    setDocumentacionForm,
    documentacionSaving,
    handleOpenDocumentacionDialog,
    handleCloseDocumentacionDialog,
    handleSubmitDocumentacion,
    // evaluacion dialog
    evaluacionDialog,
    evaluacionForm,
    setEvaluacionForm,
    evaluacionObservaciones,
    setEvaluacionObservaciones,
    evaluacionSaving,
    handleOpenEvaluacionDialog,
    handleCloseEvaluacionDialog,
    handleSubmitEvaluacion,
    // titulos dialog
    titulosDialog,
    titulosForm,
    setTitulosForm,
    titulosSaving,
    handleOpenTitulosDialog,
    handleCloseTitulosDialog,
    handleSubmitTitulos,
    // notificar dialog
    notificarDialog,
    notificarMensaje,
    setNotificarMensaje,
    notificarSaving,
    handleOpenNotificarDialog,
    handleCloseNotificarDialog,
    handleSubmitNotificar,
  } = usePedidosEquivalencias();

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Trámites Académicos"
        subtitle="Gestioná analíticos, equivalencias y cambios de comisión."
      />
      <TramitesNavTabs />

      <FiltrosCard
        filters={filters}
        setFilters={setFilters}
        profesorados={profesorados}
        ventanaOptions={ventanaOptions}
      />

      <SectionTitlePill title="Disposiciones de equivalencia" />
      <DisposicionesCard
        disposiciones={disposiciones}
        loadingDisposiciones={loadingDisposiciones}
        dniFilter={filters.dni}
        onOpenDisposicionDialog={() => setOpenDisposicionDialog(true)}
      />

      <SectionTitlePill title="Resultados" />
      <PedidosTable
        loading={loading}
        pedidos={pedidos}
        downloadingId={downloadingId}
        enviandoId={enviandoId}
        isTutor={isTutor}
        isEquivalencias={isEquivalencias}
        isTitulos={isTitulos}
        onDescargarPDF={handleDescargarPDF}
        onEnviarPedido={handleEnviarPedido}
        onOpenDocumentacion={handleOpenDocumentacionDialog}
        onOpenEvaluacion={handleOpenEvaluacionDialog}
        onOpenTitulos={handleOpenTitulosDialog}
        onOpenNotificar={handleOpenNotificarDialog}
      />

      <DocumentacionDialog
        open={documentacionDialog.open}
        pedido={documentacionDialog.pedido}
        form={documentacionForm}
        setForm={setDocumentacionForm}
        saving={documentacionSaving}
        onClose={handleCloseDocumentacionDialog}
        onSubmit={handleSubmitDocumentacion}
      />

      <EvaluacionDialog
        open={evaluacionDialog.open}
        pedido={evaluacionDialog.pedido}
        evaluacionForm={evaluacionForm}
        setEvaluacionForm={setEvaluacionForm}
        evaluacionObservaciones={evaluacionObservaciones}
        setEvaluacionObservaciones={setEvaluacionObservaciones}
        saving={evaluacionSaving}
        onClose={handleCloseEvaluacionDialog}
        onSubmit={handleSubmitEvaluacion}
      />

      <TitulosDialog
        open={titulosDialog.open}
        pedido={titulosDialog.pedido}
        form={titulosForm}
        setForm={setTitulosForm}
        saving={titulosSaving}
        onClose={handleCloseTitulosDialog}
        onSubmit={handleSubmitTitulos}
      />

      <NotificarDialog
        open={notificarDialog.open}
        pedido={notificarDialog.pedido}
        mensaje={notificarMensaje}
        setMensaje={setNotificarMensaje}
        saving={notificarSaving}
        onClose={handleCloseNotificarDialog}
        onSubmit={handleSubmitNotificar}
      />

      <EquivalenciaDisposicionDialog
        open={openDisposicionDialog}
        onClose={() => setOpenDisposicionDialog(false)}
        title="Registrar disposición de equivalencias"
        submitLabel="Registrar disposición"
        onSubmit={handleRegistrarDisposicion}
      />
    </Box>
  );
};

export default PedidosEquivalenciasPage;
