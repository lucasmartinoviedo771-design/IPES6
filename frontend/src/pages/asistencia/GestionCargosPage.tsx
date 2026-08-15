import React, { useState, useEffect } from "react";
import {
Box,
Button,
Typography,
Paper,
Dialog,
DialogTitle,
DialogContent,
DialogActions,
TextField,
MenuItem,
Grid,
Accordion,
AccordionSummary,
AccordionDetails,
IconButton,
Chip,
List,
ListItem,
ListItemText,
ListItemIcon,
Checkbox,
FormControlLabel,
Switch
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSnackbar } from "notistack";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import {
type Cargo,
type CargoCreate,
type AsignarDocenteCreate,
type HorarioCargoCreate,
fetchCargos,
createCargo,
updateCargo,
deleteCargo,
asignarDocenteCargo,
updateAsignacionDocenteCargo,
deleteAsignacionDocenteCargo,
agregarHorarioCargo,
updateHorarioCargo,
deleteHorarioCargo
} from "@/api/cargos";
import { listarDocentes } from "@/api/docentes";

const DIAS_SEMANA = [
{ value: -1, label: "Lunes a Viernes (5 días)" },
{ value: 0, label: "Lunes" },
{ value: 1, label: "Martes" },
{ value: 2, label: "Miércoles" },
{ value: 3, label: "Jueves" },
{ value: 4, label: "Viernes" },
{ value: 5, label: "Sábado" },
{ value: 6, label: "Domingo" },
];

const SITUACION_REVISTA = [
{ value: "titular", label: "Titular" },
{ value: "interino", label: "Interino" },
{ value: "suplente", label: "Suplente" },
];

