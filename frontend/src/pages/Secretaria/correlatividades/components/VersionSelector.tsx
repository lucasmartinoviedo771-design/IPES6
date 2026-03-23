import React from 'react';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import type { CorrelatividadVersion } from '../types';

interface VersionSelectorProps {
  planId: number | '';
  versiones: CorrelatividadVersion[];
  versionId: number | '';
  setVersionId: (val: number | '') => void;
  versionLoading: boolean;
  selectedVersion: CorrelatividadVersion | undefined;
  openVersionModalHandler: (mode: 'create' | 'duplicate' | 'edit') => void;
}

function versionRangeLabel(version: CorrelatividadVersion) {
  return version.cohorte_hasta ? `${version.cohorte_desde}-${version.cohorte_hasta}` : `${version.cohorte_desde}+`;
}

export function VersionSelector({
  planId,
  versiones,
  versionId,
  setVersionId,
  versionLoading,
  selectedVersion,
  openVersionModalHandler,
}: VersionSelectorProps) {
  if (!planId) return null;

  return (
    <>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth size="small" disabled={versionLoading || versiones.length === 0}>
          <InputLabel>Versión de correlatividades</InputLabel>
          <Select
            label="Versión de correlatividades"
            value={versionId === '' ? '' : String(versionId)}
            onChange={(e) => {
              const value = e.target.value;
              setVersionId(value === '' ? '' : Number(value));
            }}
          >
            <MenuItem value="">Seleccione</MenuItem>
            {versiones.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.nombre} — Cohortes {versionRangeLabel(v)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="flex-start">
          <Button variant="outlined" onClick={() => openVersionModalHandler('create')}>
            Nueva versión
          </Button>

          <Button
            variant="outlined"
            disabled={!selectedVersion}
            onClick={() => selectedVersion && openVersionModalHandler('duplicate')}
          >
            Duplicar versión
          </Button>

          <Button
            variant="outlined"
            disabled={!selectedVersion}
            onClick={() => selectedVersion && openVersionModalHandler('edit')}
          >
            Editar versión
          </Button>
        </Stack>
      </Grid>
    </>
  );
}
