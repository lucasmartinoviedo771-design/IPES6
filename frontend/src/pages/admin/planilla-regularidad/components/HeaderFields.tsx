import React from 'react';
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import { Controller, Control, UseFormSetValue } from 'react-hook-form';

import {
  RegularidadMetadataMateria,
  RegularidadMetadataPlantilla,
  RegularidadMetadataProfesorado,
} from '@/api/primeraCarga';
import { PlanillaFormValues } from '../types';
import { REGIMEN_LABELS } from '../constants';

interface HeaderFieldsProps {
  control: Control<PlanillaFormValues>;
  setValue: UseFormSetValue<PlanillaFormValues>;
  isReadOnly: boolean;
  crossLoadEnabled: boolean;
  onCrossLoadChange: (enabled: boolean) => void;
  profesorados: RegularidadMetadataProfesorado[];
  materias: RegularidadMetadataMateria[];
  plantillasDisponibles: RegularidadMetadataPlantilla[];
  selectedProfesorado?: RegularidadMetadataProfesorado;
  selectedMateria?: RegularidadMetadataMateria;
  selectedPlantilla?: RegularidadMetadataPlantilla;
  materiaAnioLabel: string | null;
  dictadoLabel: string | null;
  previewCodigo: string | null;
  situacionesDisponibles: any[];
  filaFields: any[];
  calculateSituacionForRow: (index: number) => void;
  mode: 'create' | 'edit' | 'view';
}

export const HeaderFields: React.FC<HeaderFieldsProps> = ({
  control,
  setValue,
  isReadOnly,
  crossLoadEnabled,
  onCrossLoadChange,
  profesorados,
  materias,
  plantillasDisponibles,
  selectedProfesorado,
  selectedMateria,
  selectedPlantilla,
  materiaAnioLabel,
  dictadoLabel,
  previewCodigo,
  situacionesDisponibles,
  filaFields,
  calculateSituacionForRow,
  mode,
}) => {
  return (
    <>
      <Typography variant="subtitle1" gutterBottom fontWeight={600}>
        Datos generales
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={crossLoadEnabled}
                onChange={(e) => onCrossLoadChange(e.target.checked)}
              />
            }
            label="Habilitar carga de comisiones cruzadas (Cargar en otro profesorado)"
          />
          {crossLoadEnabled && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Esta opción mostrará todos los profesorados disponibles. Utilícela solo para cargar estudiantes de comisiones o equivalencias.
            </Alert>
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            control={control}
            name="profesoradoId"
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Profesorado"
                fullWidth
                size="small"
                required
                onChange={(e) => {
                  field.onChange(e);
                  setValue('materiaId', '');
                  setValue('plantillaId', '');
                  setValue('planResolucion', '');
                }}
              >
                {profesorados.map((prof) => (
                  <MenuItem key={prof.id} value={prof.id}>
                    {prof.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            control={control}
            name="materiaId"
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Unidad curricular"
                fullWidth
                size="small"
                required
                disabled={!selectedProfesorado}
                onChange={(e) => {
                  field.onChange(e);
                  // Solo recalculamos automáticamente en modo creación.
                  // En edición, respetamos lo que viene de DB a menos que el usuario pulse el botón.
                  if (mode === 'create') {
                    setTimeout(() => {
                      filaFields.forEach((_, idx) => calculateSituacionForRow(idx));
                    }, 100);
                  }
                }}
              >
                {materias.map((materia) => (
                  <MenuItem key={materia.id} value={materia.id}>
                    {materia.nombre} ({materia.anio_cursada ?? '-'}°)
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            control={control}
            name="plantillaId"
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Plantilla"
                fullWidth
                size="small"
                required
                disabled={!selectedMateria}
                helperText={
                  selectedPlantilla
                    ? `${selectedPlantilla.formato.nombre} - ${selectedPlantilla.dictado}`
                    : 'Selecciona unidad curricular para habilitar'
                }
              >
                {plantillasDisponibles.map((plantilla) => (
                  <MenuItem key={plantilla.id} value={plantilla.id}>
                    {plantilla.nombre}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Controller
            control={control}
            name="fecha"
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label="Fecha de la planilla"
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
                required
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Controller
            control={control}
            name="folio"
            render={({ field }) => (
              <TextField {...field} label="Folio" fullWidth size="small" />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Controller
            control={control}
            name="planResolucion"
            render={({ field }) => (
              <TextField
                {...field}
                label="Resolución del plan"
                fullWidth
                size="small"
                helperText="Se sugiere mantener la resolución de la unidad curricular."
              />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <Controller
            control={control}
            name="observaciones"
            render={({ field }) => (
              <TextField
                {...field}
                label="Observaciones"
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          {!isReadOnly && (
            <Controller
              control={control}
              name="dry_run"
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Dry-run (simular sin guardar ni generar PDF)"
                />
              )}
            />
          )}
        </Grid>
      </Grid>

      {selectedMateria && selectedPlantilla && (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {materiaAnioLabel ? (
            <Chip size="small" label={`Año: ${materiaAnioLabel}`} variant="outlined" />
          ) : null}
          <Chip
            size="small"
            label={`Formato: ${selectedPlantilla.formato.nombre}`}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Dictado: ${dictadoLabel || selectedPlantilla.dictado}`}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Regimen: ${REGIMEN_LABELS[selectedMateria.regimen] ?? selectedMateria.regimen}`}
            variant="outlined"
          />
        </Box>
      )}

      {selectedPlantilla?.descripcion ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {selectedPlantilla.descripcion}
        </Typography>
      ) : null}

      {situacionesDisponibles.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Situaciones habilitadas: {situacionesDisponibles.map((s) => s.label || s.codigo).join(', ')}
        </Typography>
      )}

      {previewCodigo && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Vista previa del código (se asigna automáticamente al guardar): {previewCodigo}
          </Typography>
        </Box>
      )}
    </>
  );
};
