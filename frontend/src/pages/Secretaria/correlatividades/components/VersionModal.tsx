import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';

type VersionFormState = {
  nombre: string;
  descripcion: string;
  cohorteDesde: string;
  cohorteHasta: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
};

interface VersionModalProps {
  open: boolean;
  onClose: () => void;
  versionModalMode: 'create' | 'duplicate' | 'edit';
  versionForm: VersionFormState;
  setVersionForm: React.Dispatch<React.SetStateAction<VersionFormState>>;
  handleVersionFieldChange: (field: keyof VersionFormState) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

export function VersionModal({
  open,
  onClose,
  versionModalMode,
  versionForm,
  setVersionForm,
  handleVersionFieldChange,
  onSubmit,
}: VersionModalProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {versionModalMode === 'edit'
          ? 'Editar versión de correlatividades'
          : versionModalMode === 'duplicate'
            ? 'Duplicar versión'
            : 'Nueva versión de correlatividades'}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={versionForm.nombre}
            onChange={handleVersionFieldChange('nombre')}
            fullWidth
          />

          <TextField
            label="Descripción (opcional)"
            value={versionForm.descripcion}
            onChange={handleVersionFieldChange('descripcion')}
            fullWidth
            multiline
            minRows={2}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Cohorte desde"
              type="number"
              fullWidth
              value={versionForm.cohorteDesde}
              onChange={handleVersionFieldChange('cohorteDesde')}
            />

            <TextField
              label="Cohorte hasta"
              type="number"
              fullWidth
              value={versionForm.cohorteHasta}
              onChange={handleVersionFieldChange('cohorteHasta')}
              helperText="Dejar vacío para aplicar en adelante"
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Vigencia desde"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={versionForm.vigenciaDesde}
              onChange={handleVersionFieldChange('vigenciaDesde')}
            />

            <TextField
              label="Vigencia hasta"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={versionForm.vigenciaHasta}
              onChange={handleVersionFieldChange('vigenciaHasta')}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={versionForm.activo}
                onChange={(e) => setVersionForm((prev) => ({ ...prev, activo: e.target.checked }))}
              />
            }
            label="Versión activa"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={onSubmit}>
          {versionModalMode === 'edit' ? 'Guardar cambios' : 'Guardar versión'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
