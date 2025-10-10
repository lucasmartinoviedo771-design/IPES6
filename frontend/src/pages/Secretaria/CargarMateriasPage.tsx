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
import { useParams } from "react-router-dom";
import { toast } from "@/utils/toast";

interface Materia {
  id: number;
  plan_de_estudio_id: number;
  anio_cursada: number;
  nombre: string;
  horas_semana: number;
  formato: string;
  regimen: string;
}

interface MateriaFormInput {
  plan_de_estudio_id: number;
  anio_cursada: number;
  nombre: string;
  horas_semana: number;
  formato: string;
  regimen: string;
}

// Define choices for Formato and TipoCursada to match backend
const FORMATO_CHOICES = [
  { value: "ASI", label: "Asignatura" },
  { value: "PRA", label: "Práctica" },
  { value: "MOD", label: "Módulo" },
  { value: "TAL", label: "Taller" },
  { value: "LAB", label: "Laboratorio" },
  { value: "SEM", label: "Seminario" },
];

const TIPO_CURSADA_CHOICES = [
  { value: "ANU", label: "Anual" },
  { value: "PCU", label: "Primer Cuatrimestre" },
  { value: "SCU", label: "Segundo Cuatrimestre" },
];

export default function CargarMateriasPage() {
  const { planId } = useParams<{ planId: string }>();
  const currentPlanId = planId ? parseInt(planId) : null;

  const { data: planDeEstudio, isLoading: isLoadingPlanDeEstudio } = useQuery<any>({
    queryKey: ["planDeEstudio", currentPlanId],
    queryFn: async () => {
      if (!currentPlanId) return null;
      const response = await api.get(`/planes/${currentPlanId}`);
      return response.data;
    },
    enabled: !!currentPlanId,
  });

  const { data: profesorado, isLoading: isLoadingProfesorado } = useQuery<any>({
    queryKey: ["profesorado", planDeEstudio?.profesorado_id],
    queryFn: async () => {
      if (!planDeEstudio?.profesorado_id) return null;
      const response = await api.get(`/profesorados/${planDeEstudio.profesorado_id}`);
      return response.data;
    },
    enabled: !!planDeEstudio?.profesorado_id,
  });

  const queryClient = useQueryClient();
  const [editingMateria, setEditingMateria] = useState<Materia | null>(null);

  // Filter states
  const [filterAnio, setFilterAnio] = useState<number | ''>('');
  const [filterNombre, setFilterNombre] = useState('');
  const [filterFormato, setFilterFormato] = useState('');
  const [filterRegimen, setFilterRegimen] = useState('');

  const handleClearFilters = () => {
    setFilterAnio('');
    setFilterNombre('');
    setFilterFormato('');
    setFilterRegimen('');
  };

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MateriaFormInput>({
    defaultValues: {
      plan_de_estudio_id: currentPlanId || 0,
      anio_cursada: 1,
      nombre: "",
      horas_semana: 0,
      formato: "ASI",
      regimen: "ANU",
    },
  });

  // Fetch Materias for the current Plan
  const { data: materias, isLoading: isLoadingMaterias } = useQuery<Materia[]>({
    queryKey: ["materias", currentPlanId, filterAnio, filterNombre, filterFormato, filterRegimen],
    queryFn: async () => {
      if (!currentPlanId) return [];
      const params = new URLSearchParams();
      if (filterAnio) params.append("anio_cursada", filterAnio.toString());
      if (filterNombre) params.append("nombre", filterNombre);
      if (filterFormato) params.append("formato", filterFormato);
      if (filterRegimen) params.append("regimen", filterRegimen);

      const response = await api.get(`/planes/${currentPlanId}/materias?${params.toString()}`);
      return response.data;
    },
    enabled: !!currentPlanId,
  });



  const createMateriaMutation = useMutation<
    Materia,
    Error,
    MateriaFormInput
  >({
    mutationFn: async (newMateria) => {
      const response = await api.post(
        `/planes/${newMateria.plan_de_estudio_id}/materias`,
        newMateria
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materias", currentPlanId] });
      reset();
      toast.success("Materia creada exitosamente");
    },
    onError: (error: any) => {
      console.error("Materia POST error:", error.response?.data);
      toast.error("Error al crear la materia");
    },
  });

  const updateMateriaMutation = useMutation<
    Materia,
    Error,
    MateriaFormInput
  >({
    mutationFn: async (updatedMateria) => {
      const response = await api.put(
        `/materias/${updatedMateria.id}`,
        updatedMateria
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materias", currentPlanId] });
      setEditingMateria(null);
      reset();
      toast.success("Materia actualizada exitosamente");
    },
    onError: (error: any) => {
      console.error("Materia PUT error:", error.response?.data);
      toast.error("Error al actualizar la materia");
    },
  });

  const deleteMateriaMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (materiaId) => {
      await api.delete(`/materias/${materiaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materias", currentPlanId] });
      toast.success("Materia eliminada exitosamente");
    },
    onError: (error: any) => {
      console.error("Materia DELETE error:", error.response?.data);
      toast.error("Error al eliminar la materia");
    },
  });

  const onSubmit = (data: MateriaFormInput) => {
    if (editingMateria) {
      updateMateriaMutation.mutate({ ...editingMateria, ...data });
    } else {
      createMateriaMutation.mutate(data);
    }
  };

  const handleEditClick = (materia: Materia) => {
    setEditingMateria(materia);
    setValue("plan_de_estudio_id", materia.plan_de_estudio_id);
    setValue("anio_cursada", materia.anio_cursada);
    setValue("nombre", materia.nombre);
    setValue("horas_semana", materia.horas_semana);
    setValue("formato", materia.formato);
    setValue("regimen", materia.regimen);
  };

  const handleDeleteClick = (materiaId: number) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta materia?")) {
      deleteMateriaMutation.mutate(materiaId);
    }
  };

  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>
        Cargar Materias para Plan {currentPlanId}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" mb={2}>Filtros</Typography>
        <Stack direction="row" spacing={2} mb={2} alignItems="center">
          <TextField
            size="small"
            label="Nombre de Materia"
            value={filterNombre}
            onChange={(e) => setFilterNombre(e.target.value)}
            sx={{ width: 200 }}
          />
          <FormControl size="small" sx={{ width: 120 }} disabled={isLoadingProfesorado}>
            <InputLabel>Año</InputLabel>
            <Select
              value={filterAnio}
              label="Año"
              onChange={(e) => setFilterAnio(e.target.value as number | '')}
            >
              <MenuItem value="">Todos</MenuItem>
              {profesorado?.duracion_anios && Array.from({ length: profesorado.duracion_anios }, (_, i) => i + 1).map(year => (
                <MenuItem key={year} value={year}>{year}° Año</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>Formato</InputLabel>
            <Select
              value={filterFormato}
              label="Formato"
              onChange={(e) => setFilterFormato(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {FORMATO_CHOICES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>Cursada</InputLabel>
            <Select
              value={filterRegimen}
              label="Cursada"
              onChange={(e) => setFilterRegimen(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {TIPO_CURSADA_CHOICES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleClearFilters}>Limpiar Filtros</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" mb={2}>
          {editingMateria ? "Editar Materia" : "Crear Nueva Materia"}
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Controller
            name="anio_cursada"
            control={control}
            rules={{
              required: "El año de cursada es obligatorio",
              min: { value: 1, message: "Debe ser al menos 1" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Año de Cursada"
                type="number"
                error={!!errors.anio_cursada}
                helperText={errors.anio_cursada?.message}
              />
            )}
          />
          <Controller
            name="nombre"
            control={control}
            rules={{ required: "El nombre de la materia es obligatorio" }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Nombre de la Materia"
                error={!!errors.nombre}
                helperText={errors.nombre?.message}
              />
            )}
          />
          <Controller
            name="horas_semana"
            control={control}
            rules={{
              required: "La carga horaria es obligatoria",
              min: { value: 0, message: "Debe ser un número positivo" },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Carga Horaria Semanal (horas cátedra)"
                type="number"
                error={!!errors.horas_semana}
                helperText={errors.horas_semana?.message}
              />
            )}
          />
          <FormControl fullWidth size="small" error={!!errors.formato}>
            <InputLabel id="formato-label">Formato</InputLabel>
            <Controller
              name="formato"
              control={control}
              rules={{ required: "El formato es obligatorio" }}
              render={({ field }) => (
                <Select {...field} labelId="formato-label" label="Formato">
                  {FORMATO_CHOICES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.formato && (
              <Typography color="error" variant="caption">
                {errors.formato.message}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth size="small" error={!!errors.regimen}>
            <InputLabel id="regimen-label">Tipo de Cursada</InputLabel>
            <Controller
              name="regimen"
              control={control}
              rules={{ required: "El tipo de cursada es obligatorio" }}
              render={({ field }) => (
                <Select {...field} labelId="regimen-label" label="Tipo de Cursada">
                  {TIPO_CURSADA_CHOICES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.regimen && (
              <Typography color="error" variant="caption">
                {errors.regimen.message}
              </Typography>
            )}
          </FormControl>

          <Button type="submit" variant="contained">
            {editingMateria ? "Actualizar Materia" : "Guardar Materia"}
          </Button>
          {editingMateria && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setEditingMateria(null);
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
          Listado de Materias
        </Typography>
        {isLoadingMaterias ? (
          <Typography>Cargando materias...</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Año</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Carga Horaria</TableCell>
                  <TableCell>Formato</TableCell>
                  <TableCell>Cursada</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materias?.map((materia) => (
                  <TableRow key={materia.id}>
                    <TableCell>{materia.id}</TableCell>
                    <TableCell>{materia.anio_cursada}</TableCell>
                    <TableCell>{materia.nombre}</TableCell>
                    <TableCell>{materia.horas_semana}</TableCell>
                    <TableCell>{TIPO_CURSADA_CHOICES.find(t => t.value === materia.regimen)?.label || materia.regimen}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(materia)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(materia.id)}
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