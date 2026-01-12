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
  Box,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { client as api } from "@/api/client";
import { toast } from "@/utils/toast";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

interface Docente {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  cuil: string | null;
  fecha_nacimiento?: string | null;
  usuario?: string | null;
  temp_password?: string | null;
}

interface DocenteFormInput {
  nombre: string;
  apellido: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  cuil: string | null;
  fecha_nacimiento?: string | null;
}

export default function CargarDocentesPage() {
  const queryClient = useQueryClient();
  const [editingDocente, setEditingDocente] = useState<Docente | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DocenteFormInput>({
    defaultValues: {
      nombre: "",
      apellido: "",
      dni: "",
      email: "",
      telefono: "",
      cuil: "",
      fecha_nacimiento: "",
    },
  });

  // Fetch Docentes
  const { data: docentes, isLoading: isLoadingDocentes } = useQuery<Docente[]>({
    queryKey: ["docentes"],
    queryFn: async () => {
      const response = await api.get("/docentes");
      return response.data;
    },
  });

  const createDocenteMutation = useMutation<Docente, Error, DocenteFormInput>({
    mutationFn: async (newDocente) => {
      const response = await api.post("/docentes", newDocente);
      return response.data;
    },
    onSuccess: (docenteCreado) => {
      queryClient.invalidateQueries({ queryKey: ["docentes"] });
      reset();
      toast.success("Docente creado exitosamente");
      if (docenteCreado?.temp_password) {
        toast.info(`Usuario generado: ${docenteCreado.usuario} / ${docenteCreado.temp_password}`);
      }
    },
    onError: (error: any) => {
      console.error("Docente POST error:", error.response?.data);
      toast.error("Error al crear el docente");
    },
  });

  const updateDocenteMutation = useMutation<Docente, Error, Docente>({
    mutationFn: async (updatedDocente) => {
      const response = await api.put(
        `/docentes/${updatedDocente.id}`,
        updatedDocente
      );
      return response.data;
    },
    onSuccess: (docenteActualizado) => {
      queryClient.invalidateQueries({ queryKey: ["docentes"] });
      setEditingDocente(null);
      reset();
      toast.success("Docente actualizado exitosamente");
      if (docenteActualizado?.temp_password) {
        toast.info(`Usuario generado: ${docenteActualizado.usuario} / ${docenteActualizado.temp_password}`);
      }
    },
    onError: (error: any) => {
      console.error("Docente PUT error:", error.response?.data);
      toast.error("Error al actualizar el docente");
    },
  });

  const deleteDocenteMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (docenteId) => {
      await api.delete(`/docentes/${docenteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docentes"] });
      toast.success("Docente eliminado exitosamente");
    },
    onError: (error: any) => {
      console.error("Docente DELETE error:", error.response?.data);
      toast.error("Error al eliminar el docente");
    },
  });

  const onSubmit = (data: DocenteFormInput) => {
    if (editingDocente) {
      updateDocenteMutation.mutate({ ...editingDocente, ...data });
    } else {
      createDocenteMutation.mutate(data);
    }
  };

  const handleEditClick = (docente: Docente) => {
    setEditingDocente(docente);
    setValue("nombre", docente.nombre);
    setValue("apellido", docente.apellido);
    setValue("dni", docente.dni);
    setValue("email", docente.email || "");
    setValue("telefono", docente.telefono || "");
    setValue("cuil", docente.cuil || "");
    setValue("fecha_nacimiento", docente.fecha_nacimiento || "");
  };

  const handleDeleteClick = (docenteId: number) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este docente?")) {
      deleteDocenteMutation.mutate(docenteId);
    }
  };

  return (
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Cargar docentes"
        subtitle="Alta, edición y baja de perfiles docentes del sistema"
      />

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" mb={2}>
          {editingDocente ? "Editar docente" : "Crear nuevo docente"}
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
                label="Nombre"
                error={!!errors.nombre}
                helperText={errors.nombre?.message}
              />
            )}
          />
          <Controller
            name="apellido"
            control={control}
            rules={{ required: "El apellido es obligatorio" }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Apellido"
                error={!!errors.apellido}
                helperText={errors.apellido?.message}
              />
            )}
          />
          <Controller
            name="dni"
            control={control}
            rules={{ required: "El DNI es obligatorio" }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="DNI"
                error={!!errors.dni}
                helperText={errors.dni?.message}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Email (Opcional)"
                type="email"
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />
          <Controller
            name="telefono"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Teléfono (Opcional)"
                error={!!errors.telefono}
                helperText={errors.telefono?.message}
              />
            )}
          />
          <Controller
            name="cuil"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="CUIL (Opcional)"
                error={!!errors.cuil}
                helperText={errors.cuil?.message}
              />
            )}
          />
          <Controller
            name="fecha_nacimiento"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Fecha de Nacimiento (Opcional)"
                format="DD/MM/YYYY"
                value={field.value ? dayjs(field.value) : null}
                onChange={(date) => field.onChange(date ? date.format("YYYY-MM-DD") : "")}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true,
                    error: !!errors.fecha_nacimiento,
                    helperText: errors.fecha_nacimiento?.message,
                  },
                }}
              />
            )}
          />
          <Button
            type="submit"
            variant="contained"
            sx={{
              bgcolor: INSTITUTIONAL_TERRACOTTA,
              '&:hover': { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK }
            }}
          >
            {editingDocente ? "Actualizar Docente" : "Guardar Docente"}
          </Button>
          {editingDocente && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setEditingDocente(null);
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
          Listado de Docentes
        </Typography>
        {isLoadingDocentes ? (
          <Typography>Cargando docentes...</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Apellido</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>DNI</TableCell>
                  <TableCell>Fecha Nac.</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Teléfono</TableCell>
                  <TableCell>CUIL</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {docentes?.map((docente) => (
                  <TableRow key={docente.id}>
                    <TableCell>{docente.id}</TableCell>
                    <TableCell>{docente.apellido}</TableCell>
                    <TableCell>{docente.nombre}</TableCell>
                    <TableCell>{docente.dni}</TableCell>
                    <TableCell>{docente.fecha_nacimiento ? dayjs(docente.fecha_nacimiento).format("DD/MM/YYYY") : "-"}</TableCell>
                    <TableCell>{docente.email || "-"}</TableCell>
                    <TableCell>{docente.telefono || "-"}</TableCell>
                    <TableCell>{docente.cuil || "-"}</TableCell>
                    <TableCell>{docente.usuario || "-"}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(docente)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(docente.id)}
                      >
                        <DeleteIcon />
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

