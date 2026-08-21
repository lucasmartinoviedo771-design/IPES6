import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SchoolIcon from "@mui/icons-material/School";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import type React from "react";
import "dayjs/locale/es";
import type { EstudianteClaseListado } from "@/api/asistencia";
import type { Option } from "./types";

dayjs.locale("es");

interface EstudiantesPanelProps {
	puedeGestionarEstudiantes: boolean;
	puedeVerEstudiantes: boolean;
	profesoradoOptions: Option[];
	profesoradosLoading: boolean;
	estudianteProfesorado: Option | null;
	setEstudianteProfesorado: (v: Option | null) => void;
	estudiantePlan: Option | null;
	setEstudiantePlan: (v: Option | null) => void;
	estudianteMateria: Option | null;
	setEstudianteMateria: (v: Option | null) => void;
	estudianteComision: Option | null;
	setEstudianteComision: (v: Option | null) => void;
	estudianteDesde: string;
	setEstudianteDesde: (v: string) => void;
	estudianteHasta: string;
	setEstudianteHasta: (v: string) => void;
	estudianteResultados: EstudianteClaseListado[];
	cargandoEstudiantes: boolean;
	estudiantePlanOptions: Option[];
	estudiantePlanesLoading: boolean;
	estudianteMateriaOptions: Option[];
	estudianteMateriasLoading: boolean;
	estudianteComisionOptions: Option[];
	estudianteComisionesLoading: boolean;
	handleBuscarEstudiantes: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const EstudiantesPanel: React.FC<EstudiantesPanelProps> = ({
	puedeGestionarEstudiantes,
	puedeVerEstudiantes,
	profesoradoOptions,
	profesoradosLoading,
	estudianteProfesorado,
	setEstudianteProfesorado,
	estudiantePlan,
	setEstudiantePlan,
	estudianteMateria,
	setEstudianteMateria,
	estudianteComision,
	setEstudianteComision,
	estudianteDesde,
	setEstudianteDesde,
	estudianteHasta,
	setEstudianteHasta,
	estudianteResultados,
	cargandoEstudiantes,
	estudiantePlanOptions,
	estudiantePlanesLoading,
	estudianteMateriaOptions,
	estudianteMateriasLoading,
	estudianteComisionOptions,
	estudianteComisionesLoading,
	handleBuscarEstudiantes,
}) => {
	return (
		<Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
			<Stack spacing={3}>
				{/* Encabezado y Roles */}
				<Stack
					direction={{ xs: "column", sm: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", sm: "center" }}
					spacing={2}
				>
					<Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
						<Chip
							icon={<SchoolIcon />}
							label="Estudiantes"
							sx={{
								fontWeight: 700,
								bgcolor: "primary.main",
								color: "common.white",
								"& .MuiChip-icon": { color: "common.white !important" },
							}}
						/>
						<Chip
							icon={<ManageAccountsIcon />}
							label={
								puedeGestionarEstudiantes
									? "Gestión habilitada"
									: "Gestión restringida"
							}
							color={puedeGestionarEstudiantes ? "success" : "default"}
							variant={puedeGestionarEstudiantes ? "filled" : "outlined"}
							size="small"
						/>
						<Chip
							icon={<VisibilityIcon />}
							label={
								puedeVerEstudiantes ? "Vista habilitada" : "Vista restringida"
							}
							color={puedeVerEstudiantes ? "info" : "default"}
							variant={puedeVerEstudiantes ? "filled" : "outlined"}
							size="small"
						/>
					</Stack>

					{estudianteResultados.length > 0 && (
						<Chip
							label={`${estudianteResultados.length} clase(s) encontrada(s)`}
							color="primary"
							variant="outlined"
							size="small"
						/>
					)}
				</Stack>

				<Divider />

				{/* Formulario de Filtros */}
				<Box
					component="form"
					onSubmit={handleBuscarEstudiantes}
					sx={{
						bgcolor: (theme) =>
							theme.palette.mode === "dark" ? "grey.900" : "grey.50",
						p: 2.5,
						borderRadius: 2,
						border: "1px solid",
						borderColor: "divider",
					}}
				>
					<Stack spacing={2}>
						<Grid container spacing={2}>
							<Grid item xs={12} sm={6} md={3}>
								<Autocomplete
									options={profesoradoOptions}
									value={estudianteProfesorado}
									onChange={(_, value) => setEstudianteProfesorado(value)}
									loading={profesoradosLoading}
									disabled={cargandoEstudiantes || !puedeVerEstudiantes}
									size="small"
									renderInput={(params) => (
										<TextField
											{...params}
											label="Profesorado"
											placeholder="Seleccionar..."
											InputProps={{
												...params.InputProps,
												endAdornment: (
													<>
														{profesoradosLoading ? (
															<CircularProgress color="inherit" size={16} />
														) : null}
														{params.InputProps.endAdornment}
													</>
												),
											}}
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<Autocomplete
									options={estudiantePlanOptions}
									value={estudiantePlan}
									onChange={(_, value) => setEstudiantePlan(value)}
									loading={estudiantePlanesLoading}
									disabled={
										cargandoEstudiantes ||
										!puedeVerEstudiantes ||
										estudiantePlanOptions.length === 0 ||
										estudiantePlanesLoading
									}
									size="small"
									renderInput={(params) => (
										<TextField
											{...params}
											label="Plan de Estudio"
											placeholder="Seleccionar..."
											InputProps={{
												...params.InputProps,
												endAdornment: (
													<>
														{estudiantePlanesLoading ? (
															<CircularProgress color="inherit" size={16} />
														) : null}
														{params.InputProps.endAdornment}
													</>
												),
											}}
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<Autocomplete
									options={estudianteMateriaOptions}
									value={estudianteMateria}
									onChange={(_, value) => setEstudianteMateria(value)}
									loading={estudianteMateriasLoading}
									disabled={
										cargandoEstudiantes ||
										!puedeVerEstudiantes ||
										estudianteMateriaOptions.length === 0 ||
										estudianteMateriasLoading
									}
									size="small"
									renderInput={(params) => (
										<TextField
											{...params}
											label="Materia / Asignatura"
											placeholder="Seleccionar..."
											InputProps={{
												...params.InputProps,
												endAdornment: (
													<>
														{estudianteMateriasLoading ? (
															<CircularProgress color="inherit" size={16} />
														) : null}
														{params.InputProps.endAdornment}
													</>
												),
											}}
										/>
									)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<Autocomplete
									options={estudianteComisionOptions}
									value={estudianteComision}
									onChange={(_, value) => setEstudianteComision(value)}
									loading={estudianteComisionesLoading}
									disabled={
										cargandoEstudiantes ||
										!puedeVerEstudiantes ||
										estudianteComisionOptions.length === 0 ||
										estudianteComisionesLoading
									}
									size="small"
									renderInput={(params) => (
										<TextField
											{...params}
											label="Cátedra / Comisión"
											placeholder="Seleccionar..."
											InputProps={{
												...params.InputProps,
												endAdornment: (
													<>
														{estudianteComisionesLoading ? (
															<CircularProgress color="inherit" size={16} />
														) : null}
														{params.InputProps.endAdornment}
													</>
												),
											}}
										/>
									)}
								/>
							</Grid>
						</Grid>

						<Grid container spacing={2} alignItems="center">
							<Grid item xs={12} sm={4} md={3}>
								<TextField
									label="Fecha Desde"
									type="date"
									value={estudianteDesde}
									onChange={(event) => setEstudianteDesde(event.target.value)}
									disabled={cargandoEstudiantes || !puedeVerEstudiantes}
									fullWidth
									size="small"
									InputLabelProps={{ shrink: true }}
								/>
							</Grid>
							<Grid item xs={12} sm={4} md={3}>
								<TextField
									label="Fecha Hasta"
									type="date"
									value={estudianteHasta}
									onChange={(event) => setEstudianteHasta(event.target.value)}
									disabled={cargandoEstudiantes || !puedeVerEstudiantes}
									fullWidth
									size="small"
									InputLabelProps={{ shrink: true }}
								/>
							</Grid>
							<Grid item xs={12} sm={4} md={3}>
								<Button
									type="submit"
									variant="contained"
									color="primary"
									fullWidth
									disabled={cargandoEstudiantes || !puedeVerEstudiantes}
									sx={{ height: 40 }}
								>
									{cargandoEstudiantes ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										"Consultar Asistencia"
									)}
								</Button>
							</Grid>
						</Grid>
					</Stack>
				</Box>

				{/* Tabla de Resultados de Asistencia de Estudiantes */}
				{estudianteResultados.length === 0 ? (
					<Alert severity="info">
						Configurá los filtros y presioná &ldquo;Consultar Asistencia&rdquo; para ver las clases y estadísticas.
					</Alert>
				) : (
					<TableContainer
						component={Paper}
						variant="outlined"
						sx={{ borderRadius: 2, overflow: "hidden" }}
					>
						<Table size="medium">
							<TableHead sx={{ bgcolor: "action.hover" }}>
								<TableRow>
									<TableCell sx={{ fontWeight: 700 }}>Fecha y Día</TableCell>
									<TableCell sx={{ fontWeight: 700 }}>Materia / Asignatura</TableCell>
									<TableCell sx={{ fontWeight: 700 }}>Cátedra (Comisión)</TableCell>
									<TableCell sx={{ fontWeight: 700 }}>Turno y Horario</TableCell>
									<TableCell sx={{ fontWeight: 700 }} align="center">Presentes</TableCell>
									<TableCell sx={{ fontWeight: 700 }} align="center">Ausentes</TableCell>
									<TableCell sx={{ fontWeight: 700 }} align="center">Justificados</TableCell>
									<TableCell sx={{ fontWeight: 700 }} align="center">Total Alumnos</TableCell>
									<TableCell sx={{ fontWeight: 700 }} align="center">Estado Clase</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{estudianteResultados.map((item) => {
									const fechaParsed = dayjs(item.fecha, ["YYYY-MM-DD", "DD/MM/YYYY"]);
									const diaNombre = fechaParsed.isValid()
										? fechaParsed.format("dddd DD/MM/YYYY")
										: item.fecha;

									const pctPresentes =
										item.total_estudiantes > 0
											? Math.round((item.presentes / item.total_estudiantes) * 100)
											: 0;

									return (
										<TableRow key={item.clase_id} hover>
											<TableCell>
												<Typography variant="body2" fontWeight={600} textTransform="capitalize">
													{diaNombre}
												</Typography>
											</TableCell>
											<TableCell>
												<Typography variant="body2" fontWeight={600}>
													{item.materia}
												</Typography>
											</TableCell>
											<TableCell>
												<Typography variant="body2" color="text.secondary">
													{item.comision}
												</Typography>
											</TableCell>
											<TableCell>
												<Typography variant="body2">
													{item.horario ?? "Sin horario"}
												</Typography>
												<Typography variant="caption" color="text.secondary">
													Turno: {item.turno ?? "-"}
												</Typography>
											</TableCell>
											<TableCell align="center">
												<Chip
													size="small"
													label={`${item.presentes} (${pctPresentes}%)`}
													color="success"
													variant="filled"
													sx={{ fontWeight: 700 }}
												/>
											</TableCell>
											<TableCell align="center">
												<Typography variant="body2" color="error.main" fontWeight={600}>
													{item.ausentes}
												</Typography>
											</TableCell>
											<TableCell align="center">
												<Typography variant="body2" color="warning.main" fontWeight={600}>
													{item.ausentes_justificados}
												</Typography>
											</TableCell>
											<TableCell align="center">
												<Typography variant="body2" fontWeight={700}>
													{item.total_estudiantes}
												</Typography>
											</TableCell>
											<TableCell align="center">
												<Chip
													size="small"
													label={item.estado_clase}
													variant="outlined"
												/>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</TableContainer>
				)}

				{!puedeVerEstudiantes && (
					<Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
						<WarningAmberIcon fontSize="small" />
						<Typography variant="caption">
							Tu rol no tiene acceso a este módulo. Contacta a Secretaría para habilitarlo.
						</Typography>
					</Stack>
				)}
			</Stack>
		</Paper>
	);
};

export default EstudiantesPanel;
