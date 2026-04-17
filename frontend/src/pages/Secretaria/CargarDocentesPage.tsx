import { useState, useMemo } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { client as api } from "@/api/client";
import { toast } from "@/utils/toast";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

type SortField = "id" | "apellido" | "nombre" | "dni" | "fecha_nacimiento" | "email" | "usuario";
type SortDir = "asc" | "desc";

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
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("apellido");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Formulario de creación
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<DocenteFormInput>({
    defaultValues: { nombre: "", apellido: "", dni: "", email: "", telefono: "", cuil: "", fecha_nacimiento: "" },
  });

  // Formulario de edición (modal)
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<DocenteFormInput>({
    defaultValues: { nombre: "", apellido: "", dni: "", email: "", telefono: "", cuil: "", fecha_nacimiento: "" },
  });

  const { data: docentes, isLoading: isLoadingDocentes } = useQuery<Docente[]>({
    queryKey: ["docentes"],
    queryFn: async () => {
      const response = await api.get("/docentes");
      return response.data;
    },
  });

  const createDocenteMutation = useMutation<Docente, Error, DocenteFormInput>({
    mutationFn: async (newDocente) => {
      const response = await api.post("/docentes/", newDocente, { suppressErrorToast: true } as any);
      return response.data;
    },
    onSuccess: (docenteCreado) => {
      queryClient.invalidateQueries({ queryKey: ["docentes"] });
      resetCreate();
      toast.success("Docente creado exitosamente");
      if (docenteCreado?.temp_password) {
        toast.info(`Usuario generado: ${docenteCreado.usuario} / ${docenteCreado.temp_password}`);
      }
    },
    onError: (error: any) => {
      const msg = error.message || "No se pudo crear el docente.";
      toast.error(msg);
    },
  });

  const updateDocenteMutation = useMutation<Docente, Error, Docente>({
    mutationFn: async (updatedDocente) => {
      const response = await api.put(`/docentes/${updatedDocente.id}`, updatedDocente, { suppressErrorToast: true } as any);
      return response.data;
    },
    onSuccess: (docenteActualizado) => {
      queryClient.invalidateQueries({ queryKey: ["docentes"] });
      setEditingDocente(null);
      toast.success("Docente actualizado exitosamente");
      if (docenteActualizado?.temp_password) {
        toast.info(`Usuario generado: ${docenteActualizado.usuario} / ${docenteActualizado.temp_password}`);
      }
    },
    onError: (error: any) => {
      const msg = error.message || "No se pudo actualizar el docente.";
      toast.error(msg);
    },
  });

  const deleteDocenteMutation = useMutation<void, Error, number>({
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

  const handleEditClick = (docente: Docente) => {
    setEditingDocente(docente);
    resetEdit({
      nombre: docente.nombre,
      apellido: docente.apellido,
      dni: docente.dni,
      email: docente.email || "",
      telefono: docente.telefono || "",
      cuil: docente.cuil || "",
      fecha_nacimiento: docente.fecha_nacimiento || "",
    });
  };

  const handleDeleteClick = (docenteId: number) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este docente?")) {
      deleteDocenteMutation.mutate(docenteId);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredDocentes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (docentes ?? []).filter((d) =>
      !q ||
      d.dni.toLowerCase().includes(q) ||
      d.apellido.toLowerCase().includes(q) ||
      d.nombre.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const av = (a[sortField] ?? "") as string;
      const bv = (b[sortField] ?? "") as string;
      const cmp = String(av).localeCompare(String(bv), "es", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [docentes, search, sortField, sortDir]);

  const handleCloseModal = () => {
    setEditingDocente(null);
    resetEdit();
  };

  const onEditSubmit = (data: DocenteFormInput) => {
    if (editingDocente) {
      updateDocenteMutation.mutate({ ...editingDocente, ...data });
    }
  };

  const docenteFormFields = (
    control: any,
    errors: any,
    dniReadOnly = false
  ) => (
    <>
      <Controller
        name="nombre"
        control={control}
        rules={{ required: "El nombre es obligatorio" }}
        render={({ field }) => (
          <TextField {...field} size="small" label="Nombre" error={!!errors.nombre} helperText={errors.nombre?.message} />
        )}
      />
      <Controller
        name="apellido"
        control={control}
        rules={{ required: "El apellido es obligatorio" }}
        render={({ field }) => (
          <TextField {...field} size="small" label="Apellido" error={!!errors.apellido} helperText={errors.apellido?.message} />
        )}
      />
      <Controller
        name="dni"
        control={control}
        rules={{ required: "El DNI es obligatorio" }}
        render={({ field }) => (
          <TextField {...field} size="small" label="DNI" error={!!errors.dni} helperText={errors.dni?.message} InputProps={{ readOnly: dniReadOnly }} />
        )}
      />
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField {...field} size="small" label="Email (Opcional)" type="email" error={!!errors.email} helperText={errors.email?.message} />
        )}
      />
      <Controller
        name="telefono"
        control={control}
        render={({ field }) => (
          <TextField {...field} size="small" label="Teléfono (Opcional)" error={!!errors.telefono} helperText={errors.telefono?.message} />
        )}
      />
      <Controller
        name="cuil"
        control={control}
        render={({ field }) => (
          <TextField {...field} size="small" label="CUIL (Opcional)" error={!!errors.cuil} helperText={errors.cuil?.message} />
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
            slotProps={{ textField: { size: "small", fullWidth: true, error: !!errors.fecha_nacimiento, helperText: errors.fecha_nacimiento?.message } }}
          />
        )}
      />
    </>
  );

  return (
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Cargar docentes"
        subtitle="Alta, edición y baja de perfiles docentes del sistema"
      />

      {/* Formulario de creación */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" mb={2}>Crear nuevo docente</Typography>
        <Box
          component="form"
          onSubmit={handleCreateSubmit((data) => createDocenteMutation.mutate(data))}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {docenteFormFields(createControl, createErrors)}
          <Button
            type="submit"
            variant="contained"
            disabled={createDocenteMutation.isPending}
            sx={{ bgcolor: INSTITUTIONAL_TERRACOTTA, '&:hover': { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK } }}
          >
            Guardar Docente
          </Button>
        </Box>
      </Paper>

      {/* Listado */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6">Listado de Docentes</Typography>
          <TextField
            size="small"
            placeholder="Buscar por nombre, apellido o DNI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>
        {isLoadingDocentes ? (
          <Typography>Cargando docentes...</Typography>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {([ ["id", "ID"], ["apellido", "Apellido"], ["nombre", "Nombre"], ["dni", "DNI"], ["fecha_nacimiento", "Fecha Nac."], ["email", "Email"], ["usuario", "Usuario"] ] as [SortField, string][]).map(([field, label]) => (
                      <TableCell key={field} sortDirection={sortField === field ? sortDir : false}>
                        <TableSortLabel
                          active={sortField === field}
                          direction={sortField === field ? sortDir : "asc"}
                          onClick={() => handleSort(field)}
                        >
                          {label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    <TableCell>Teléfono</TableCell>
                    <TableCell>CUIL</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDocentes.map((docente) => (
                    <TableRow key={docente.id}>
                      <TableCell>{docente.id}</TableCell>
                      <TableCell>{docente.apellido}</TableCell>
                      <TableCell>{docente.nombre}</TableCell>
                      <TableCell>{docente.dni}</TableCell>
                      <TableCell>{docente.fecha_nacimiento ? dayjs(docente.fecha_nacimiento).format("DD/MM/YYYY") : "-"}</TableCell>
                      <TableCell>{docente.email || "-"}</TableCell>
                      <TableCell>{docente.usuario || "-"}</TableCell>
                      <TableCell>{docente.telefono || "-"}</TableCell>
                      <TableCell>{docente.cuil || "-"}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditClick(docente)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(docente.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDocentes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        Sin resultados para "{search}"
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              {filteredDocentes.length} de {docentes?.length ?? 0} docentes
            </Typography>
          </>
        )}
      </Paper>

      {/* Modal de edición */}
      <Dialog open={!!editingDocente} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: INSTITUTIONAL_TERRACOTTA, color: "white", fontWeight: 700 }}>
          Editar docente — {editingDocente?.apellido}, {editingDocente?.nombre}
        </DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="edit-docente-form"
            onSubmit={handleEditSubmit(onEditSubmit)}
            sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}
          >
            {docenteFormFields(editControl, editErrors)}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseModal} variant="outlined" color="inherit">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-docente-form"
            variant="contained"
            disabled={updateDocenteMutation.isPending}
            sx={{ bgcolor: INSTITUTIONAL_TERRACOTTA, '&:hover': { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK } }}
          >
            {updateDocenteMutation.isPending ? "Guardando..." : "Actualizar Docente"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
