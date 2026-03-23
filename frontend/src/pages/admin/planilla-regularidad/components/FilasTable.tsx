import React from 'react';
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Controller, Control, UseFormSetValue, UseFormWatch, UseFormGetValues } from 'react-hook-form';
import { FieldArrayWithId } from 'react-hook-form';

import { PlanillaFormValues } from '../types';
import { formatColumnLabel, getSituacionColor, SITUACION_DESCRIPTIONS, SITUACION_PLACEHOLDER } from '../constants';

interface FilasTableProps {
  control: Control<PlanillaFormValues>;
  setValue: UseFormSetValue<PlanillaFormValues>;
  watch: UseFormWatch<PlanillaFormValues>;
  getValues: UseFormGetValues<PlanillaFormValues>;
  isReadOnly: boolean;
  filaFields: FieldArrayWithId<PlanillaFormValues, 'filas', 'id'>[];
  removeFila: (index: number) => void;
  columnasDinamicas: any[];
  situacionesDisponibles: any[];
  estudiantesMetadata: any[];
  selectedMateria?: any;
  handleStudentDniBlur: (index: number, rawValue: string) => void;
  handleAsistenciaBlur: (index: number, e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  calculateSituacionForRow: (index: number) => void;
  handleInsertRow: (index: number) => void;
}

const headerCellSx = {
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase' as const,
  backgroundColor: 'grey.100',
  border: '1px solid',
  borderColor: 'grey.300',
  whiteSpace: 'nowrap' as const,
};

const bodyCellSx = {
  border: '1px solid',
  borderColor: 'grey.200',
  px: 1.5,
  py: 1,
  verticalAlign: 'middle' as const,
};

export const FilasTable: React.FC<FilasTableProps> = ({
  control,
  setValue,
  watch,
  getValues,
  isReadOnly,
  filaFields,
  removeFila,
  columnasDinamicas,
  situacionesDisponibles,
  estudiantesMetadata,
  selectedMateria,
  handleStudentDniBlur,
  handleAsistenciaBlur,
  calculateSituacionForRow,
  handleInsertRow,
}) => {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headerCellSx, width: 60 }} rowSpan={2}>
              N°
            </TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 240 }} rowSpan={2}>
              Estudiantes
            </TableCell>
            <TableCell sx={{ ...headerCellSx, width: 140 }} rowSpan={2}>
              DNI
            </TableCell>

            {/* Render Groups for Dynamic Columns */}
            {(() => {
              const groups: { name: string; span: number }[] = [];
              let currentGroup = '';
              let currentSpan = 0;

              // Agrupar columnas
              columnasDinamicas.forEach((col: any) => {
                // Usar un espacio si no hay grupo para evitar problemas
                const gName = col.group || '';
                if (gName !== currentGroup) {
                  if (currentSpan > 0) groups.push({ name: currentGroup, span: currentSpan });
                  currentGroup = gName;
                  currentSpan = 1;
                } else {
                  currentSpan++;
                }
              });
              if (currentSpan > 0) groups.push({ name: currentGroup, span: currentSpan });

              // Si no hay grupos definidos (legacy), fallback a un solo header
              if (groups.length === 0 && columnasDinamicas.length > 0) {
                return (
                  <TableCell
                    sx={{ ...headerCellSx, textAlign: 'center' }}
                    colSpan={columnasDinamicas.length}
                  >
                    Nota de trabajos prácticos
                  </TableCell>
                );
              }

              // Renderizar headers de grupo
              return groups.map((g, idx) => (
                <TableCell
                  key={`group-${idx}`}
                  sx={{ ...headerCellSx, textAlign: 'center' }}
                  colSpan={g.span}
                >
                  {g.name}
                </TableCell>
              ));
            })()}

            <TableCell sx={{ ...headerCellSx, width: 80, textAlign: 'center' }} rowSpan={2}>
              Final
            </TableCell>
            <TableCell sx={{ ...headerCellSx, width: 80, textAlign: 'center' }} rowSpan={2}>
              Asistencia
            </TableCell>
            <TableCell sx={{ ...headerCellSx, width: 70, textAlign: 'center' }} rowSpan={2}>
              Excep.
            </TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 200 }} rowSpan={2}>
              Situación académica
            </TableCell>
            <TableCell sx={{ ...headerCellSx, width: 56 }} rowSpan={2} />
          </TableRow>
          <TableRow>
            {columnasDinamicas.map((col) => (
              <TableCell sx={{ ...headerCellSx, width: 80, minWidth: 80 }} key={col.key}>
                <Typography variant="body2" sx={{ fontSize: '0.70rem' }}>
                  {formatColumnLabel(col.label)}
                </Typography>
                {col.optional ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    (opt)
                  </Typography>
                ) : null}
              </TableCell>
            ))}
            {/* Las columnas estáticas (Final, Asistencia...) ya tienen rowSpan=2 arriba,
                así que no agregamos celdas aquí */}
          </TableRow>
        </TableHead>
        <TableBody>
          {filaFields.map((field, index) => (
            <TableRow key={field.id}>
              <TableCell sx={{ ...bodyCellSx, width: 60, textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600}>
                  {index + 1}
                </Typography>
                <Controller
                  control={control}
                  name={`filas.${index}.orden`}
                  render={({ field: controllerField }) => (
                    <input type="hidden" {...controllerField} value={index + 1} />
                  )}
                />
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, minWidth: 320 }}>
                <Controller
                  control={control}
                  name={`filas.${index}.apellido_nombre`}
                  render={({ field: controllerField }) => (
                    <Autocomplete
                      freeSolo
                      disabled={isReadOnly}
                      options={estudiantesMetadata}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        return `${option.apellido_nombre} (${option.dni})`;
                      }}
                      value={
                        estudiantesMetadata.find(
                          (e) => e.apellido_nombre === controllerField.value && e.dni === watch(`filas.${index}.dni`)
                        ) || controllerField.value
                      }
                      onChange={(_, value) => {
                        if (typeof value === 'string') {
                          // Intentar extraer DNI si viene formateado como "Nombre (DNI)"
                          const match = value.match(/(.*) \((\d+)\)$/);
                          if (match) {
                            controllerField.onChange(match[1].trim());
                            setValue(`filas.${index}.dni`, match[2], { shouldDirty: true });
                          } else {
                            controllerField.onChange(value);
                          }
                        } else if (value) {
                          controllerField.onChange(value.apellido_nombre);
                          setValue(`filas.${index}.dni`, value.dni, { shouldDirty: true });
                        } else {
                          controllerField.onChange('');
                        }
                      }}
                      onInputChange={(_, value) => {
                        // Eliminar el (DNI) de la visualización al escribir si es necesario
                        const match = value.match(/(.*) \((\d+)\)$/);
                        controllerField.onChange(match ? match[1].trim() : value);
                      }}
                      renderOption={(props, option) => {
                        const { key, ...restProps } = props as any;
                        return (
                          <li key={key} {...restProps}>
                            <Box>
                              <Typography variant="body2">{option.apellido_nombre}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                DNI: {option.dni}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params: any) => (
                        <TextField
                          {...params}
                          size="small"
                          fullWidth
                          placeholder="Apellido y nombre"
                          required
                          autoComplete="off"
                        />
                      )}
                      noOptionsText="No se encontraron estudiantes"
                    />
                  )}
                />
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, width: 100 }}>
                <Controller
                  control={control}
                  name={`filas.${index}.dni`}
                  render={({ field: controllerField }) => (
                    <TextField
                      {...controllerField}
                      value={controllerField.value ?? ''}
                      size="small"
                      fullWidth
                      placeholder="DNI"
                      inputProps={{
                        maxLength: 20,
                        sx: { fontSize: '0.85rem', px: 0.5 },
                        autoComplete: 'off'
                      }}
                      onBlur={(event) => {
                        controllerField.onBlur();
                        handleStudentDniBlur(index, event.target.value);
                      }}
                      onChange={(event) => {
                        let val = event.target.value;
                        if (!val.startsWith('HIS-')) {
                          val = val.replace(/\D/g, '');
                        }
                        controllerField.onChange(val);
                        if (val.length >= 7) {
                          handleStudentDniBlur(index, val);
                        }
                      }}
                      required
                      disabled={isReadOnly}
                    />
                  )}
                />
              </TableCell>
              {columnasDinamicas.map((col) => (
                <TableCell sx={{ ...bodyCellSx, width: 80, minWidth: 80 }} key={`${field.id}-${col.key}`}>
                  <Controller
                    control={control}
                    name={`filas.${index}.datos.${col.key}`}
                    render={({ field: controllerField }) => {
                      const isRecuperatorio = col.key.endsWith('r');
                      let disabled = isReadOnly;
                      let softDisabled = false;

                      if (!isReadOnly && isRecuperatorio) {
                        const pKey = col.key.slice(0, -1) + 'p';
                        const pVal = getValues(`filas.${index}.datos.${pKey}`);
                        if (pVal && String(pVal).trim() !== '' && String(pVal) !== '---' && Number(String(pVal).replace(',', '.')) >= 6) {
                          softDisabled = true;
                        }
                      }

                      const isBlocked = disabled || softDisabled;

                      return (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? ''}
                          size="small"
                          fullWidth
                          inputProps={{
                            sx: {
                              textAlign: 'center',
                              px: 0.5,
                              ...(softDisabled ? { backgroundColor: '#f5f5f5', color: '#a0a0a0', cursor: 'not-allowed' } : {})
                            },
                            maxLength: 3,
                            readOnly: softDisabled,
                            tabIndex: softDisabled ? -1 : undefined,
                            autoComplete: 'off'
                          }}
                          onBlur={() => calculateSituacionForRow(index)}
                          onChange={(e) => {
                            if (softDisabled) return; // double safety
                            const val = e.target.value;
                            if (val === '-' || val === '--' || val === '---') {
                              controllerField.onChange(val);
                              return;
                            }
                            const num = val.replace(/\D/g, '');
                            if (num === '') {
                              controllerField.onChange('');
                              return;
                            }
                            const n = parseInt(num, 10);
                            if (n >= 0 && n <= 10) {
                              controllerField.onChange(num);
                            }
                          }}
                          required={!col.optional}
                          disabled={disabled} // Hard disabled only for global readonly
                        />
                      );
                    }}
                  />
                </TableCell>
              ))}
              <TableCell sx={{ ...bodyCellSx, width: 80 }}>
                <Controller
                  control={control}
                  name={`filas.${index}.nota_final`}
                  render={({ field: controllerField }) => (
                    <TextField
                      {...controllerField}
                      value={controllerField.value || (isReadOnly ? '-' : '')}
                      size="small"
                      fullWidth
                      inputProps={{
                        sx: { textAlign: 'center', px: 0.5 },
                        maxLength: 3,
                        autoComplete: 'off'
                      }}
                      onBlur={() => calculateSituacionForRow(index)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '-' || val === '--' || val === '---') {
                          controllerField.onChange(val);
                          return;
                        }
                        const num = val.replace(/\D/g, '');
                        if (num === '') {
                          controllerField.onChange('');
                          return;
                        }
                        const n = parseInt(num, 10);
                        if (n >= 0 && n <= 10) {
                          controllerField.onChange(num);
                        }
                      }}
                      required
                      disabled={isReadOnly}
                    />
                  )}
                />
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, width: 80 }}>
                <Controller
                  control={control}
                  name={`filas.${index}.asistencia`}
                  render={({ field: controllerField }) => (
                    <TextField
                      {...controllerField}
                      value={controllerField.value || (isReadOnly ? '-' : '')}
                      size="small"
                      fullWidth
                      inputProps={{
                        sx: { textAlign: 'center', px: 0.5 },
                        maxLength: 3,
                        autoComplete: 'off'
                      }}
                      onBlur={(e) => handleAsistenciaBlur(index, e)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '-' || val === '--' || val === '---') {
                          controllerField.onChange(val);
                          return;
                        }
                        const num = val.replace(/\D/g, '');
                        if (num === '') {
                          controllerField.onChange('');
                          return;
                        }
                        const n = parseInt(num, 10);
                        if (n >= 0 && n <= 100) {
                          controllerField.onChange(num);
                        }
                      }}
                      required
                      disabled={isReadOnly}
                    />
                  )}
                />
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, width: 70, textAlign: 'center' }}>
                <Controller
                  control={control}
                  name={`filas.${index}.excepcion`}
                  render={({ field: controllerField }) => {
                    const { value, onChange, ...rest } = controllerField;
                    // Determinar si se permite excepción según formato
                    const formato = selectedMateria?.formato?.toUpperCase();
                    const isGroupHigh = ['LAB', 'TAL', 'PRA'].includes(formato || '');
                    // Deshabilitar si es View o si el formato no admite excepción
                    // Para MOD deshabilitamos porque la asistencia base ya es 65% y no admite excepción.
                    const isDisabled = isReadOnly || (selectedMateria && !isGroupHigh);

                    return (
                      <Checkbox
                        {...rest}
                        checked={Boolean(value)}
                        onChange={(event) => {
                          onChange(event.target.checked);
                          // Recalcular al cambiar el check
                          setTimeout(() => calculateSituacionForRow(index), 10);
                        }}
                        size="small"
                        sx={{ p: 0 }}
                        disabled={isDisabled}
                      />
                    );
                  }}
                />
              </TableCell>
              <TableCell sx={{
                ...bodyCellSx,
                minWidth: 200,
                backgroundColor: getSituacionColor(watch(`filas.${index}.situacion`))
              }}>
                {isReadOnly ? (
                  <TextField
                    size="small"
                    fullWidth
                    value={(() => {
                      const val = watch(`filas.${index}.situacion`);

                      // Paridad con PDF: AUJ -> JUS
                      if (val === 'AUJ') return 'JUS';

                      // 1. Intentar buscar label en situacionesDisponibles (metadata dinámica)
                      const match = situacionesDisponibles.find(
                        (s) => s.codigo.toString().toLowerCase() === (val || '').toString().toLowerCase()
                      );
                      if (match && match.label) return match.label;

                      // 2. Fallback a mapa estático (simula comportamiento del PDF backend)
                      const staticDesc = SITUACION_DESCRIPTIONS[(val || '').toUpperCase()];
                      if (staticDesc) return staticDesc;

                      return val;
                    })()}
                    InputProps={{
                      readOnly: true,
                    }}
                    disabled
                  // disabled adds opacity, readOnly doesn't.
                  // If we want it to look clearly readable, maybe just readOnly is better,
                  // but consistent with other disabled fields is OK.
                  // Let's use disabled to match the rest of the form style.
                  />
                ) : (
                  <Controller
                    control={control}
                    name={`filas.${index}.situacion`}
                    render={({ field: controllerField }) => (
                      <Autocomplete
                        options={situacionesDisponibles}
                        fullWidth
                        size="small"
                        disabled={isReadOnly || !situacionesDisponibles.length}
                        value={
                          situacionesDisponibles.find(
                            (s) => s.codigo.toString().toLowerCase() === (controllerField.value || '').toString().toLowerCase()
                          ) || null
                        }
                        onChange={(_, value) => controllerField.onChange(value?.codigo || '')}
                        getOptionLabel={(option) => option?.label || option?.codigo || ''}
                        renderOption={(props, option) => {
                          const { key, ...restProps } = props as any;
                          return (
                            <li key={key} {...restProps}>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="body2">{option.label || option.codigo}</Typography>
                                {option.descripcion ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {option.descripcion}
                                  </Typography>
                                ) : null}
                              </Box>
                            </li>
                          );
                        }}
                        isOptionEqualToValue={(option, value) => option?.codigo === value?.codigo}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Situación"
                            placeholder={SITUACION_PLACEHOLDER}
                            InputLabelProps={{ shrink: true }}
                            required
                          />
                        )}
                        noOptionsText="Sin opciones"
                      />
                    )}
                  />
                )}
              </TableCell>
              <TableCell sx={{ ...bodyCellSx, width: 56, textAlign: 'center' }}>
                {!isReadOnly && (
                  <>
                    <Tooltip title="Eliminar fila">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeFila(index)}
                          disabled={filaFields.length <= 1}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Insertar fila debajo">
                      <IconButton size="small" color="primary" onClick={() => handleInsertRow(index)}>
                        <AddCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
