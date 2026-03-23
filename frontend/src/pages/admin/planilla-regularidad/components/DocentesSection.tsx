import React from 'react';
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Controller, Control, UseFormSetValue } from 'react-hook-form';
import { FieldArrayWithId } from 'react-hook-form';

import { PlanillaFormValues, PlanillaDocenteFormValues } from '../types';

interface DoceneteOption {
  id: number;
  nombre: string;
  dni?: string | null;
}

interface DocentesSectionProps {
  control: Control<PlanillaFormValues>;
  setValue: UseFormSetValue<PlanillaFormValues>;
  isReadOnly: boolean;
  docenteFields: FieldArrayWithId<PlanillaFormValues, 'docentes', 'id'>[];
  docentesForm: PlanillaDocenteFormValues[];
  docentesOptions: DoceneteOption[];
  docentesMap: Map<number, DoceneteOption>;
  handleAddDocente: () => void;
  handleRemoveDocente: (index: number) => void;
}

export const DocentesSection: React.FC<DocentesSectionProps> = ({
  control,
  setValue,
  isReadOnly,
  docenteFields,
  docentesForm,
  docentesOptions,
  docentesMap,
  handleAddDocente,
  handleRemoveDocente,
}) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Docentes / Firmantes</Typography>
        {!isReadOnly && (
          <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleAddDocente}>
            Agregar firmante
          </Button>
        )}
      </Box>

      {docenteFields.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Agrega al menos al docente responsable y al bedel responsable antes de generar la planilla.
        </Alert>
      )}

      <Grid container spacing={3}>
        {docenteFields.map((field, index) => (
          <React.Fragment key={field.id}>
            <Grid item xs={12} md={5}>
              <Controller
                control={control}
                name={`docentes.${index}.nombre`}
                render={({ field: controllerField }) => {
                  const currentDocente = docentesForm?.[index];
                  const selectedOption = currentDocente?.docente_id
                    ? docentesMap.get(currentDocente.docente_id)
                    : null;
                  const autoValue =
                    selectedOption ||
                    (controllerField.value
                      ? { id: -1, nombre: controllerField.value, dni: currentDocente?.dni }
                      : null);
                  return (
                    <Autocomplete
                      options={docentesOptions}
                      freeSolo
                      disabled={isReadOnly}
                      value={autoValue}
                      onChange={(_, value) => {
                        if (!value) {
                          controllerField.onChange('');
                          setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                          setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                          return;
                        }
                        if (typeof value === 'string') {
                          controllerField.onChange(value);
                          setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                          setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                        } else {
                          controllerField.onChange(value.nombre);
                          setValue(`docentes.${index}.docente_id`, value.id, { shouldDirty: true });
                          setValue(`docentes.${index}.dni`, value.dni || '', { shouldDirty: true });
                        }
                      }}
                      onInputChange={(_, value, reason) => {
                        if (reason === 'input') {
                          controllerField.onChange(value);
                          const currentSelected = currentDocente?.docente_id
                            ? docentesMap.get(currentDocente.docente_id)
                            : null;
                          if (!currentSelected || value !== currentSelected.nombre) {
                            setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                            setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                          }
                        }
                      }}
                      isOptionEqualToValue={(option, value) => {
                        if (typeof value === 'string') {
                          return option.nombre === value;
                        }
                        if (typeof option === 'string') {
                          return option === (value as any).nombre;
                        }
                        return option.id === (value as any).id;
                      }}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') {
                          return option;
                        }
                        return option.nombre;
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Nombre y apellido"
                          size="small"
                          required
                        />
                      )}
                    />
                  );
                }}
              />
            </Grid>
            <Grid item xs={12} md={2.5}>
              <Controller
                control={control}
                name={`docentes.${index}.docente_id`}
                render={() => <></>}
              />
              <Controller
                control={control}
                name={`docentes.${index}.dni`}
                render={({ field: controllerField }) => (
                  <TextField
                    {...controllerField}
                    value={controllerField.value ?? ''}
                    label="DNI"
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 20 }}
                    disabled={isReadOnly}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Controller
                control={control}
                name={`docentes.${index}.rol`}
                render={({ field: controllerField }) => (
                  <TextField
                    {...controllerField}
                    value={controllerField.value ?? 'profesor'}
                    select
                    label="Rol"
                    fullWidth
                    size="small"
                    disabled={isReadOnly}
                  >
                    <MenuItem value="profesor">Profesor/a</MenuItem>
                    <MenuItem value="bedel">Bedel</MenuItem>
                    <MenuItem value="otro">Otro</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Controller
                control={control}
                name={`docentes.${index}.orden`}
                render={({ field: controllerField }) => (
                  <TextField
                    {...controllerField}
                    value={controllerField.value ?? ''}
                    label="Orden"
                    type="number"
                    fullWidth
                    size="small"
                    inputProps={{ min: 1 }}
                    disabled={isReadOnly}
                  />
                )}
              />
            </Grid>
            <Grid
              item
              xs={12}
              md={1}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {!isReadOnly && (
                <Tooltip title="Quitar firmante">
                  <span>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleRemoveDocente(index)}
                      disabled={docenteFields.length === 1}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Grid>
          </React.Fragment>
        ))}
      </Grid>
    </>
  );
};
