import type { SelectChangeEvent } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listarPlanes, type PlanDTO } from "@/api/cargaNotas";
import { type Carrera, fetchCarreras } from "@/api/carreras";
import { listarMaterias, type MateriaDTO } from "@/api/comisiones";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import { hasCapability, isOnlyEstudiante } from "@/utils/roles";

const SELECTION_STORAGE_KEY = "carreras.selection";

const regimenLabel: Record<string, string> = {
	ANU: "Anual",
	PCU: "1.º Cuatrimestre",
	SCU: "2.º Cuatrimestre",
};

const formatoLabel: Record<string, string> = {
	ASI: "Asignatura",
	PRA: "Práctica",
	MOD: "Módulo",
	TAL: "Taller",
	LAB: "Laboratorio",
	SEM: "Seminario",
};

const tipoFormacionLabel: Record<string, string> = {
	FGN: "Formación general",
	FES: "Formación específica",
	PDC: "Práctica docente",
};

type MateriasTableProps = {
	materias: MateriaDTO[];
	loading: boolean;
	onVerInscriptos: (materia: MateriaDTO) => void;
};

import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";

const MateriasTable: React.FC<MateriasTableProps> = ({
	materias,
	loading,
	onVerInscriptos,
}) => {
	type MateriaSortKey =
		| "anio"
		| "nombre"
		| "cuatrimestre"
		| "formato"
		| "tipo_formacion";
	const [orderBy, setOrderBy] = useState<MateriaSortKey>("anio");
	const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc");

	// Filtros
	const [filtroNombre, setFiltroNombre] = useState<string>("");
	const [filtroCuatrimestre, setFiltroCuatrimestre] = useState<string>("");
	const [filtroFormato, setFiltroFormato] = useState<string>("");
	const [filtroTipoFormacion, setFiltroTipoFormacion] = useState<string>("");
	const [filtroAnio, setFiltroAnio] = useState<string>("");

	const hayFiltrosActivos =
		filtroNombre !== "" ||
		filtroCuatrimestre !== "" ||
		filtroFormato !== "" ||
		filtroTipoFormacion !== "" ||
		filtroAnio !== "";

	const limpiarFiltros = () => {
		setFiltroNombre("");
		setFiltroCuatrimestre("");
		setFiltroFormato("");
		setFiltroTipoFormacion("");
		setFiltroAnio("");
	};

	const filteredMaterias = useMemo(() => {
		return materias.filter((m) => {
			if (
				filtroNombre &&
				!m.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
			) {
				return false;
			}
			if (filtroAnio && String(m.anio_cursada) !== filtroAnio) {
				return false;
			}
			if (filtroCuatrimestre && m.regimen !== filtroCuatrimestre) {
				return false;
			}
			if (filtroFormato && m.formato !== filtroFormato) {
				return false;
			}
			if (filtroTipoFormacion && m.tipo_formacion !== filtroTipoFormacion) {
				return false;
			}
			return true;
		});
	}, [
		materias,
		filtroNombre,
		filtroAnio,
		filtroCuatrimestre,
		filtroFormato,
		filtroTipoFormacion,
	]);

	const sortedMaterias = useMemo(() => {
		const copy = [...filteredMaterias];
		copy.sort((a, b) => {
			const getValue = (m: MateriaDTO): string | number => {
				switch (orderBy) {
					case "anio":
						return m.anio_cursada ?? 0;
					case "nombre":
						return m.nombre || "";
					case "cuatrimestre":
						return regimenLabel[m.regimen] ?? m.regimen ?? "";
					case "formato":
						return formatoLabel[m.formato] ?? m.formato ?? "";
					case "tipo_formacion":
						return (
							tipoFormacionLabel[m.tipo_formacion] ?? m.tipo_formacion ?? ""
						);
					default:
						return "";
				}
			};
			const va = getValue(a);
			const vb = getValue(b);
			if (typeof va === "number" && typeof vb === "number") {
				return orderDirection === "asc" ? va - vb : vb - va;
			}
			const sa = String(va).toLowerCase();
			const sb = String(vb).toLowerCase();
			if (sa === sb) return 0;
			const comp = sa > sb ? 1 : -1;
			return orderDirection === "asc" ? comp : -comp;
		});
		return copy;
	}, [filteredMaterias, orderBy, orderDirection]);

	const handleSort = (column: MateriaSortKey) => {
		setOrderBy(column);
		setOrderDirection((prev) =>
			orderBy === column ? (prev === "asc" ? "desc" : "asc") : "asc",
		);
	};

	if (loading) {
		return (
			<Box>
				<Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
				<Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
				<Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
			</Box>
		);
	}

	if (!materias.length) {
		return (
			<Alert severity="info" sx={{ mt: 1 }}>
				No encontramos materias para el plan seleccionado.
			</Alert>
		);
	}

	return (
		<Stack spacing={2}>
			{/* Barra de Filtros */}
			<Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
				<Grid container spacing={1.5} alignItems="center">
					<Grid item xs={12} sm={6} md={3}>
						<TextField
							size="small"
							fullWidth
							placeholder="Buscar por nombre..."
							label="Nombre"
							value={filtroNombre}
							onChange={(e) => setFiltroNombre(e.target.value)}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" color="action" />
									</InputAdornment>
								),
							}}
						/>
					</Grid>
					<Grid item xs={6} sm={3} md={2}>
						<FormControl fullWidth size="small">
							<InputLabel id="filtro-anio-label">Año</InputLabel>
							<Select
								labelId="filtro-anio-label"
								label="Año"
								value={filtroAnio}
								onChange={(e) => setFiltroAnio(e.target.value)}
							>
								<MenuItem value="">Todos</MenuItem>
								<MenuItem value="1">1.º Año</MenuItem>
								<MenuItem value="2">2.º Año</MenuItem>
								<MenuItem value="3">3.º Año</MenuItem>
								<MenuItem value="4">4.º Año</MenuItem>
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={6} sm={3} md={2.5}>
						<FormControl fullWidth size="small">
							<InputLabel id="filtro-cuatrimestre-label">Cuatrimestre</InputLabel>
							<Select
								labelId="filtro-cuatrimestre-label"
								label="Cuatrimestre"
								value={filtroCuatrimestre}
								onChange={(e) => setFiltroCuatrimestre(e.target.value)}
							>
								<MenuItem value="">Todos</MenuItem>
								{Object.entries(regimenLabel).map(([key, label]) => (
									<MenuItem key={key} value={key}>
										{label}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={6} sm={3} md={2}>
						<FormControl fullWidth size="small">
							<InputLabel id="filtro-formato-label">Formato</InputLabel>
							<Select
								labelId="filtro-formato-label"
								label="Formato"
								value={filtroFormato}
								onChange={(e) => setFiltroFormato(e.target.value)}
							>
								<MenuItem value="">Todos</MenuItem>
								{Object.entries(formatoLabel).map(([key, label]) => (
									<MenuItem key={key} value={key}>
										{label}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={6} sm={3} md={2.5}>
						<FormControl fullWidth size="small">
							<InputLabel id="filtro-tipo-label">Tipo Formación</InputLabel>
							<Select
								labelId="filtro-tipo-label"
								label="Tipo Formación"
								value={filtroTipoFormacion}
								onChange={(e) => setFiltroTipoFormacion(e.target.value)}
							>
								<MenuItem value="">Todos</MenuItem>
								{Object.entries(tipoFormacionLabel).map(([key, label]) => (
									<MenuItem key={key} value={key}>
										{label}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
				</Grid>

				{hayFiltrosActivos && (
					<Box
						display="flex"
						justifyContent="space-between"
						alignItems="center"
						mt={1.5}
						pt={1}
						borderTop="1px dashed"
						borderColor="divider"
					>
						<Typography variant="caption" color="text.secondary">
							Mostrando <b>{filteredMaterias.length}</b> de <b>{materias.length}</b> materias
						</Typography>
						<Button
							size="small"
							variant="text"
							color="inherit"
							startIcon={<FilterAltOffIcon fontSize="small" />}
							onClick={limpiarFiltros}
							sx={{ textTransform: "none" }}
						>
							Limpiar filtros
						</Button>
					</Box>
				)}
			</Paper>

			{filteredMaterias.length === 0 ? (
				<Alert severity="warning" sx={{ mt: 1 }}>
					No se encontraron materias que coincidan con los filtros aplicados.
				</Alert>
			) : (
				<TableContainer component={Paper} variant="outlined">
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell
									sortDirection={orderBy === "anio" ? orderDirection : false}
								>
									<TableSortLabel
										active={orderBy === "anio"}
										direction={orderBy === "anio" ? orderDirection : "asc"}
										onClick={() => handleSort("anio")}
									>
										Año
									</TableSortLabel>
								</TableCell>
								<TableCell
									sortDirection={orderBy === "nombre" ? orderDirection : false}
								>
									<TableSortLabel
										active={orderBy === "nombre"}
										direction={orderBy === "nombre" ? orderDirection : "asc"}
										onClick={() => handleSort("nombre")}
									>
										Materia
									</TableSortLabel>
								</TableCell>
								<TableCell
									sortDirection={
										orderBy === "cuatrimestre" ? orderDirection : false
									}
								>
									<TableSortLabel
										active={orderBy === "cuatrimestre"}
										direction={orderBy === "cuatrimestre" ? orderDirection : "asc"}
										onClick={() => handleSort("cuatrimestre")}
									>
										Cuatrimestre
									</TableSortLabel>
								</TableCell>
								<TableCell
									sortDirection={orderBy === "formato" ? orderDirection : false}
								>
									<TableSortLabel
										active={orderBy === "formato"}
										direction={orderBy === "formato" ? orderDirection : "asc"}
										onClick={() => handleSort("formato")}
									>
										Formato
									</TableSortLabel>
								</TableCell>
								<TableCell
									sortDirection={
										orderBy === "tipo_formacion" ? orderDirection : false
									}
								>
									<TableSortLabel
										active={orderBy === "tipo_formacion"}
										direction={
											orderBy === "tipo_formacion" ? orderDirection : "asc"
										}
										onClick={() => handleSort("tipo_formacion")}
									>
										Tipo de formación
									</TableSortLabel>
								</TableCell>
								<TableCell align="right">Inscriptos</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{sortedMaterias.map((materia) => (
								<TableRow key={materia.id} hover>
									<TableCell>{materia.anio_cursada ?? "-"}</TableCell>
									<TableCell>{materia.nombre}</TableCell>
									<TableCell>
										{regimenLabel[materia.regimen] ?? materia.regimen}
									</TableCell>
									<TableCell>
										{formatoLabel[materia.formato] ?? materia.formato}
									</TableCell>
									<TableCell>
										{tipoFormacionLabel[materia.tipo_formacion] ??
											materia.tipo_formacion}
									</TableCell>
									<TableCell align="right">
										<Button
											size="small"
											variant="outlined"
											onClick={(event) => {
												event.stopPropagation();
												onVerInscriptos(materia);
											}}
										>
											Ver inscriptos
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</Stack>
	);
};

export default function CarrerasPage() {
	const { user } = useAuth();
	const navigate = useNavigate();

	const soloEstudiante = isOnlyEstudiante(user);
	const puedeGestionarCarreras = hasCapability(user, "ver_estructura");

	const [profesoradoId, setProfesoradoId] = useState<number | "">("");
	const [planId, setPlanId] = useState<number | "">("");

	const {
		data: carrerasData,
		isLoading: carrerasLoading,
		isError: carrerasIsError,
	} = useQuery({
		queryKey: ["carreras", "listado"],
		queryFn: fetchCarreras,
		enabled: puedeGestionarCarreras,
	});

	const {
		data: planesQueryData,
		isLoading: planesIsLoading,
		isError: planesIsError,
	} = useQuery({
		queryKey: ["carreras", "planes", profesoradoId],
		queryFn: () => listarPlanes(Number(profesoradoId)),
		enabled: puedeGestionarCarreras && typeof profesoradoId === "number",
	});

	const {
		data: materiasQueryData,
		isLoading: materiasIsLoading,
		isError: materiasIsError,
	} = useQuery({
		queryKey: ["carreras", "materias", planId],
		queryFn: () => listarMaterias(Number(planId)),
		enabled: puedeGestionarCarreras && typeof planId === "number",
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		// IMPORTANTE: Solo guardar si tenemos una selección real para evitar que el estado inicial
		// vacío pise lo que ya estaba guardado en el sessionStorage al volver atrás.
		if (profesoradoId !== "") {
			const payload = {
				profesoradoId: typeof profesoradoId === "number" ? profesoradoId : null,
				planId: typeof planId === "number" ? planId : null,
			};
			window.sessionStorage.setItem(
				SELECTION_STORAGE_KEY,
				JSON.stringify(payload),
			);
		}
	}, [profesoradoId, planId]);

	useEffect(() => {
		if (carrerasData) {
			const stored = (() => {
				try {
					const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY);
					if (!raw) return null;
					const parsed = JSON.parse(raw);
					return parsed?.profesoradoId ?? null;
				} catch {
					return null;
				}
			})();

			if (stored && carrerasData.some((c) => c.id === stored)) {
				setProfesoradoId(stored);
			} else if (carrerasData.length > 0) {
				setProfesoradoId(carrerasData[0].id);
			}
		}
	}, [carrerasData]);

	useEffect(() => {
		if (planesQueryData) {
			const stored = (() => {
				try {
					const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY);
					if (!raw) return null;
					const parsed = JSON.parse(raw);
					return parsed?.planId ?? null;
				} catch {
					return null;
				}
			})();

			if (stored && planesQueryData.some((p) => p.id === stored)) {
				setPlanId(stored);
			} else if (planesQueryData.length > 0) {
				setPlanId(planesQueryData[0].id);
			} else {
				setPlanId("");
			}
		}
	}, [planesQueryData]);

	const carreraSeleccionada: Carrera | undefined = useMemo(() => {
		if (!carrerasData) return undefined;
		return carrerasData.find((carrera) => carrera.id === profesoradoId);
	}, [carrerasData, profesoradoId]);

	const planesData = planesQueryData ?? [];  
	const planSeleccionado: PlanDTO | undefined = useMemo(() => {
		if (typeof planId !== "number") return undefined;
		return planesData.find((plan) => plan.id === planId);
	}, [planesData, planId]);

	if (soloEstudiante) {
		return (
			<Box sx={{ p: 4, maxWidth: 640, margin: "0 auto" }}>
				<Paper variant="outlined" sx={{ p: 3 }}>
					<PageHero
						title="Gestioná tus materias"
						subtitle="La información detallada de carreras está disponible para personal administrativo. Podés inscribirte o revisar tus materias desde el Portal de Estudiantes."
						sx={{ width: "100%", boxShadow: "none", borderRadius: 3 }}
					/>
					<Stack
						direction={{ xs: "column", sm: "row" }}
						spacing={2}
						justifyContent="flex-start"
					>
						<Button
							variant="contained"
							onClick={() => navigate("/estudiantes/inscripcion-materia")}
						>
							Ir a Inscripción de Materias
						</Button>
						<Button variant="outlined" onClick={() => navigate("/estudiantes")}>
							Volver al portal de estudiantes
						</Button>
					</Stack>
				</Paper>
			</Box>
		);
	}

	if (!puedeGestionarCarreras) {
		return (
			<Box sx={{ p: 4 }}>
				<Alert severity="warning">
					Tu cuenta no cuenta con permisos para gestionar la información de
					carreras.
				</Alert>
			</Box>
		);
	}

	const planes = planesData;
	const materias = materiasQueryData ?? [];

	const handleVerInscriptos = (materia: MateriaDTO) => {
		if (typeof planId !== "number" || typeof profesoradoId !== "number") {
			return;
		}
		navigate(
			`/carreras/${profesoradoId}/planes/${planId}/materias/${materia.id}/inscriptos`,
			{
				state: {
					materiaNombre: materia.nombre,
					planResolucion: planSeleccionado?.resolucion ?? null,
					profesoradoNombre: carreraSeleccionada?.nombre ?? null,
				},
			},
		);
	};

	return (
		<Box sx={{ p: 3, bgcolor: "#ffffff", minHeight: "100vh" }}>
			<Stack spacing={3} maxWidth={1200} mx="auto">
				<PageHero
					title="Gestión de carreras"
					subtitle="Visualizá profesorados, planes vigentes y sus materias asociadas."
				/>

				<Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
					<Grid container spacing={2}>
						<Grid item xs={12} md={6}>
							<FormControl fullWidth size="small">
								<InputLabel id="select-profesorado">Profesorado</InputLabel>
								<Select
									labelId="select-profesorado"
									label="Profesorado"
									value={profesoradoId === "" ? "" : String(profesoradoId)}
									onChange={(event: SelectChangeEvent) => {
										const value = event.target.value;
										setProfesoradoId(value ? Number(value) : "");
										setPlanId("");
									}}
									disabled={carrerasLoading}
								>
									{carrerasData?.map((carrera) => (
										<MenuItem key={carrera.id} value={String(carrera.id)}>
											{carrera.nombre}
										</MenuItem>
									))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12} md={6} display="flex" alignItems="center">
							{carrerasLoading && (
								<Skeleton variant="rounded" width="100%" height={36} />
							)}
							{!carrerasLoading && carreraSeleccionada && (
								<Stack direction="row" spacing={1}>
									<Chip
										label={
											carreraSeleccionada.activo
												? "Carrera activa"
												: "Carrera inactiva"
										}
										color={carreraSeleccionada.activo ? "success" : "default"}
									/>
									<Chip
										label={
											carreraSeleccionada.inscripcion_abierta
												? "Inscripción abierta"
												: "Inscripción cerrada"
										}
										color={
											carreraSeleccionada.inscripcion_abierta
												? "primary"
												: "default"
										}
									/>
								</Stack>
							)}
						</Grid>
					</Grid>
				</Paper>

				<Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
					<SectionTitlePill title="Planes de estudio" />
					{planesIsLoading ? (
						<Skeleton variant="rounded" height={120} />
					) : planes.length === 0 ? (
						<Alert severity="info">
							Este profesorado aún no tiene planes de estudio registrados.
						</Alert>
					) : (
						<Grid container spacing={2}>
							<Grid item xs={12} md={6}>
								<FormControl fullWidth size="small">
									<InputLabel id="select-plan">Plan</InputLabel>
									<Select
										labelId="select-plan"
										label="Plan"
										value={planId === "" ? "" : String(planId)}
										onChange={(event: SelectChangeEvent) => {
											const value = event.target.value;
											setPlanId(value ? Number(value) : "");
										}}
									>
										{planes.map((plan) => (
											<MenuItem key={plan.id} value={String(plan.id)}>
												{plan.resolucion || `Plan ${plan.id}`}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Grid>
							<Grid item xs={12} md={6} display="flex" alignItems="center">
								{typeof planId === "number" && (
									<Typography variant="body2" color="text.secondary">
										Visualizando materias del plan seleccionado.
									</Typography>
								)}
							</Grid>
						</Grid>
					)}
				</Paper>

				<Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
					<SectionTitlePill title="Materias del plan" />
					{typeof planId !== "number" && (
						<Alert severity="info">
							Seleccioná un plan para ver sus materias.
						</Alert>
					)}
					{typeof planId === "number" && (
						<MateriasTable
							materias={materias}
							loading={materiasIsLoading}
							onVerInscriptos={handleVerInscriptos}
						/>
					)}
				</Paper>

				{carrerasIsError && (
					<Alert severity="error">
						No pudimos cargar el listado de profesorados. Intentá nuevamente más
						tarde.
					</Alert>
				)}
				{planesIsError && (
					<Alert severity="error">
						Ocurrió un problema al obtener los planes de estudio del profesorado
						seleccionado.
					</Alert>
				)}
				{materiasIsError && (
					<Alert severity="error">
						No fue posible cargar las materias del plan seleccionado.
					</Alert>
				)}
			</Stack>
		</Box>
	);
}
