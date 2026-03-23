import React from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { CorrelatividadVersion } from '../types';

interface VersionBadgesProps {
  selectedVersion: CorrelatividadVersion | undefined;
}

function versionRangeLabel(version: CorrelatividadVersion) {
  return version.cohorte_hasta ? `${version.cohorte_desde}-${version.cohorte_hasta}` : `${version.cohorte_desde}+`;
}

export function VersionBadges({ selectedVersion }: VersionBadgesProps) {
  if (!selectedVersion) return null;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mb={2}>
      <Chip color="primary" label={`Cohortes ${versionRangeLabel(selectedVersion)}`} />

      {selectedVersion.vigencia_desde && (
        <Chip
          label={`Vigencia ${selectedVersion.vigencia_desde}${selectedVersion.vigencia_hasta ? ` al ${selectedVersion.vigencia_hasta}` : ''}`}
        />
      )}

      <Chip
        label={selectedVersion.activo ? 'Activa' : 'Inactiva'}
        color={selectedVersion.activo ? 'success' : 'default'}
      />

      <Chip label={`${selectedVersion.correlatividades} correlatividades`} />
    </Stack>
  );
}
