import React, { useState } from 'react';
import Box from "@mui/material/Box";

import { registrarDisposicionEquivalenciaPrimeraCarga } from '@/api/primeraCarga';
import { EquivalenciaDisposicionPayload } from '@/api/estudiantes';
import PlanillaRegularidadDialog from './PlanillaRegularidadDialog';
import EquivalenciaDisposicionDialog from '@/components/equivalencias/EquivalenciaDisposicionDialog';
import NotaMesaPandemiaDialog from './NotaMesaPandemiaDialog';
import { PageHero } from '@/components/ui/GradientTitles';
import {
  INSTITUTIONAL_TERRACOTTA,
  INSTITUTIONAL_GREEN,
} from '@/styles/institutionalColors';
import StudentManualDialog from './primera-carga/StudentManualDialog';
import CargaCards from './primera-carga/CargaCards';

const PrimeraCargaPage: React.FC = () => {
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [openPlanillaDialog, setOpenPlanillaDialog] = useState(false);
  const [openDisposicionDialog, setOpenDisposicionDialog] = useState(false);
  const [openMesaPandemiaDialog, setOpenMesaPandemiaDialog] = useState(false);

  const handleRegistrarDisposicionPrimeraCarga = async (
    payload: EquivalenciaDisposicionPayload,
  ) => {
    await registrarDisposicionEquivalenciaPrimeraCarga(payload);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Primera carga de datos"
        subtitle="Utilizá esta sección para realizar cargas iniciales de información histórica en el sistema."
        sx={{
          background: `linear-gradient(120deg, ${INSTITUTIONAL_GREEN} 0%, ${INSTITUTIONAL_TERRACOTTA} 100%)`,
        }}
      />

      <CargaCards
        onOpenStudentDialog={() => setOpenStudentDialog(true)}
        onOpenPlanillaDialog={() => setOpenPlanillaDialog(true)}
        onOpenMesaPandemiaDialog={() => setOpenMesaPandemiaDialog(true)}
        onOpenDisposicionDialog={() => setOpenDisposicionDialog(true)}
      />

      {/* ── Dialogs ── */}
      <StudentManualDialog
        open={openStudentDialog}
        onClose={() => setOpenStudentDialog(false)}
      />

      <NotaMesaPandemiaDialog
        open={openMesaPandemiaDialog}
        onClose={() => setOpenMesaPandemiaDialog(false)}
      />

      <EquivalenciaDisposicionDialog
        open={openDisposicionDialog}
        onClose={() => setOpenDisposicionDialog(false)}
        title="Registrar equivalencias (Primera carga)"
        submitLabel="Registrar equivalencias"
        onSubmit={handleRegistrarDisposicionPrimeraCarga}
        requiresCorrelatividades={false}
      />

      <PlanillaRegularidadDialog
        open={openPlanillaDialog}
        onClose={() => setOpenPlanillaDialog(false)}
      />
    </Box>
  );
};

export default PrimeraCargaPage;
