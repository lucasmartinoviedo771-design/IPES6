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
  Chip,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";
import { client as api } from "@/api/client";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import BackButton from "@/components/ui/BackButton";

interface Profesorado {
  id: number;
  nombre: string;
  duracion_anios: number;
  activo: boolean;
  inscripcion_abierta: boolean;
  es_certificacion_docente: boolean;
}

interface ProfesoradoFormInput {
  nombre: string;
  duracion_anios: number;
  activo: boolean;
  inscripcion_abierta: boolean;
  es_certificacion_docente: boolean;
}

export default function CargarProfesoradoPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingProfesorado, setEditingProfesorado] =
    useState<Profesorado | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<{
    mode: "create" | "update";
    payload: ProfesoradoFormInput;
    target?: Profesorado | null;
  } | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProfesoradoFormInput>({
    defaultValues: {
      nombre: "",
      duracion_anios: 0,
      activo: true,
      inscripcion_abierta: true,
      es_certificacion_docente: false,
    },
  });

  const { data: profesorados, isLoading } = useQuery<Profesorado[]>({
    queryKey: ["profesorados"],
    queryFn: async () => {
      const response = await api.get("/profesorados/");
      return response.data;
    },
  });

  const createProfesoradoMutation = useMutation<
    Profesorado,
    Error,
    ProfesoradoFormInput
  >({
    mutationFn: async (newProfesorado) => {
      const response = await api.post("/profesorados/", newProfesorado);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesorados"] });
      reset();
      setPendingSubmit(null);
    },
  });

  const updateProfesoradoMutation = useMutation<
    Profesorado,
    Error,
    Profesorado
  >({
    mutationFn: async (updatedProfesorado) => {
      const response = await api.put(
        `/profesorados/${updatedProfesorado.id}`,
        updatedProfesorado
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesorados"] });
      setEditingProfesorado(null);
      reset();
      setPendingSubmit(null);
    },
  });

  const deleteProfesoradoMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (profesoradoId) => {
      await api.delete(`/profesorados/${profesoradoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesorados"] });
    },
  });

  const onSubmit = (data: ProfesoradoFormInput) => {
    if (editingProfesorado) {
      setPendingSubmit({
        mode: "update",
        payload: data,
        target: editingProfesorado,
      });
    } else {
      setPendingSubmit({
        mode: "create",
        payload: data,
      });
    }
  };

  const handleEditClick = (profesorado: Profesorado) => {
    setEditingProfesorado(profesorado);
    setValue("nombre", profesorado.nombre);
    setValue("duracion_anios", profesorado.duracion_anios);
    setValue("activo", profesorado.activo);
    setValue("inscripcion_abierta", profesorado.inscripcion_abierta);
    setValue("es_certificacion_docente", profesorado.es_certificacion_docente);
  };

  const handleDeleteClick = (profesoradoId: number) => {
    if (window.confirm("¿Estás seguro de que quieres desactivar este profesorado?")) {
      deleteProfesoradoMutation.mutate(profesoradoId);
    }
  };

  const isSaving = pendingSubmit
    ? pendingSubmit.mode === "update"
      ? updateProfesoradoMutation.isPending
      : createProfesoradoMutation.isPending
    : false;

  const confirmContext = pendingSubmit
    ? pendingSubmit.mode === "update"
      ? `actualización del profesorado "${pendingSubmit.target?.nombre ?? pendingSubmit.payload.nombre}"`
      : `alta del nuevo profesorado "${pendingSubmit.payload.nombre}"`
    : "alta del profesorado";

  const handleConfirmSubmit = () => {
    if (!pendingSubmit) return;
    if (pendingSubmit.mode === "update" && pendingSubmit.target) {
      updateProfesoradoMutation.mutate({ ...pendingSubmit.target, ...pendingSubmit.payload });
    } else if (pendingSubmit.mode === "create") {
      createProfesoradoMutation.mutate(pendingSubmit.payload);
    }
  };

  const handleCancelConfirm = () => {
    if (isSaving) return;
    setPendingSubmit(null);
  };

  return (
    <>
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Cargar profesorado"
        subtitle="Crear y administrar profesorados y cohortes"
      />

      <Paper sx={{ p: 2 }}>
        <SectionTitlePill title={editingProfesorado ? "Editar profesorado" : "Crear nuevo profesorado"} />
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Controller
            name="nombre"
            control={control}
            rules={{ required: "El nombre es obligatorio" }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Nombre del profesorado"
                error={!!errors.nombre}
                helperText={errors.nombre?.message}
              />
            )}
          />
          <Controller
            name="duracion_anios"
            control={control}
            rules={{
              required: "La duración en años es obligatoria",
              min: { value: 1, message: "Debe ser al menos 1 año" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Duración en años"
                type="number"
                error={!!errors.duracion_anios}
                helperText={errors.duracion_anios?.message}
              />
            )}
          />
          <FormControlLabel
            control={
              <Controller
                name="activo"
                control={control}
                render={({ field }) => (
                  <Switch {...field} checked={field.value} />
                )}
              />
            }
            label="Activo"
          />
          <FormControlLabel
            control={
              <Controller
                name="inscripcion_abierta"
                control={control}
                render={({ field }) => (
                  <Switch {...field} checked={field.value} />
                )}
              />
            }
            label="Inscripción Abierta"
          />
          <FormControlLabel
            control={
              <Controller
                name="es_certificacion_docente"
                control={control}
                render={({ field }) => (
                  <Switch {...field} checked={field.value} />
                )}
              />
            }
            label="Requiere título superior e incumbencias"
          />
          <Button type="submit" variant="contained">
            {editingProfesorado ? "Actualizar" : "Guardar"}
          </Button>
          {editingProfesorado && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setEditingProfesorado(null);
                reset();
              }}
            >
              Cancelar Edición
            </Button>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitlePill title="Listado de profesorados" />
        {isLoading ? (
          <Typography>Cargando profesorados...</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Duración (años)</TableCell>
                  <TableCell>Activo</TableCell>
                  <TableCell>Inscripción Abierta</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profesorados?.map((profesorado) => (
                  <TableRow key={profesorado.id}>
                    <TableCell>{profesorado.id}</TableCell>
                    <TableCell>{profesorado.nombre}</TableCell>
                    <TableCell>{profesorado.duracion_anios}</TableCell>
                    <TableCell><Chip size="small" label={profesorado.activo ? 'Activo' : 'Inactivo'} color={profesorado.activo ? 'success' : 'default'} variant={profesorado.activo ? 'filled' : 'outlined'} /></TableCell>
                    <TableCell><Chip size="small" label={profesorado.inscripcion_abierta ? 'Abierta' : 'Cerrada'} color={profesorado.inscripcion_abierta ? 'success' : 'default'} variant={profesorado.inscripcion_abierta ? 'filled' : 'outlined'} /></TableCell>
                    
                    
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(profesorado)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(profesorado.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() =>
                          navigate(
                            `/secretaria/profesorado/${profesorado.id}/planes`
                          )
                        }
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
    </Stack>
    <FinalConfirmationDialog
      open={Boolean(pendingSubmit)}
      onConfirm={handleConfirmSubmit}
      onCancel={handleCancelConfirm}
      contextText={confirmContext}
      loading={isSaving}
    />
    </>
  );
}
