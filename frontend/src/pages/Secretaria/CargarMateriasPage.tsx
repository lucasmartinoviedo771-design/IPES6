import { useEffect, useState } from "react";
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
  TableSortLabel,
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
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

interface Materia {
  id: number;
  plan_de_estudio_id: number;
  anio_cursada: number;
  nombre: string;
  horas_semana: number;
  formato: string;
  regimen: string;
  tipo_formacion: string;
}

interface MateriaFormInput {
  plan_de_estudio_id: number;
  anio_cursada: number;
  nombre: string;
  horas_semana: number;
  formato: string;
  regimen: string;
  tipo_formacion: string;
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

const TIPO_FORMACION_CHOICES = [
  { value: "FGN", label: "Formación general" },
  { value: "FES", label: "Formación específica" },
  { value: "PDC", label: "Práctica docente" },
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
  const [filterTipoFormacion, setFilterTipoFormacion] = useState('');

  // Sorting states
  const [sortBy, setSortBy] = useState<
    'anio' | 'nombre' | 'horas' | 'formato' | 'regimen' | 'tipo_formacion'
  >('anio');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  const handleClearFilters = () => {
    setFilterAnio('');
    setFilterNombre('');
    setFilterFormato('');
    setFilterRegimen('');
    setFilterTipoFormacion('');
    try {
      const key = `cm_filters_${currentPlanId ?? 'any'}`;
      localStorage.removeItem(key);
    } catch (e) { /* Ignored, localStorage operations can fail in some environments */ }
  };

  // Persist/restore filters in localStorage (per plan)
  useEffect(() => {
    try {
      const key = `cm_filters_${currentPlanId ?? 'any'}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const f = JSON.parse(raw);
        setFilterNombre(typeof f.nombre === 'string' ? f.nombre : '');
        setFilterAnio(typeof f.anio === 'number' ? f.anio : '');
        setFilterFormato(typeof f.formato === 'string' ? f.formato : '');
        setFilterRegimen(typeof f.regimen === 'string' ? f.regimen : '');
        setFilterTipoFormacion(typeof f.tipo_formacion === 'string' ? f.tipo_formacion : '');
      }
    } catch (e) { /* Ignored, localStorage operations can fail in some environments */ }
  }, [currentPlanId]);

  useEffect(() => {
    try {
      const key = `cm_filters_${currentPlanId ?? 'any'}`;
      const payload = {
        nombre: filterNombre,
        anio: filterAnio || '',
        formato: filterFormato,
        regimen: filterRegimen,
        tipo_formacion: filterTipoFormacion,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) { /* Ignored, localStorage operations can fail in some environments */ }
  }, [currentPlanId, filterNombre, filterAnio, filterFormato, filterRegimen, filterTipoFormacion]);

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
      tipo_formacion: "FGN",
    },
  });

  // Fetch Materias for the current Plan
  const { data: materias, isLoading: isLoadingMaterias } = useQuery<Materia[]>({
    queryKey: [
      "materias",
      currentPlanId,
      filterAnio,
      filterNombre,
      filterFormato,
      filterRegimen,
      filterTipoFormacion,
    ],
    queryFn: async () => {
      if (!currentPlanId) return [];
      const params = new URLSearchParams();
      if (filterAnio) params.append("anio_cursada", filterAnio.toString());
      if (filterNombre) params.append("nombre", filterNombre);
      if (filterFormato) params.append("formato", filterFormato);
      if (filterRegimen) params.append("regimen", filterRegimen);
      if (filterTipoFormacion) params.append("tipo_formacion", filterTipoFormacion);

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

  const updateMateriaMutation = useMutation<Materia, Error, Materia>({
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
    setValue("tipo_formacion", materia.tipo_formacion);
  };

  const handleDeleteClick = (materiaId: number) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta materia?")) {
      deleteMateriaMutation.mutate(materiaId);
    }
  };

  const heroTitle = `Cargar materias${profesorado?.nombre ? ` - ${profesorado.nombre}` : ""}`;
  const heroSubtitle = planDeEstudio?.resolucion
    ? `Plan ${planDeEstudio.resolucion}`
    : isLoadingPlanDeEstudio
      ? "Cargando plan seleccionado..."
      : "Seleccion� un plan para comenzar.";
  const backPath = planDeEstudio?.profesorado_id
    ? `/secretaria/profesorado/${planDeEstudio.profesorado_id}/planes`
    : "/secretaria/profesorado";

  return (
    <Stack gap={3}>
      <BackButton fallbackPath={backPath} />
      <PageHero title={heroTitle} subtitle={heroSubtitle} />

      {false && (
      <Paper sx={{ p: 2, mb: 2 }}>
        <SectionTitlePill title="Filtros" />
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
          <FormControl size="small" sx={{ width: 200 }}>
            <InputLabel>Tipo de formación</InputLabel>
            <Select
              value={filterTipoFormacion}
              label="Tipo de formación"
              onChange={(e) => setFilterTipoFormacion(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {TIPO_FORMACION_CHOICES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleClearFilters}>Limpiar filtros</Button>
        </Stack>
          </Paper>
          )}

      {/* Filtros debajo del formulario */}
      {/* moved filters block below create form */}

      <Paper sx={{ p: 2 }}>
        <SectionTitlePill title={editingMateria ? "Editar materia" : "Crear nueva materia"} />
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
          <FormControl fullWidth size="small" error={!!errors.tipo_formacion}>
            <InputLabel id="tipo-formacion-label">Tipo de Formación</InputLabel>
            <Controller
              name="tipo_formacion"
              control={control}
              rules={{ required: "El tipo de formación es obligatorio" }}
              render={({ field }) => (
                <Select {...field} labelId="tipo-formacion-label" label="Tipo de Formación">
                  {TIPO_FORMACION_CHOICES.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            {errors.tipo_formacion && (
              <Typography color="error" variant="caption">
                {errors.tipo_formacion.message}
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

      {/* Filtros debajo del formulario */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <SectionTitlePill title="Filtros" />
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
                <MenuItem key={year} value={year}>{year}º Año</MenuItem>
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
          <FormControl size="small" sx={{ width: 200 }}>
            <InputLabel>Tipo de formación</InputLabel>
            <Select
              value={filterTipoFormacion}
              label="Tipo de formación"
              onChange={(e) => setFilterTipoFormacion(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {TIPO_FORMACION_CHOICES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleClearFilters}>Limpiar filtros</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitlePill title="Listado de materias" />
        {isLoadingMaterias ? (
          <Typography>Cargando materias...</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell sortDirection={sortBy==='anio' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='anio'} direction={sortBy==='anio'?sortDir:'asc'} onClick={() => { setSortBy('anio'); setSortDir(d=> (sortBy!=='anio' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Año
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='nombre' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='nombre'} direction={sortBy==='nombre'?sortDir:'asc'} onClick={() => { setSortBy('nombre'); setSortDir(d=> (sortBy!=='nombre' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Nombre
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='horas' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='horas'} direction={sortBy==='horas'?sortDir:'asc'} onClick={() => { setSortBy('horas'); setSortDir(d=> (sortBy!=='horas' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Carga Horaria
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='formato' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='formato'} direction={sortBy==='formato'?sortDir:'asc'} onClick={() => { setSortBy('formato'); setSortDir(d=> (sortBy!=='formato' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Formato
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='tipo_formacion' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='tipo_formacion'} direction={sortBy==='tipo_formacion'?sortDir:'asc'} onClick={() => { setSortBy('tipo_formacion'); setSortDir(d=> (sortBy!=='tipo_formacion' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Formación
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy==='regimen' ? sortDir : false as any}>
                    <TableSortLabel active={sortBy==='regimen'} direction={sortBy==='regimen'?sortDir:'asc'} onClick={() => { setSortBy('regimen'); setSortDir(d=> (sortBy!=='regimen' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>
                      Cursada
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...(materias || [])]
                  .sort((a,b) => {
                    const dir = sortDir === 'asc' ? 1 : -1;
                    if (sortBy === 'anio') return (a.anio_cursada - b.anio_cursada) * dir;
                    if (sortBy === 'horas') return (a.horas_semana - b.horas_semana) * dir;
                    if (sortBy === 'formato') return (a.formato || '').localeCompare(b.formato || '') * dir;
                    if (sortBy === 'tipo_formacion')
                      return (a.tipo_formacion || '').localeCompare(b.tipo_formacion || '') * dir;
                    if (sortBy === 'regimen') return (a.regimen || '').localeCompare(b.regimen || '') * dir;
                    // nombre
                    return (a.nombre || '').localeCompare(b.nombre || '') * dir;
                  })
                  .map((materia) => (
                  <TableRow key={materia.id}>
                    <TableCell>{materia.id}</TableCell>
                    <TableCell>{materia.anio_cursada}</TableCell>
                    <TableCell>{materia.nombre}</TableCell>
                    <TableCell>{materia.horas_semana}</TableCell>
                    <TableCell>{FORMATO_CHOICES.find(f => f.value === materia.formato)?.label || materia.formato}</TableCell>
                    <TableCell>{TIPO_FORMACION_CHOICES.find(t => t.value === materia.tipo_formacion)?.label || materia.tipo_formacion}</TableCell>
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
