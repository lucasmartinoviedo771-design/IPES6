import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MatrixRow, CorrSet, MateriaOption } from '../types';

interface CorrelativitiesEditorProps {
  open: boolean;
  onClose: () => void;
  rowEdit: MatrixRow | null;
  editSet: CorrSet;
  materiaOptions: MateriaOption[];
  handleFieldChange: (field: keyof CorrSet) => (_: React.SyntheticEvent, vals: MateriaOption[]) => void;
  onSave: () => void;
}

export function CorrelativitiesEditor({
  open,
  onClose,
  rowEdit,
  editSet,
  materiaOptions,
  handleFieldChange,
  onSave,
}: CorrelativitiesEditorProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Editar correlatividades — {rowEdit?.nombre}</DialogTitle>

      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <Autocomplete
            multiple
            options={materiaOptions}
            value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.regular_para_cursar.includes(o.id))}
            onChange={handleFieldChange('regular_para_cursar')}
            getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
            renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Regular" />}
          />

          <Autocomplete
            multiple
            options={materiaOptions}
            value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_cursar.includes(o.id))}
            onChange={handleFieldChange('aprobada_para_cursar')}
            getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
            renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Aprobada" />}
          />

          <Autocomplete
            multiple
            options={materiaOptions}
            value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_rendir.includes(o.id))}
            onChange={handleFieldChange('aprobada_para_rendir')}
            getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}
            renderInput={(p) => <TextField {...p} size="small" label="Para rendir: Aprobada" />}
          />

          <Typography variant="body2" color="text.secondary">
            Sugerencia: si no hay restricciones para una columna, dejala vacía (equivale a "Ninguna").
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={onSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}