const GestionCargosPage: React.FC = () => {
const { enqueueSnackbar } = useSnackbar();
const [cargos, setCargos] = useState<Cargo[]>([]);
const [docentes, setDocentes] = useState<any[]>([]);
const [loading, setLoading] = useState(false);

// Estado para Modal Crear/Editar Cargo
const [openCargoModal, setOpenCargoModal] = useState(false);
const [isEditingCargo, setIsEditingCargo] = useState(false);
const [editingCargoId, setEditingCargoId] = useState<number | null>(null);
const [newCargo, setNewCargo] = useState<CargoCreate>({
codigo_cargo: "",
nombre: "",
tipo_cargo: "horas_reloj",
duracion_minutos: 260,
});

// Estado para Modal Asignar/Editar Docente
const [openDocenteModal, setOpenDocenteModal] = useState(false);
const [isEditingDocente, setIsEditingDocente] = useState(false);
const [editingAsignacionId, setEditingAsignacionId] = useState<number | null>(null);
const [selectedCargoId, setSelectedCargoId] = useState<number | null>(null);
const [asignarData, setAsignarData] = useState<AsignarDocenteCreate>({
docente_id: 0,
sit_revista: "titular",
fecha_inicio: new Date().toISOString().split("T")[0],
activo: true,
});

// Estado para Modal Agregar/Editar Horario
const [openHorarioModal, setOpenHorarioModal] = useState(false);
const [isEditingHorario, setIsEditingHorario] = useState(false);
const [editingHorarioId, setEditingHorarioId] = useState<number | null>(null);
const [horarioData, setHorarioData] = useState<HorarioCargoCreate>({
dia_semana: -1,
hora_inicio: "14:00",
hora_fin: "18:00",
});
const [selectedHorarios, setSelectedHorarios] = useState<number[]>([]);

const loadData = async () => {
setLoading(true);
try {
const [cargosData, docentesData] = await Promise.all([
fetchCargos(),
listarDocentes(),
]);
setCargos(cargosData);
setDocentes(docentesData);
} catch (err) {
enqueueSnackbar("Error al cargar la información", { variant: "error" });
} finally {
setLoading(false);
}
};

useEffect(() => {
loadData();
}, []);

// --- Handlers para Cargo ---
const openCreateCargo = () => {
setIsEditingCargo(false);
setEditingCargoId(null);
setNewCargo({
codigo_cargo: `CARG-${Date.now()}`,
nombre: "",
tipo_cargo: "horas_reloj",
duracion_minutos: 260,
descripcion: "",
codigo_salarial: "",
});
setOpenCargoModal(true);
};

const openEditCargo = (cargo: Cargo, e: React.MouseEvent) => {
e.stopPropagation();
setIsEditingCargo(true);
setEditingCargoId(cargo.id);
setNewCargo({
codigo_cargo: cargo.codigo_cargo,
nombre: cargo.nombre,
tipo_cargo: cargo.tipo_cargo,
duracion_minutos: cargo.duracion_minutos,
descripcion: cargo.descripcion,
codigo_salarial: cargo.codigo_salarial,
});
setOpenCargoModal(true);
};

const handleSaveCargo = async () => {
try {
if (isEditingCargo && editingCargoId) {
await updateCargo(editingCargoId, newCargo);
enqueueSnackbar("Cargo actualizado con éxito", { variant: "success" });
} else {
await createCargo(newCargo);
enqueueSnackbar("Cargo creado con éxito", { variant: "success" });
}
setOpenCargoModal(false);
loadData();
} catch (err: any) {
enqueueSnackbar(err.response?.data?.message || "Error al guardar cargo", { variant: "error" });
}
};

const handleDeleteCargo = async (cargoId: number, e: React.MouseEvent) => {
e.stopPropagation();
if (!window.confirm("¿Estás seguro de eliminar este cargo?")) return;
try {
await deleteCargo(cargoId);
enqueueSnackbar("Cargo eliminado", { variant: "success" });
loadData();
} catch (err: any) {
enqueueSnackbar(err.response?.data?.message || "Error al eliminar cargo", { variant: "error" });
}
};

// --- Handlers para Asignar Docente ---
const openAsignarDocente = (cargoId: number) => {
setIsEditingDocente(false);
setEditingAsignacionId(null);
setSelectedCargoId(cargoId);
setAsignarData({
docente_id: docentes.length > 0 ? docentes[0].id : 0,
sit_revista: "titular",
fecha_inicio: new Date().toISOString().split("T")[0],
activo: true,
fecha_fin: "",
resolucion: ""
});
setOpenDocenteModal(true);
};

const openEditAsignacion = (asig: any) => {
setIsEditingDocente(true);
setEditingAsignacionId(asig.id);
setAsignarData({
docente_id: asig.docente_id,
sit_revista: asig.sit_revista,
fecha_inicio: asig.fecha_inicio,
fecha_fin: asig.fecha_fin || "",
resolucion: asig.resolucion || "",
activo: asig.activo,
});
setOpenDocenteModal(true);
};

const handleSaveAsignacion = async () => {
try {
if (isEditingDocente && editingAsignacionId) {
await updateAsignacionDocenteCargo(editingAsignacionId, asignarData);
enqueueSnackbar("Asignación actualizada con éxito", { variant: "success" });
} else {
if (!selectedCargoId) return;
await asignarDocenteCargo(selectedCargoId, asignarData);
enqueueSnackbar("Docente asignado con éxito", { variant: "success" });
}
setOpenDocenteModal(false);
loadData();
} catch (err: any) {
enqueueSnackbar(err.response?.data?.message || "Error al guardar asignación", { variant: "error" });
}
};

const handleDeleteAsignacion = async (asigId: number) => {
if (!window.confirm("¿Eliminar esta asignación?")) return;
try {
await deleteAsignacionDocenteCargo(asigId);
enqueueSnackbar("Asignación eliminada", { variant: "success" });
loadData();
} catch (err: any) {
enqueueSnackbar("Error al eliminar asignación", { variant: "error" });
}
};

	// --- Helper function para calcular hora_fin ---
	const addMinutesToTime = (timeStr: string, minutesToAdd: number) => {
		if (!timeStr) return "";
		const [hours, mins] = timeStr.split(":").map(Number);
		const date = new Date();
		date.setHours(hours, mins, 0, 0);
		date.setMinutes(date.getMinutes() + minutesToAdd);
		return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
	};

	// --- Handlers para Agregar/Editar Horario ---
	const openAgregarHorario = (cargo: Cargo) => {
		setIsEditingHorario(false);
		setEditingHorarioId(null);
		setSelectedCargoId(cargo.id);
		setHorarioData({
			dia_semana: -1,
			hora_inicio: "14:00",
			hora_fin: addMinutesToTime("14:00", cargo.duracion_minutos),
		});
		setOpenHorarioModal(true);
	};

const openEditHorario = (horario: any) => {
setIsEditingHorario(true);
setEditingHorarioId(horario.id);
setHorarioData({
dia_semana: horario.dia_semana,
hora_inicio: horario.hora_inicio,
hora_fin: horario.hora_fin,
});
setOpenHorarioModal(true);
};

const handleSaveHorario = async () => {
try {
if (isEditingHorario && editingHorarioId) {
await updateHorarioCargo(editingHorarioId, horarioData);
enqueueSnackbar("Horario actualizado con éxito", { variant: "success" });
} else {
if (!selectedCargoId) return;
if (horarioData.dia_semana === -1) {
const promises = [1, 2, 3, 4, 5].map(dia => 
agregarHorarioCargo(selectedCargoId, { ...horarioData, dia_semana: dia }, { suppressErrorToast: true }).catch(err => err)
);
const results = await Promise.all(promises);
const errors = results.filter(r => r instanceof Error || (r.response && r.response.data));
if (errors.length > 0) {
const errorMsgs = errors.map((e: any) => e.message || e.response?.data?.message || "Error desconocido");
enqueueSnackbar(`No se pudieron agregar algunos horarios: ${errorMsgs[0]}${errors.length > 1 ? ` (y ${errors.length - 1} errores más)` : ''}`, { variant: "error" });
if (errors.length === 5) return; // All failed
} else {
enqueueSnackbar("Horarios agregados con éxito", { variant: "success" });
}
} else {
await agregarHorarioCargo(selectedCargoId, horarioData);
enqueueSnackbar("Horario agregado con éxito", { variant: "success" });
}
}
setOpenHorarioModal(false);
loadData();
} catch (err: any) {
enqueueSnackbar(err.response?.data?.message || "Error al guardar horario", { variant: "error" });
}
};

const handleDeleteHorario = async (horarioId: number) => {
if (!window.confirm("¿Eliminar este horario?")) return;
try {
await deleteHorarioCargo(horarioId);
enqueueSnackbar("Horario eliminado", { variant: "success" });
loadData();
} catch (err: any) {
enqueueSnackbar("Error al eliminar horario", { variant: "error" });
}
};

const handleToggleHorario = (horarioId: number) => {
setSelectedHorarios(prev => 
prev.includes(horarioId) ? prev.filter(id => id !== horarioId) : [...prev, horarioId]
);
};

const handleBulkDeleteHorarios = async (horarios: any[]) => {
const toDelete = horarios.filter(h => selectedHorarios.includes(h.id));
if (toDelete.length === 0) return;
if (!window.confirm(`¿Eliminar ${toDelete.length} horario(s) seleccionado(s)?`)) return;

try {
await Promise.all(toDelete.map(h => deleteHorarioCargo(h.id)));
enqueueSnackbar(`${toDelete.length} horario(s) eliminado(s)`, { variant: "success" });
setSelectedHorarios(prev => prev.filter(id => !toDelete.find(h => h.id === id)));
loadData();
} catch (err: any) {
enqueueSnackbar("Error al eliminar algunos horarios", { variant: "error" });
}
};

return (
<Box sx={{ pb: 8 }}>
<PageHero
title="Gestión de Cargos"
subtitle="Administración de cargos institucionales, horarios y docentes asignados"
/>
<Box sx={{ maxWidth: 1200, mx: "auto", px: 2, mt: 4 }}>
<Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
<BackButton fallbackPath="/secretaria" />
<Button
variant="contained"
startIcon={<AddIcon />}
onClick={openCreateCargo}
>
Nuevo Cargo
</Button>
</Box>

{cargos.length === 0 && !loading && (
<Typography variant="body1" sx={{ textAlign: "center", mt: 4, color: "text.secondary" }}>
No hay cargos registrados.
</Typography>
)}

{cargos.map((cargo) => (
<Accordion key={cargo.id} sx={{ mb: 2, borderRadius: 2, "&:before": { display: "none" } }} elevation={1}>
<AccordionSummary expandIcon={<ExpandMoreIcon />}>
<Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", pr: 2 }}>
<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
<Typography variant="h6" component="div">
{cargo.nombre}
</Typography>
<Box sx={{ display: "flex", gap: 1 }}>
{cargo.codigo_salarial && (
<Chip size="small" label={`Cod. Salarial: ${cargo.codigo_salarial}`} color="primary" variant="outlined" />
)}
<Chip size="small" label={cargo.tipo_cargo_display} color="secondary" variant="outlined" />
</Box>
</Box>
<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
<IconButton size="small" color="primary" onClick={(e) => openEditCargo(cargo, e)}>
<EditIcon />
</IconButton>
<IconButton size="small" color="error" onClick={(e) => handleDeleteCargo(cargo.id, e)}>
<DeleteIcon />
</IconButton>
</Box>
</Box>
</AccordionSummary>
<AccordionDetails>
<Grid container spacing={3}>
{/* Docentes Asignados */}
<Grid item xs={12} md={6}>
<Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
<Typography variant="subtitle1" fontWeight="bold">Docentes Asignados</Typography>
<Button size="small" startIcon={<PersonAddIcon />} onClick={() => openAsignarDocente(cargo.id)}>
Asignar
</Button>
</Box>
{cargo.asignaciones.length === 0 ? (
<Typography variant="body2" color="text.secondary">Sin docentes asignados</Typography>
) : (
<List dense>
{cargo.asignaciones.map(asig => (
<ListItem 
key={asig.id} 
divider
secondaryAction={
<Box>
<IconButton edge="end" size="small" onClick={() => openEditAsignacion(asig)} sx={{ mr: 1 }}>
<EditIcon fontSize="small" color="primary" />
</IconButton>
<IconButton edge="end" size="small" onClick={() => handleDeleteAsignacion(asig.id)}>
<DeleteIcon fontSize="small" color="error" />
</IconButton>
</Box>
}
>
<ListItemText 
primary={
<Typography variant="body2" sx={{ fontWeight: asig.activo ? "bold" : "normal", color: asig.activo ? "text.primary" : "text.secondary" }}>
{asig.docente_nombre} {asig.activo ? "" : "(Inactivo)"}
</Typography>
} 
secondary={`${asig.sit_revista_display} | Desde: ${asig.fecha_inicio}`} 
/>
</ListItem>
))}
</List>
)}
</Paper>
</Grid>
{/* Horarios */}
<Grid item xs={12} md={6}>
<Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
<Typography variant="subtitle1" fontWeight="bold">Días y Horarios</Typography>
<Box sx={{ display: "flex", gap: 1 }}>
{cargo.horarios.filter(h => selectedHorarios.includes(h.id)).length > 0 && (
<Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleBulkDeleteHorarios(cargo.horarios)}>
Eliminar ({cargo.horarios.filter(h => selectedHorarios.includes(h.id)).length})
</Button>
)}
									<Button
										size="small"
										startIcon={<ScheduleIcon />}
										onClick={() => openAgregarHorario(cargo)}
									>
Agregar
</Button>
</Box>
</Box>
{cargo.horarios.length === 0 ? (
<Typography variant="body2" color="text.secondary">Sin horarios cargados</Typography>
) : (
<List dense>
{cargo.horarios.map(h => (
<ListItem 
key={h.id} 
divider
secondaryAction={
<Box>
<IconButton edge="end" size="small" onClick={() => openEditHorario(h)} sx={{ mr: 1 }}>
<EditIcon fontSize="small" color="primary" />
</IconButton>
<IconButton edge="end" size="small" onClick={() => handleDeleteHorario(h.id)}>
<DeleteIcon fontSize="small" color="error" />
</IconButton>
</Box>
}
>
<ListItemIcon sx={{ minWidth: 40 }}>
<Checkbox 
edge="start" 
checked={selectedHorarios.includes(h.id)} 
onChange={() => handleToggleHorario(h.id)}
/>
</ListItemIcon>
<ListItemText 
primary={h.dia_nombre} 
secondary={`${h.hora_inicio} a ${h.hora_fin}`} 
/>
</ListItem>
))}
</List>
)}
</Paper>
</Grid>
</Grid>
</AccordionDetails>
</Accordion>
))}
</Box>

{/* Modal Nuevo/Editar Cargo */}
<Dialog open={openCargoModal} onClose={() => setOpenCargoModal(false)} maxWidth="sm" fullWidth>
<DialogTitle>{isEditingCargo ? "Editar Cargo" : "Crear Nuevo Cargo"}</DialogTitle>
<DialogContent dividers>
<Grid container spacing={2}>
								<Grid item xs={12} sm={6}>
									<TextField
										label="Código Salarial"
										fullWidth
										value={newCargo.codigo_salarial || ""}
										onChange={(e) => setNewCargo({ ...newCargo, codigo_salarial: e.target.value })}
										helperText="Puede repetirse (ej: 903)"
									/>
								</Grid>
								<Grid item xs={12} sm={6}>
									<TextField
										label="Nombre *"
										fullWidth
										required
										value={newCargo.nombre}
										onChange={(e) => setNewCargo({ ...newCargo, nombre: e.target.value })}
									/>
								</Grid>
<Grid item xs={12}>
<TextField
label="Descripción"
fullWidth
multiline
rows={2}
value={newCargo.descripcion || ""}
onChange={(e) => setNewCargo({ ...newCargo, descripcion: e.target.value })}
/>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
select
label="Tipo de Cargo"
fullWidth
required
value={newCargo.tipo_cargo}
onChange={(e) => {
const tipo = e.target.value;
setNewCargo({
...newCargo,
tipo_cargo: tipo,
duracion_minutos: tipo === "horas_catedra" ? 40 : 260
});
}}
>
<MenuItem value="horas_reloj">Horas Reloj (Cargo)</MenuItem>
<MenuItem value="horas_catedra">Horas Cátedra</MenuItem>
</TextField>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
label="Duración (Minutos)"
type="number"
fullWidth
required
value={newCargo.duracion_minutos}
onChange={(e) => setNewCargo({ ...newCargo, duracion_minutos: Number(e.target.value) })}
/>
</Grid>
</Grid>
</DialogContent>
<DialogActions>
<Button onClick={() => setOpenCargoModal(false)}>Cancelar</Button>
<Button variant="contained" onClick={handleSaveCargo} disabled={!newCargo.codigo_cargo || !newCargo.nombre}>Guardar</Button>
</DialogActions>
</Dialog>

{/* Modal Asignar/Editar Docente */}
<Dialog open={openDocenteModal} onClose={() => setOpenDocenteModal(false)} maxWidth="sm" fullWidth>
<DialogTitle>{isEditingDocente ? "Editar Asignación" : "Asignar Docente al Cargo"}</DialogTitle>
<DialogContent dividers>
<Grid container spacing={2}>
<Grid item xs={12}>
<TextField
select
label="Seleccionar Docente"
fullWidth
required
value={asignarData.docente_id || ""}
onChange={(e) => setAsignarData({ ...asignarData, docente_id: Number(e.target.value) })}
disabled={isEditingDocente} // Al editar, normalmente no cambias de persona, sino sus atributos
>
{docentes.map((d: any) => (
<MenuItem key={d.id} value={d.id}>
{d.apellido}, {d.nombre} ({d.dni})
</MenuItem>
))}
</TextField>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
select
label="Situación de Revista"
fullWidth
required
value={asignarData.sit_revista}
onChange={(e) => setAsignarData({ ...asignarData, sit_revista: e.target.value })}
>
{SITUACION_REVISTA.map(s => (
<MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
))}
</TextField>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
label="Fecha Inicio"
type="date"
fullWidth
required
InputLabelProps={{ shrink: true }}
value={asignarData.fecha_inicio}
onChange={(e) => setAsignarData({ ...asignarData, fecha_inicio: e.target.value })}
/>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
label="Fecha Fin (Opcional)"
type="date"
fullWidth
InputLabelProps={{ shrink: true }}
value={asignarData.fecha_fin || ""}
onChange={(e) => setAsignarData({ ...asignarData, fecha_fin: e.target.value })}
/>
</Grid>
<Grid item xs={12} sm={6}>
<Box display="flex" alignItems="center" height="100%">
<FormControlLabel
control={
<Switch
checked={asignarData.activo}
onChange={(e) => setAsignarData({ ...asignarData, activo: e.target.checked })}
color="primary"
/>
}
label="Asignación Activa"
/>
</Box>
</Grid>
</Grid>
</DialogContent>
<DialogActions>
<Button onClick={() => setOpenDocenteModal(false)}>Cancelar</Button>
<Button variant="contained" onClick={handleSaveAsignacion} disabled={!asignarData.docente_id}>Guardar</Button>
</DialogActions>
</Dialog>

{/* Modal Agregar/Editar Horario */}
<Dialog open={openHorarioModal} onClose={() => setOpenHorarioModal(false)} maxWidth="sm" fullWidth>
<DialogTitle>{isEditingHorario ? "Editar Horario" : "Agregar Horario al Cargo"}</DialogTitle>
<DialogContent dividers>
<Grid container spacing={2}>
<Grid item xs={12}>
<TextField
select
label="Día de la semana"
fullWidth
required
value={horarioData.dia_semana}
onChange={(e) => setHorarioData({ ...horarioData, dia_semana: Number(e.target.value) })}
disabled={isEditingHorario} // Generalmente no se edita el día, sino la hora
>
{DIAS_SEMANA.map((d) => (
<MenuItem key={d.value} value={d.value} disabled={d.value === -1 && isEditingHorario}>{d.label}</MenuItem>
))}
</TextField>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
label="Hora Inicio"
type="time"
fullWidth
required
InputLabelProps={{ shrink: true }}
										value={horarioData.hora_inicio}
										onChange={(e) => {
											const newInicio = e.target.value;
											const cargoInfo = cargos.find(c => c.id === selectedCargoId);
											const newFin = cargoInfo ? addMinutesToTime(newInicio, cargoInfo.duracion_minutos) : horarioData.hora_fin;
											setHorarioData({ ...horarioData, hora_inicio: newInicio, hora_fin: newFin });
										}}
/>
</Grid>
<Grid item xs={12} sm={6}>
<TextField
label="Hora Fin"
type="time"
fullWidth
required
InputLabelProps={{ shrink: true }}
value={horarioData.hora_fin}
onChange={(e) => setHorarioData({ ...horarioData, hora_fin: e.target.value })}
/>
</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpenHorarioModal(false)}>Cancelar</Button>
					<Button variant="contained" onClick={handleSaveHorario}>Guardar Horario</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default GestionCargosPage;
