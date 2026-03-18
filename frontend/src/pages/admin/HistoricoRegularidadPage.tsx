import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
    Box,
    Button,
    Typography,
    Paper,
    Grid,
    TextField,
    MenuItem,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Checkbox,
    FormControlLabel,
    Autocomplete,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    fetchRegularidadMetadata,
    registrarRegularidadIndividual,
    RegularidadIndividualPayload,
} from "@/api/primeraCarga";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";

const SITUACIONES = [
    { value: "PRO", label: "Promocionado (PRO)" },
    { value: "REG", label: "Regular (REG)" },
    { value: "APR", label: "Aprobado sin final (APR)" },
    { value: "DPA", label: "Desaprobado por Parciales (DPA)" },
    { value: "DTP", label: "Desaprobado por Trabajos Prácticos (DTP)" },
    { value: "LBI", label: "Libre por Inasistencias (LBI)" },
    { value: "LAT", label: "Libre Antes de Tiempo (LAT)" },
];

const DICTADOS = [
    { value: "ANUAL", label: "Anual" },
    { value: "1C", label: "1° Cuatrimestre" },
    { value: "2C", label: "2° Cuatrimestre" },
];

const HistoricoRegularidadPage: React.FC = () => {
    const navigate = useNavigate();
    const [overwriteConfirm, setOverwriteConfirm] = useState<{
        open: boolean;
        message: string;
    } | null>(null);

    const { data: metadata, isLoading } = useQuery({
        queryKey: ["regularidad-metadata"],
        queryFn: () => fetchRegularidadMetadata(false), // false triggers standard role-based filtering
    });

    const { control, handleSubmit, watch, reset, setValue } = useForm<RegularidadIndividualPayload>({
        defaultValues: {
            dni: "",
            profesorado_id: 0,
            plan_id: 0,
            materia_id: 0,
            dictado: "ANUAL",
            fecha: new Date().toISOString().substring(0, 10),
            situacion: "REG",
            excepcion: false,
            nota_final: null,
            asistencia: null,
            observaciones: "",
            folio: "",
            force_upgrade: false,
        },
    });

    const selectedProfesoradoId = watch("profesorado_id");
    const selectedMateriaId = watch("materia_id");

    // Auto-select Profesorado if only one is available
    React.useEffect(() => {
        if (metadata?.profesorados && metadata.profesorados.length === 1) {
            setValue("profesorado_id", metadata.profesorados[0].id);
        }
    }, [metadata, setValue]);

    const selectedProfesorado = metadata?.profesorados.find((p) => p.id === selectedProfesoradoId);
    const planes = selectedProfesorado?.planes || [];

    const selectedPlanId = watch("plan_id");

    // Auto-select Plan if only one is available for the professorado
    React.useEffect(() => {
        if (planes.length === 1) {
            setValue("plan_id", planes[0].id);
        }
    }, [planes, setValue]);

    const selectedPlan = planes.find((p) => p.id === selectedPlanId);
    const materias = selectedPlan?.materias || [];

    // Auto-select Materia details (dictado)
    React.useEffect(() => {
        if (selectedMateriaId) {
            const mat = materias.find((m) => m.id === selectedMateriaId);
            if (mat) {
                if (mat.dictado) setValue("dictado", mat.dictado);
                // Default to Regular if not specified, but usually it's already set
            }
        }
    }, [selectedMateriaId, materias, setValue]);

    const mutation = useMutation({
        mutationFn: registrarRegularidadIndividual,
        onSuccess: () => {
            enqueueSnackbar("Regularidad registrada correctamente.", { variant: "success" });
            reset({
                ...control._defaultValues,
                profesorado_id: selectedProfesoradoId, // Keep professorate for next entry
                plan_id: watch("plan_id"), // Keep plan
                fecha: watch("fecha"), // Keep date
            });
            setOverwriteConfirm(null);
        },
        onError: (error: any) => {
            const msg = error.response?.data?.message || "Error al guardar.";
            if (msg.startsWith("PREVENTION:OVERWRITE|")) {
                setOverwriteConfirm({
                    open: true,
                    message: msg.split("|")[1],
                });
            } else {
                enqueueSnackbar(msg, { variant: "error" });
            }
        },
    });

    const onSubmit = (data: RegularidadIndividualPayload) => {
        mutation.mutate({ ...data, force_upgrade: false });
    };

    const handleConfirmOverwrite = () => {
        if (overwriteConfirm) {
            const data = watch();
            mutation.mutate({ ...data, force_upgrade: true });
        }
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={3}>
            <Typography variant="h5" mb={2} fontWeight="bold">
                Carga Histórica Individual de Regularidad
            </Typography>
            <Typography variant="subtitle1" color="textSecondary" mb={4}>
                Registre rápidamente notas o regularidades retrospectivas para un estudiante específico.
            </Typography>

            <Paper sx={{ p: 4 }}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Grid container spacing={3}>
                        {/* Row 1: DNI y Fecha */}
                        <Grid item xs={12} md={6}>
                            <Controller
                                name="dni"
                                control={control}
                                rules={{ required: "Requerido" }}
                                render={({ field: controllerField, fieldState }) => (
                                    <Autocomplete
                                        freeSolo
                                        options={metadata?.estudiantes || []}
                                        getOptionLabel={(option) => {
                                            if (typeof option === 'string') return option;
                                            return `${option.apellido_nombre} (${option.dni})`;
                                        }}
                                        filterOptions={(options, state) => {
                                            const input = state.inputValue.toLowerCase();
                                            return options.filter(o =>
                                                o.dni.includes(input) ||
                                                o.apellido_nombre.toLowerCase().includes(input)
                                            ).slice(0, 50); // Limit to 50 for performance
                                        }}
                                        value={
                                            metadata?.estudiantes.find((e) => e.dni === controllerField.value) ||
                                            controllerField.value ||
                                            null
                                        }
                                        onInputChange={(_, val, reason) => {
                                            if (reason === 'input') {
                                                // Solo actualizamos el valor si es puramente numérico (DNI directo)
                                                // o si es la entrada inicial del usuario.
                                                // Si el usuario borra todo, limpiamos.
                                                if (val === '') {
                                                    controllerField.onChange('');
                                                } else if (/^\d+$/.test(val)) {
                                                    controllerField.onChange(val);
                                                }
                                            }
                                        }}
                                        onChange={(_, val) => {
                                            if (typeof val === 'string') {
                                                // Si el input contiene paréntesis, intentamos extraer el DNI
                                                const match = val.match(/\((\d+)\)$/);
                                                controllerField.onChange(match ? match[1] : val);
                                            } else if (val) {
                                                controllerField.onChange(val.dni);
                                            } else {
                                                controllerField.onChange('');
                                            }
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
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="DNI o Nombre del Estudiante"
                                                fullWidth
                                                required
                                                placeholder="Busque por DNI o Apellido..."
                                                error={!!fieldState.error}
                                                helperText={fieldState.error?.message}
                                            />
                                        )}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Controller
                                name="fecha"
                                control={control}
                                rules={{ required: "Requerido" }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        label="Fecha de la Planilla Original"
                                        type="date"
                                        fullWidth
                                        required
                                        InputLabelProps={{ shrink: true }}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    />
                                )}
                            />
                        </Grid>

                        {/* Row 2: Profesorado y Materia */}
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="profesorado_id"
                                control={control}
                                rules={{ required: "Requerido", min: 1 }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Profesorado"
                                        fullWidth
                                        required
                                        error={!!fieldState.error}
                                        helperText={fieldState.error ? "Seleccione el profesorado" : ""}
                                        onChange={(e) => {
                                            field.onChange(Number(e.target.value));
                                            setValue("plan_id", 0);
                                            setValue("materia_id", 0);
                                        }}
                                    >
                                        <MenuItem value={0} disabled>
                                            -- Seleccione --
                                        </MenuItem>
                                        {metadata?.profesorados.map((p) => (
                                            <MenuItem key={p.id} value={p.id}>
                                                {p.nombre}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="plan_id"
                                control={control}
                                rules={{ required: "Requerido", min: 1 }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Plan de Estudio"
                                        fullWidth
                                        required
                                        disabled={!selectedProfesoradoId}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error ? "Seleccione el plan" : ""}
                                        onChange={(e) => {
                                            field.onChange(Number(e.target.value));
                                            setValue("materia_id", 0);
                                        }}
                                    >
                                        <MenuItem value={0} disabled>
                                            -- Seleccione --
                                        </MenuItem>
                                        {planes.map((p) => (
                                            <MenuItem key={p.id} value={p.id}>
                                                {p.resolucion} {p.vigente ? "(Vigente)" : ""}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="materia_id"
                                control={control}
                                rules={{ required: "Requerido", min: 1 }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Unidad Curricular"
                                        fullWidth
                                        required
                                        disabled={!selectedPlanId}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error ? "Seleccione la unidad curricular" : ""}
                                    >
                                        <MenuItem value={0} disabled>
                                            -- Seleccione --
                                        </MenuItem>
                                        {materias.map((m) => (
                                            <MenuItem key={m.id} value={m.id}>
                                                {m.nombre} (Año {m.anio_cursada})
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {/* Row 3: Dictado, Situacion */}
                        <Grid item xs={12} md={6}>
                            <Controller
                                name="dictado"
                                control={control}
                                rules={{ required: "Requerido" }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Dictado"
                                        fullWidth
                                        required
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    >
                                        {DICTADOS.map((o) => (
                                            <MenuItem key={o.value} value={o.value}>
                                                {o.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Controller
                                name="situacion"
                                control={control}
                                rules={{ required: "Requerido" }}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        select
                                        label="Situación Académica"
                                        fullWidth
                                        required
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    >
                                        {SITUACIONES.map((o) => (
                                            <MenuItem key={o.value} value={o.value}>
                                                {o.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {/* Row 4: Nota, Asistencia, Folio */}
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="nota_final"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        type="number"
                                        label="Nota de Cursada"
                                        fullWidth
                                        inputProps={{ step: "0.1", min: "1", max: "10" }}
                                        value={field.value ?? ""}
                                        onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="asistencia"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        type="number"
                                        label="Porcentaje de Asistencia (%)"
                                        fullWidth
                                        inputProps={{ step: "1", min: "0", max: "100" }}
                                        value={field.value ?? ""}
                                        onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Controller
                                name="folio"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        label="Folio N° (opcional)"
                                        fullWidth
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    />
                                )}
                            />
                        </Grid>

                        {/* Row 5: Observaciones */}
                        <Grid item xs={12} md={12}>
                            <Controller
                                name="observaciones"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <TextField
                                        {...field}
                                        label="Observaciones"
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        error={!!fieldState.error}
                                        helperText={fieldState.error?.message}
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>

                    <Box display="flex" justifyContent="flex-end" mt={3} gap={2}>
                        <Button
                            variant="outlined"
                            onClick={() => navigate("/admin/primera-carga")}
                            disabled={mutation.isPending}
                        >
                            Volver
                        </Button>
                        <Button type="submit" variant="contained" disabled={mutation.isPending}>
                            {mutation.isPending ? "Guardando..." : "Guardar Regularidad"}
                        </Button>
                    </Box>
                </form>
            </Paper>

            {/* Confirmation Dialog para Sobrescrituras */}
            <Dialog open={!!overwriteConfirm} onClose={() => setOverwriteConfirm(null)}>
                <DialogTitle>Condición existente detectada</DialogTitle>
                <DialogContent>
                    <DialogContentText>{overwriteConfirm?.message}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOverwriteConfirm(null)} disabled={mutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmOverwrite}
                        color="error"
                        variant="contained"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Aplicando..." : "Forzar Actualización"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default HistoricoRegularidadPage;
