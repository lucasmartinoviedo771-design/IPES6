import React from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';

interface PendingChangesBarProps {
  pendingCount: number;
  loading: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export function PendingChangesBar({ pendingCount, loading, onDiscard, onSave }: PendingChangesBarProps) {
  return (
    <Grid item xs={12} md={3} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
      <Button variant="outlined" disabled={!pendingCount} onClick={onDiscard}>
        Descartar cambios
      </Button>

      <Button variant="contained" disabled={!pendingCount || loading} onClick={onSave}>
        Guardar cambios {pendingCount ? `(${pendingCount})` : ''}
      </Button>
    </Grid>
  );
}
