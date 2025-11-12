import { useState } from "react";
import {
  Stack,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Switch,
  FormControlLabel,
  Box,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { client as api } from "@/api/client";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "@/utils/toast";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";

interface Profesorado {
  id: number;
  nombre: string;
}

interface PlanDeEstudio {
  id: number;
  profesorado_id: number;
  resolucion: string;
  anio_inicio: number;
  anio_fin: number | null;
  vigente: boolean;
}

interface PlanForm {
  profesorado_id: number;
  resolucion: string;
  anio_inicio: string | number;
  anio_fin?: string | number | null;
  vigente: boolean;
}

export default function CargarPlanPage() {
  const { profesoradoId } = useParams<{ profesoradoId: string }>();
  const currentProfesoradoId = profesoradoId ? parseInt(profesoradoId) : null;
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<PlanDeEstudio | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PlanForm>({
    defaultValues: {
      profesorado_id: currentProfesoradoId || 0,
      resolucion: "",
      anio_inicio: new Date().getFullYear(),
      anio_fin: null, // Changed from null to empty string
      vigente: true,
    },
  });

  const { data: profesorados, isLoading: isLoadingProfesorados } = useQuery<Profesorado[]>({
    queryKey: ["profesorados-list"],
    queryFn: async () => {
      const response = await api.get("/profesorados");
      return response.data;
    },
  });

  const { data: planes, isLoading: isLoadingPlanes } = useQuery<PlanDeEstudio[]>({
    queryKey: ["planes", currentProfesoradoId],
    queryFn: async () => {
      if (!currentProfesoradoId) return [];
      const response = await api.get(
        `/profesorados/${currentProfesoradoId}/planes`
      );
      return response.data;
    },
    enabled: !!currentProfesoradoId, // Only run if profesoradoId is available
  });

  const createPlanMutation = useMutation<
    PlanDeEstudio,
    Error,
    PlanForm
  >({
    mutationFn: async (newPlan) => {
      const response = await api.post(
        `/profesorados/${newPlan.profesorado_id}/planes`,
        newPlan
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planes", currentProfesoradoId] });
      reset();
    },
    onError: (error: any) => {
      console.error("Plan POST error:", error.response?.data);
      toast.error("Error al guardar el plan");
    },
  });

  const updatePlanMutation = useMutation<
    PlanDeEstudio,
    Error,
    PlanDeEstudio
  >({
    mutationFn: async (updatedPlan) => {
      const response = await api.put(
        `/planes/${updatedPlan.id}`,
        updatedPlan
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planes", currentProfesoradoId] });
      setEditingPlan(null);
      reset();
    },
    onError: (error: any) => {
      console.error("Plan PUT error:", error.response?.data);
      toast.error("Error al actualizar el plan");
    },
  });

  const deletePlanMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (planId) => {
      await api.delete(`/planes/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planes", currentProfesoradoId] });
    },
  });

  const onSubmit = (data: PlanForm) => {
    const payload = {
      profesorado_id: data.profesorado_id,
      resolucion: data.resolucion.trim(),
      anio_inicio: Number(data.anio_inicio),
      anio_fin: data.anio_fin ? Number(data.anio_fin) : null,
      vigente: !!data.vigente,
    };

    if (editingPlan) {
      updatePlanMutation.mutate({ ...editingPlan, ...payload });
    } else {
      createPlanMutation.mutate(payload);
    }
  };

  const handleEditClick = (plan: PlanDeEstudio) => {
    setEditingPlan(plan);
    setValue("profesorado_id", plan.profesorado_id);
    setValue("resolucion", plan.resolucion);
    setValue("anio_inicio", plan.anio_inicio);
    setValue("anio_fin", plan.anio_fin === null ? "" : plan.anio_fin);
    setValue("vigente", plan.vigente);
  };

  const handleDeleteClick = (planId: number) => {
    if (window.confirm("¿Estás seguro de que quieres desactivar este plan de estudio?")) {
      deletePlanMutation.mutate(planId);
    }
  };

  const getProfesoradoName = (id: number) => {
    return profesorados?.find((p) => p.id === id)?.nombre || "Desconocido";
  };

  const heroTitle = currentProfesoradoId
    ? `Cargar plan de estudio - ${getProfesoradoName(currentProfesoradoId)}`
    : "Cargar plan de estudio";

  return (
    <Stack gap={3}>
      <PageHero
        title={heroTitle}
        subtitle="Gestioná resoluciones, vigencias y estados de cada plan."
      />

      <Paper sx={{ p: 2 }}>
        <SectionTitlePill title={editingPlan ? "Editar plan" : "Crear nuevo plan"} />
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {!currentProfesoradoId && (
            <FormControl fullWidth size="small" error={!!errors.profesorado_id}>
              <InputLabel id="profesorado-select-label">Profesorado</InputLabel>
              <Controller
                name="profesorado_id"
                control={control}
                rules={{ required: "El profesorado es obligatorio" }}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId="profesorado-select-label"
                    label="Profesorado"
                    defaultValue={currentProfesoradoId || ""}
                  >
                    {profesorados?.map((profesorado) => (
                      <MenuItem key={profesorado.id} value={profesorado.id}>
                        {profesorado.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.profesorado_id && (
                <Typography color="error" variant="caption">
                  {errors.profesorado_id.message}
                </Typography>
              )}
            </FormControl>
          )}

          <Controller
            name="resolucion"
            control={control}
            rules={{ required: "La resolución es obligatoria" }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Resolución (ej. 1935/14)"
                error={!!errors.resolucion}
                helperText={errors.resolucion?.message}
              />
            )}
          />
          <Controller
            name="anio_inicio"
            control={control}
            rules={{
              required: "El año de inicio es obligatorio",
              min: { value: 1900, message: "Año inválido" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Año de Inicio"
                type="number"
                error={!!errors.anio_inicio}
                helperText={errors.anio_inicio?.message}
              />
            )}
          />
          <Controller
            name="anio_fin"
            control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ""}
              size="small"
              label="Año de Fin (opcional)"
              type="number"
              error={!!errors.anio_fin}
              helperText={errors.anio_fin?.message}
              />
            )}
          />
          <FormControlLabel
            control={
              <Controller
                name="vigente"
                control={control}
                render={({ field }) => (
                  <Switch {...field} checked={field.value} />
                )}
              />
            }
            label="Vigente"
          />
          <Button type="submit" variant="contained">
            {editingPlan ? "Actualizar Plan" : "Guardar Plan"}
          </Button>
          {editingPlan && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setEditingPlan(null);
                reset();
              }}
            >
              Cancelar Edición
            </Button>
          )}
        </Box>
      </Paper>

      {currentProfesoradoId && (
        <Paper sx={{ p: 2 }}>
          <SectionTitlePill title="Planes de estudio" />
          {isLoadingPlanes ? (
            <Typography>Cargando planes...</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Resolución</TableCell>
                    <TableCell>Año Inicio</TableCell>
                    <TableCell>Año Fin</TableCell>
                    <TableCell>Vigente</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planes?.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>{plan.id}</TableCell>
                      <TableCell>{plan.resolucion}</TableCell>
                      <TableCell>{plan.anio_inicio}</TableCell>
                      <TableCell>{plan.anio_fin || "-"}</TableCell>
                      <TableCell>{plan.vigente ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(plan)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(plan.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => navigate(`/secretaria/plan/${plan.id}/materias`)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Stack>
  );
}
