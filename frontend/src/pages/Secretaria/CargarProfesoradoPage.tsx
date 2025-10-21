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

interface Profesorado {
  id: number;
  nombre: string;
  duracion_anios: number;
  activo: boolean;
  inscripcion_abierta: boolean;
}

interface ProfesoradoFormInput {
  nombre: string;
  duracion_anios: number;
  activo: boolean;
  inscripcion_abierta: boolean;
}

export default function CargarProfesoradoPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingProfesorado, setEditingProfesorado] =
    useState<Profesorado | null>(null);

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
    },
  });

  const updateProfesoradoMutation = useMutation<
    Profesorado,
    Error,
    Profesorado
  >({
    mutationFn: async (updatedProfesorado) => {
      const response = await api.put(
        `/profesorados/${updatedProfesorado.id}/`,
        updatedProfesorado
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesorados"] });
      setEditingProfesorado(null);
      reset();
    },
  });

  const deleteProfesoradoMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (profesoradoId) => {
      await api.delete(`/profesorados/${profesoradoId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesorados"] });
    },
  });

  const onSubmit = (data: ProfesoradoFormInput) => {

    if (editingProfesorado) {
      updateProfesoradoMutation.mutate({ ...editingProfesorado, ...data });
    } else {
      createProfesoradoMutation.mutate(data);
    }
  };

  const handleEditClick = (profesorado: Profesorado) => {
    setEditingProfesorado(profesorado);
    setValue("nombre", profesorado.nombre);
    setValue("duracion_anios", profesorado.duracion_anios);
    setValue("activo", profesorado.activo);
    setValue("inscripcion_abierta", profesorado.inscripcion_abierta);
  };

  const handleDeleteClick = (profesoradoId: number) => {
    if (window.confirm("¿Estás seguro de que quieres desactivar este profesorado?")) {
      deleteProfesoradoMutation.mutate(profesoradoId);
    }
  };

  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>
        Cargar Profesorado
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" mb={2}>
          {editingProfesorado ? "Editar Profesorado" : "Crear Nuevo Profesorado"}
        </Typography>
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
        <Typography variant="h6" mb={2}>
          Listado de Profesorados
        </Typography>
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
  );
}