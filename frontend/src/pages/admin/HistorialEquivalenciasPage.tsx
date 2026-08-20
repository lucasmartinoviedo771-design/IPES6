import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useSnackbar } from "notistack";
import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
	type EquivalenciaDisposicionDTO,
	type EquivalenciaMateriaPendienteDTO,
	anularDisposicionEquivalencia,
	fetchMateriasPendientesEquivalencia,
	listarDisposicionesEquivalencia,
	modificarDisposicionEquivalencia,
} from "@/api/estudiantes";
import { useAuth } from "@/context/AuthContext";
import { INSTITUTIONAL_GREEN } from "@/styles/institutionalColors";
import { formatDateTimeToDDMMYYYY, formatDateToDDMMYYYY } from "@/utils/date";

dayjs.extend(utc);

const randomKey = () => Math.random().toString(36).substring(2, 11);

const HistorialEquivalenciasPage: React.FC = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const { enqueueSnackbar } = useSnackbar();

	const [selectedDispo, setSelectedDispo] =
		useState<EquivalenciaDisposicionDTO | null>(null);
	const [editingDispo, setEditingDispo] =
		useState<EquivalenciaDisposicionDTO | null>(null);
	const [deletingDispo, setDeletingDispo] =
		useState<EquivalenciaDisposicionDTO | null>(null);

	// Filtros
	const [dniFilter, setDniFilter] = useState("");
	const [activeDni, setActiveDni] = useState<string | undefined>(undefined);

	// Roles autorizados:
	// Edición: Bedel, Secretaría y Admin
	// Eliminación/Anulación: Solo Secretaría y Admin
	const userRoles = Array.isArray(user?.roles) ? user.roles : [];
	const isSecretariaOrAdmin =
		user?.is_superuser ||
		userRoles.some((r) => {
			const lr = String(r).toLowerCase();
			return (
				lr === "admin" ||
				lr === "administrador" ||
				lr === "secretaria" ||
				lr.startsWith("secretaria")
			);
		});

	const canEdit =
		isSecretariaOrAdmin ||
		userRoles.some((r) => {
			const lr = String(r).toLowerCase();
			return lr === "bedel" || lr.startsWith("bedel");
		});

	const canDelete = isSecretariaOrAdmin;

	const {
		data: disposiciones,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["equivalencias-historial", activeDni],
		queryFn: () =>
			listarDisposicionesEquivalencia(activeDni ? { dni: activeDni } : {}),
	});

	const handleSearch = () => {
		setActiveDni(dniFilter.trim() || undefined);
	};

	const handleClear = () => {
		setDniFilter("");
		setActiveDni(undefined);
	};

	const deleteMutation = useMutation({
		mutationFn: (id: number) => anularDisposicionEquivalencia(id),
		onSuccess: () => {
			enqueueSnackbar("Disposición de equivalencia anulada correctamente", {
				variant: "success",
			});
			setDeletingDispo(null);
			queryClient.invalidateQueries({ queryKey: ["equivalencias-historial"] });
		},
		onError: (err: any) => {
			const msg =
				err?.response?.data?.message ||
				"Error al anular la disposición de equivalencia.";
			enqueueSnackbar(msg, { variant: "error" });
		},
	});

	return (
		<Box sx={{ p: 3 }}>
			<Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
				<IconButton onClick={() => navigate(-1)}>
					<KeyboardReturnIcon />
				</IconButton>
				<Typography variant="h5" fontWeight={600} color="primary">
					Historial de Equivalencias por Disposición
				</Typography>
			</Stack>

			{/* Filtros de Busqueda */}
			<Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					spacing={2}
					alignItems="center"
				>
					<TextField
						label="DNI del estudiante"
						size="small"
						placeholder="Buscar por DNI..."
						value={dniFilter}
						onChange={(e) => setDniFilter(e.target.value.replace(/\D/g, ""))}
						sx={{ width: { xs: "100%", md: 250 } }}
					/>
					<Button
						variant="contained"
						onClick={handleSearch}
						startIcon={<SearchIcon />}
					>
						Buscar
					</Button>
					{activeDni && (
						<Button color="inherit" onClick={handleClear}>
							Limpiar
						</Button>
					)}
				</Stack>
			</Paper>

			{isLoading && (
				<Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
					<CircularProgress />
				</Box>
			)}

			{isError && (
				<Alert severity="error" sx={{ mb: 3 }}>
					No se pudo cargar el historial de equivalencias.
				</Alert>
			)}

			{!isLoading && !isError && (
				<TableContainer
					component={Paper}
					elevation={2}
					sx={{ borderRadius: 2 }}
				>
					<Table>
						<TableHead sx={{ bgcolor: "grey.100" }}>
							<TableRow>
								<TableCell>
									<b>ID</b>
								</TableCell>
								<TableCell>
									<b>Fecha Dispo.</b>
								</TableCell>
								<TableCell>
									<b>Nº Disposición</b>
								</TableCell>
								<TableCell>
									<b>Estudiante</b>
								</TableCell>
								<TableCell>
									<b>Profesorado</b>
								</TableCell>
								<TableCell align="center">
									<b>Materias</b>
								</TableCell>
								<TableCell align="right">
									<b>Acciones</b>
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{disposiciones?.map((dispo) => (
								<TableRow key={dispo.id} hover>
									<TableCell>{dispo.id}</TableCell>
									<TableCell>
										{formatDateToDDMMYYYY(dispo.fecha_disposicion)}
									</TableCell>
									<TableCell>
										<Typography variant="body2" fontWeight={600}>
											{dispo.numero_disposicion}
										</Typography>
									</TableCell>
									<TableCell>
										<Typography variant="body2">
											{dispo.estudiante_nombre}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											DNI: {dispo.estudiante_dni}
										</Typography>
									</TableCell>
									<TableCell>
										<Typography
											variant="caption"
											sx={{ display: "block", lineHeight: 1.2 }}
										>
											{dispo.profesorado_nombre}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											Plan: {dispo.plan_resolucion}
										</Typography>
									</TableCell>
									<TableCell align="center">
										<Chip
											label={dispo.detalles.length}
											size="small"
											color="primary"
											variant="outlined"
										/>
									</TableCell>
									<TableCell align="right">
										<Stack
											direction="row"
											spacing={1}
											justifyContent="flex-end"
											alignItems="center"
										>
											<Tooltip title="Ver detalle">
												<IconButton
													color="primary"
													size="small"
													onClick={() => setSelectedDispo(dispo)}
												>
													<VisibilityIcon fontSize="small" />
												</IconButton>
											</Tooltip>

											{canEdit && (
												<Tooltip title="Modificar equivalencia">
													<IconButton
														color="warning"
														size="small"
														onClick={() => setEditingDispo(dispo)}
													>
														<EditIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											)}
											{canDelete && (
												<Tooltip title="Anular / Eliminar equivalencia">
													<IconButton
														color="error"
														size="small"
														onClick={() => setDeletingDispo(dispo)}
													>
														<DeleteIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											)}
										</Stack>
									</TableCell>
								</TableRow>
							))}
							{disposiciones?.length === 0 && (
								<TableRow>
									<TableCell colSpan={7} align="center" sx={{ py: 3 }}>
										No hay equivalencias registradas que coincidan con la
										búsqueda.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</TableContainer>
			)}

			{selectedDispo && (
				<DetalleEquivalenciaDialog
					open={!!selectedDispo}
					dispo={selectedDispo}
					onClose={() => setSelectedDispo(null)}
				/>
			)}

			{editingDispo && (
				<EditarEquivalenciaDialog
					open={!!editingDispo}
					dispo={editingDispo}
					onClose={() => setEditingDispo(null)}
					onSuccess={() => {
						setEditingDispo(null);
						queryClient.invalidateQueries({
							queryKey: ["equivalencias-historial"],
						});
					}}
				/>
			)}

			{/* Confirmación de eliminación */}
			<Dialog
				open={!!deletingDispo}
				onClose={() => setDeletingDispo(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle sx={{ color: "error.main", fontWeight: 600 }}>
					Anular Disposición de Equivalencia
				</DialogTitle>
				<DialogContent dividers>
					<Typography variant="body2" sx={{ mb: 1.5 }}>
						¿Estás seguro de que deseas anular la Disposición Nº{" "}
						<b>{deletingDispo?.numero_disposicion}</b> del estudiante{" "}
						<b>{deletingDispo?.estudiante_nombre}</b> (DNI:{" "}
						{deletingDispo?.estudiante_dni})?
					</Typography>
					<Alert severity="warning">
						Esta acción eliminará la acreditación de las materias y las actas de
						examen asociadas a esta disposición en el analítico del estudiante.
					</Alert>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setDeletingDispo(null)}
						disabled={deleteMutation.isPending}
					>
						Cancelar
					</Button>
					<Button
						color="error"
						variant="contained"
						onClick={() => {
							if (deletingDispo) deleteMutation.mutate(deletingDispo.id);
						}}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? "Anulando..." : "Confirmar Anulación"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

interface DetalleProps {
	open: boolean;
	dispo: EquivalenciaDisposicionDTO;
	onClose: () => void;
}

const DetalleEquivalenciaDialog: React.FC<DetalleProps> = ({
	open,
	dispo,
	onClose,
}) => {
	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ bgcolor: INSTITUTIONAL_GREEN, color: "white" }}>
				Detalle de Disposición #{dispo.numero_disposicion}
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2} sx={{ mt: 1 }}>
					<Grid container spacing={2}>
						<Grid item xs={12}>
							<Typography variant="subtitle2" color="text.secondary">
								Estudiante
							</Typography>
							<Typography variant="body1" fontWeight={500}>
								{dispo.estudiante_nombre}
							</Typography>
							<Typography variant="body2">
								DNI: {dispo.estudiante_dni}
							</Typography>
						</Grid>
						<Grid item xs={12} sm={6}>
							<Typography variant="subtitle2" color="text.secondary">
								Fecha de Disposición
							</Typography>
							<Typography variant="body1">
								{formatDateToDDMMYYYY(dispo.fecha_disposicion)}
							</Typography>
						</Grid>
						<Grid item xs={12} sm={6}>
							<Typography variant="subtitle2" color="text.secondary">
								Creado el
							</Typography>
							<Typography variant="body1">
								{formatDateTimeToDDMMYYYY(dispo.creado_en)}
							</Typography>
						</Grid>
						<Grid item xs={12}>
							<Typography variant="subtitle2" color="text.secondary">
								Profesorado
							</Typography>
							<Typography variant="body2">
								{dispo.profesorado_nombre}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								Plan: {dispo.plan_resolucion}
							</Typography>
						</Grid>
					</Grid>

					<Divider />

					<Box>
						<Typography variant="subtitle1" fontWeight={600} gutterBottom>
							Materias Acreditadas
						</Typography>
						<List dense disablePadding>
							{dispo.detalles.map((det) => (
								<ListItem key={det.id} divider>
									<ListItemText
										primary={det.materia_nombre}
										secondary={`Nota: ${det.nota}`}
									/>
								</ListItem>
							))}
						</List>
					</Box>

					{dispo.observaciones && (
						<Box sx={{ mt: 1, p: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
							<Typography variant="subtitle2" color="text.secondary">
								Observaciones
							</Typography>
							<Typography variant="body2">{dispo.observaciones}</Typography>
						</Box>
					)}

					<Box sx={{ pt: 1 }}>
						<Typography variant="caption" color="text.disabled">
							Registrado por: {dispo.creado_por || "Sistema"}
						</Typography>
					</Box>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} variant="contained">
					Cerrar
				</Button>
			</DialogActions>
		</Dialog>
	);
};

interface EditarProps {
	open: boolean;
	dispo: EquivalenciaDisposicionDTO;
	onClose: () => void;
	onSuccess: () => void;
}

type RowEdit = {
	key: string;
	materiaId: number;
	materiaNombre: string;
	nota: string;
	isExisting: boolean;
};

const EditarEquivalenciaDialog: React.FC<EditarProps> = ({
	open,
	dispo,
	onClose,
	onSuccess,
}) => {
	const { enqueueSnackbar } = useSnackbar();
	const [numeroDisposicion, setNumeroDisposicion] = useState(
		dispo.numero_disposicion || "",
	);
	const [fechaDisposicion, setFechaDisposicion] = useState(
		dispo.fecha_disposicion || new Date().toISOString().slice(0, 10),
	);
	const [observaciones, setObservaciones] = useState(dispo.observaciones || "");

	const [rows, setRows] = useState<RowEdit[]>(() =>
		dispo.detalles.map((det) => ({
			key: randomKey(),
			materiaId: det.materia_id,
			materiaNombre: det.materia_nombre,
			nota: det.nota,
			isExisting: true,
		})),
	);

	const [materiasPlan, setMateriasPlan] = useState<
		EquivalenciaMateriaPendienteDTO[]
	>([]);
	const [loadingMaterias, setLoadingMaterias] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	// Cargar materias disponibles del plan
	useEffect(() => {
		let isMounted = true;
		if (open && dispo.estudiante_dni && dispo.profesorado_id && dispo.plan_id) {
			setLoadingMaterias(true);
			fetchMateriasPendientesEquivalencia({
				dni: dispo.estudiante_dni,
				profesorado_id: dispo.profesorado_id,
				plan_id: dispo.plan_id,
			})
				.then((mats) => {
					if (isMounted) setMateriasPlan(mats);
				})
				.catch(() => {
					if (isMounted) setMateriasPlan([]);
				})
				.finally(() => {
					if (isMounted) setLoadingMaterias(false);
				});
		}
		return () => {
			isMounted = false;
		};
	}, [open, dispo]);

	const handleRowChange = (
		key: string,
		field: "materiaId" | "nota",
		value: any,
	) => {
		setRows((prev) =>
			prev.map((r) => {
				if (r.key !== key) return r;
				if (field === "materiaId") {
					const mat = materiasPlan.find((m) => m.id === Number(value));
					return {
						...r,
						materiaId: Number(value),
						materiaNombre: mat?.nombre || "",
					};
				}
				return { ...r, [field]: value };
			}),
		);
	};

	const handleAddRow = () => {
		setRows((prev) => [
			...prev,
			{
				key: randomKey(),
				materiaId: 0,
				materiaNombre: "",
				nota: "7",
				isExisting: false,
			},
		]);
	};

	const handleRemoveRow = (key: string) => {
		setRows((prev) => prev.filter((r) => r.key !== key));
	};

	const handleSubmit = async () => {
		if (!numeroDisposicion.trim()) {
			enqueueSnackbar("Ingresa el número de disposición", {
				variant: "warning",
			});
			return;
		}
		if (rows.length === 0) {
			enqueueSnackbar("Debe mantener al menos una materia acreditada", {
				variant: "warning",
			});
			return;
		}
		for (const r of rows) {
			if (!r.materiaId) {
				enqueueSnackbar("Hay filas sin materia seleccionada", {
					variant: "warning",
				});
				return;
			}
			if (!r.nota.trim()) {
				enqueueSnackbar("Todas las materias deben tener nota", {
					variant: "warning",
				});
				return;
			}
		}

		setSubmitting(true);
		try {
			await modificarDisposicionEquivalencia(dispo.id, {
				numero_disposicion: numeroDisposicion.trim(),
				fecha_disposicion: fechaDisposicion,
				observaciones: observaciones.trim() || null,
				detalles: rows.map((r) => ({
					materia_id: r.materiaId,
					nota: r.nota.trim(),
				})),
			});
			enqueueSnackbar("Disposición modificada y sincronizada correctamente", {
				variant: "success",
			});
			onSuccess();
		} catch (e: any) {
			const msg =
				e?.response?.data?.message || "Error al modificar la disposición.";
			enqueueSnackbar(msg, { variant: "error" });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ bgcolor: INSTITUTIONAL_GREEN, color: "white" }}>
				Modificar Disposición de Equivalencia #{dispo.numero_disposicion}
			</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2.5} sx={{ mt: 1 }}>
					<Grid container spacing={2}>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Estudiante"
								value={`${dispo.estudiante_nombre} (DNI: ${dispo.estudiante_dni})`}
								disabled
								fullWidth
								size="small"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Profesorado / Plan"
								value={`${dispo.profesorado_nombre} (${dispo.plan_resolucion})`}
								disabled
								fullWidth
								size="small"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Nº de Disposición *"
								value={numeroDisposicion}
								onChange={(e) => setNumeroDisposicion(e.target.value)}
								fullWidth
								size="small"
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<TextField
								label="Fecha de Disposición *"
								type="date"
								value={fechaDisposicion}
								onChange={(e) => setFechaDisposicion(e.target.value)}
								fullWidth
								size="small"
								InputLabelProps={{ shrink: true }}
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								label="Observaciones"
								value={observaciones}
								onChange={(e) => setObservaciones(e.target.value)}
								fullWidth
								size="small"
								multiline
								rows={2}
							/>
						</Grid>
					</Grid>

					<Divider />

					<Box>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							sx={{ mb: 1.5 }}
						>
							<Typography variant="subtitle1" fontWeight={600}>
								Materias Acreditadas
							</Typography>
							<Button
								startIcon={<AddIcon />}
								size="small"
								variant="outlined"
								onClick={handleAddRow}
								disabled={loadingMaterias}
							>
								Agregar Materia
							</Button>
						</Stack>

						<Stack spacing={1.5}>
							{rows.map((row) => (
								<Stack
									key={row.key}
									direction={{ xs: "column", sm: "row" }}
									spacing={1.5}
									alignItems="center"
								>
									{row.isExisting ? (
										<TextField
											label="Materia"
											value={row.materiaNombre}
											disabled
											size="small"
											sx={{ flex: 1 }}
										/>
									) : (
										<Autocomplete
											options={materiasPlan}
											getOptionLabel={(o) =>
												`${o.anio ? `${o.anio}º - ` : ""}${o.nombre}`
											}
											value={
												materiasPlan.find((m) => m.id === row.materiaId) || null
											}
											onChange={(_, val) =>
												handleRowChange(row.key, "materiaId", val?.id || 0)
											}
											loading={loadingMaterias}
											sx={{ flex: 1 }}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Seleccionar Materia"
													size="small"
												/>
											)}
										/>
									)}
									<TextField
										label="Nota *"
										value={row.nota}
										onChange={(e) =>
											handleRowChange(row.key, "nota", e.target.value)
										}
										size="small"
										sx={{ width: { xs: "100%", sm: 110 } }}
									/>
									<IconButton
										color="error"
										size="small"
										onClick={() => handleRemoveRow(row.key)}
										title="Quitar materia"
									>
										<DeleteOutlineIcon />
									</IconButton>
								</Stack>
							))}
						</Stack>
					</Box>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={submitting}>
					Cancelar
				</Button>
				<Button
					onClick={handleSubmit}
					variant="contained"
					disabled={submitting}
				>
					{submitting ? "Guardando..." : "Guardar Cambios"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default HistorialEquivalenciasPage;
