import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import GroupsIcon from "@mui/icons-material/Groups";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
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
import type { DocenteClase, DocenteClasesResponse } from "@/api/asistencia";
import React, { useMemo, useState } from "react";
import "dayjs/locale/es";
import type { DateOption, Option } from "./types";
import { DocentesPorFechaPanel } from "./DocentesPorFechaPanel";

dayjs.locale("es");

interface DocentesPanelProps {
	puedeGestionarDocentes: boolean;
	puedeVerDocentes: boolean;
	esDocenteSolo: boolean;
	docenteDni: string;
	setDocenteDni: (v: string) => void;
	docenteDesde: string;
	setDocenteDesde: (v: string) => void;
	docenteHasta: string;
	setDocenteHasta: (v: string) => void;
	docenteDiaSemana: string;
	setDocenteDiaSemana: (v: string) => void;
	docenteClases: DocenteClase[];
	docenteInfo: DocenteClasesResponse["docente"] | null;
	cargandoDocente: boolean;
	docenteProfesorado: Option | null;
	setDocenteProfesorado: (v: Option | null) => void;
	docentePlan: Option | null;
	setDocentePlan: (v: Option | null) => void;
	docenteMateria: Option | null;
	setDocenteMateria: (v: Option | null) => void;
	docenteComision: Option | null;
	setDocenteComision: (v: Option | null) => void;
	docenteFecha: DateOption | null;
	setDocenteFecha: (v: DateOption | null) => void;
	docenteProfesOptions: Option[];
	docentePlanOptions: Option[];
	docenteMateriaOptions: Option[];
	docenteComisionOptions: Option[];
	docenteFechaOptions: DateOption[];
	docenteClasesFiltradas: DocenteClase[];
	handleBuscarDocente: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const DocentesPanel: React.FC<DocentesPanelProps> = ({
	puedeGestionarDocentes,
	puedeVerDocentes,
	esDocenteSolo,
	docenteDni,
	setDocenteDni,
	docenteDesde,
	setDocenteDesde,
	docenteHasta,
	setDocenteHasta,
	docenteDiaSemana,
	setDocenteDiaSemana,
	docenteClases,
	docenteInfo,
	cargandoDocente,
	docenteProfesorado,
	setDocenteProfesorado,
	docentePlan,
	setDocentePlan,
	docenteMateria,
	setDocenteMateria,
	docenteComision,
	setDocenteComision,
	docenteFecha,
	setDocenteFecha,
	docenteProfesOptions,
	docentePlanOptions,
	docenteMateriaOptions,
	docenteComisionOptions,
	docenteFechaOptions,
	docenteClasesFiltradas,
	handleBuscarDocente,
}) => {
	const [subVista, setSubVista] = useState<"docente" | "diaria">("docente");

	// Agrupar clases por Materia/Cargo + Comision + Fecha + Turno
	const grupos = useMemo(() => {
		const gruposMap = new Map<
			string,
			{
				id: string;
				materia: string;
				comision: string;
				fecha: string;
				turno: string;
				profesorado_nombre: string | null;
				plan_resolucion: string | null;
				bloquesCount: number;
				ya_registrada: boolean;
				registrada_en: string | null;
				hora_inicio_min: string | null;
				hora_fin_max: string | null;
				puede_marcar: boolean;
				editable_staff: boolean;
				es_cargo: boolean;
			}
		>();

		docenteClasesFiltradas.forEach((clase) => {
			const key = `${clase.fecha}_${clase.comision_id || clase.materia_id || clase.materia}_${clase.turno}`;
			const existente = gruposMap.get(key);

			let hIni: string | null = null;
			let hFin: string | null = null;
			if (clase.horario) {
				const parts = clase.horario.split(/\s*(?:a|-)\s*/);
				if (parts.length >= 2) {
					hIni = parts[0]?.trim() || null;
					hFin = parts[1]?.trim() || null;
				}
			}

			if (!existente) {
				gruposMap.set(key, {
					id: key,
					materia: clase.materia,
					comision: clase.comision,
					fecha: clase.fecha,
					turno: clase.turno || "-",
					profesorado_nombre: clase.profesorado_nombre ?? "-",
					plan_resolucion: clase.plan_resolucion ?? "-",
					bloquesCount: 1,
					ya_registrada: clase.ya_registrada,
					registrada_en: clase.registrada_en,
					hora_inicio_min: hIni,
					hora_fin_max: hFin,
					puede_marcar: clase.puede_marcar,
					editable_staff: clase.editable_staff,
					es_cargo:
						!!clase.es_cargo ||
						Boolean(clase.comision && clase.comision.startsWith("CARG-")),
				});
			} else {
				existente.bloquesCount += 1;
				if (clase.ya_registrada) {
					existente.ya_registrada = true;
					if (clase.registrada_en) {
						existente.registrada_en = clase.registrada_en;
					}
				}
				if (hIni && (!existente.hora_inicio_min || hIni < existente.hora_inicio_min)) {
					existente.hora_inicio_min = hIni;
				}
				if (hFin && (!existente.hora_fin_max || hFin > existente.hora_fin_max)) {
					existente.hora_fin_max = hFin;
				}
				if (clase.puede_marcar) existente.puede_marcar = true;
				if (clase.editable_staff) existente.editable_staff = true;
			}
		});

		return Array.from(gruposMap.values());
	}, [docenteClasesFiltradas]);

	return (
		<Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
			<Stack spacing={3}>
				{/* Encabezado y Selector de Sub-vista */}
				<Stack
					direction={{ xs: "column", sm: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", sm: "center" }}
					spacing={2}
				>
					<Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
						<Chip
							icon={<GroupsIcon />}
							label="Docentes"
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
								puedeGestionarDocentes
									? "Gestión habilitada"
									: "Gestión restringida"
							}
							color={puedeGestionarDocentes ? "success" : "default"}
							variant={puedeGestionarDocentes ? "filled" : "outlined"}
							size="small"
						/>
						<Chip
							icon={<VisibilityIcon />}
							label={puedeVerDocentes ? "Vista habilitada" : "Vista restringida"}
							color={puedeVerDocentes ? "info" : "default"}
							variant={puedeVerDocentes ? "filled" : "outlined"}
							size="small"
						/>
					</Stack>

					<Stack direction="row" spacing={1}>
						<Button
							variant={subVista === "docente" ? "contained" : "outlined"}
							size="small"
							onClick={() => setSubVista("docente")}
						>
							Búsqueda por Docente
						</Button>
						<Button
							variant={subVista === "diaria" ? "contained" : "outlined"}
							size="small"
							onClick={() => setSubVista("diaria")}
						>
							Vista General Diaria
						</Button>
					</Stack>
				</Stack>

				<Divider />

				{subVista === "diaria" ? (
					<DocentesPorFechaPanel />
				) : (
					<Stack spacing={3}>
						{/* Formulario de Búsqueda Principal */}
						<Box
							component="form"
							onSubmit={handleBuscarDocente}
							sx={{
								bgcolor: (theme) =>
									theme.palette.mode === "dark" ? "grey.900" : "grey.50",
								p: 2.5,
								borderRadius: 2,
								border: "1px solid",
								borderColor: "divider",
							}}
						>
							<Grid container spacing={2} alignItems="center">
								<Grid item xs={12} sm={4} md={3}>
									<TextField
										label="DNI del docente"
										value={docenteDni}
										onChange={(event) => setDocenteDni(event.target.value)}
										placeholder="Ej: 28126358"
										disabled={cargandoDocente || !puedeVerDocentes || esDocenteSolo}
										fullWidth
										size="small"
									/>
								</Grid>
								<Grid item xs={12} sm={4} md={3}>
									<TextField
										label="Fecha Desde"
										type="date"
										value={docenteDesde}
										onChange={(event) => setDocenteDesde(event.target.value)}
										disabled={cargandoDocente || !puedeVerDocentes}
										fullWidth
										size="small"
										InputLabelProps={{ shrink: true }}
									/>
								</Grid>
								<Grid item xs={12} sm={4} md={3}>
									<TextField
										label="Fecha Hasta"
										type="date"
										value={docenteHasta}
										onChange={(event) => setDocenteHasta(event.target.value)}
										disabled={cargandoDocente || !puedeVerDocentes}
										fullWidth
										size="small"
										InputLabelProps={{ shrink: true }}
									/>
								</Grid>
								<Grid item xs={12} sm={12} md={3}>
									<Button
										type="submit"
										variant="contained"
										color="primary"
										fullWidth
										disabled={cargandoDocente || !puedeVerDocentes}
										sx={{ height: 40 }}
									>
										{cargandoDocente ? (
											<CircularProgress size={20} color="inherit" />
										) : (
											"Consultar Clases y Cargos"
										)}
									</Button>
								</Grid>
							</Grid>
						</Box>

						{/* Información del Docente Seleccionado y Filtros de Refinamiento */}
						{!!docenteInfo && (
							<Paper
								variant="outlined"
								sx={{
									p: 2,
									bgcolor: (theme) =>
										theme.palette.mode === "dark" ? "background.paper" : "#f8fafc",
								}}
							>
								<Stack spacing={2}>
									<Stack
										direction={{ xs: "column", sm: "row" }}
										justifyContent="space-between"
										alignItems={{ xs: "flex-start", sm: "center" }}
									>
										<Typography variant="subtitle1" fontWeight={700}>
											Docente: {docenteInfo.nombre} — DNI: {docenteInfo.dni}
										</Typography>
										<Chip
											size="small"
											label={`${grupos.length} registro(s) encontrado(s)`}
											color="primary"
											variant="outlined"
										/>
									</Stack>

									{docenteClases.length > 0 && (
										<Grid container spacing={1.5}>
											<Grid item xs={12} sm={6} md={3}>
												<Autocomplete
													options={docenteProfesOptions}
													value={docenteProfesorado}
													onChange={(_, value) => setDocenteProfesorado(value)}
													disabled={docenteProfesOptions.length === 0}
													size="small"
													renderInput={(params) => (
														<TextField
															{...params}
															label="Filtrar por Profesorado"
															placeholder="Todos"
														/>
													)}
												/>
											</Grid>
											<Grid item xs={12} sm={6} md={3}>
												<Autocomplete
													options={docenteMateriaOptions}
													value={docenteMateria}
													onChange={(_, value) => setDocenteMateria(value)}
													disabled={docenteMateriaOptions.length === 0}
													size="small"
													renderInput={(params) => (
														<TextField
															{...params}
															label="Filtrar por Asignatura / Cargo"
															placeholder="Todas"
														/>
													)}
												/>
											</Grid>
											<Grid item xs={12} sm={6} md={3}>
												<Autocomplete
													options={docenteComisionOptions}
													value={docenteComision}
													onChange={(_, value) => setDocenteComision(value)}
													disabled={docenteComisionOptions.length === 0}
													size="small"
													renderInput={(params) => (
														<TextField
															{...params}
															label="Filtrar por Comisión"
															placeholder="Todas"
														/>
													)}
												/>
											</Grid>
											<Grid item xs={12} sm={6} md={3}>
												<Autocomplete
													options={docenteFechaOptions}
													value={docenteFecha}
													onChange={(_, value) => setDocenteFecha(value)}
													disabled={docenteFechaOptions.length === 0}
													size="small"
													renderInput={(params) => (
														<TextField
															{...params}
															label="Filtrar por Fecha"
															placeholder="Todas"
														/>
													)}
												/>
											</Grid>
										</Grid>
									)}
								</Stack>
							</Paper>
						)}

						{/* Tabla de Resultados Completa y Clara */}
						{grupos.length === 0 ? (
							<Alert severity="info">
								{docenteInfo
									? "No se encontraron clases ni cargos programados con los filtros seleccionados."
									: "Ingresá un DNI y rango de fechas para ver el detalle de asistencia docente."}
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
											<TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Asignatura / Cargo</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Comisión / Código</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Horario y Turno</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Profesorado / Plan</TableCell>
											<TableCell sx={{ fontWeight: 700 }} align="center">
												Estado de Asistencia
											</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{grupos.map((grupo) => {
											const rangoHorario =
												grupo.hora_inicio_min && grupo.hora_fin_max
													? `${grupo.hora_inicio_min} a ${grupo.hora_fin_max}`
													: "Horario asignado";

											const fechaParsed = dayjs(grupo.fecha, ["YYYY-MM-DD", "DD/MM/YYYY"]);
											const diaNombre = fechaParsed.isValid()
												? fechaParsed.format("dddd DD/MM/YYYY")
												: grupo.fecha;

											return (
												<TableRow
													key={grupo.id}
													hover
													sx={{
														"&:last-child td, &:last-child th": { border: 0 },
														bgcolor: grupo.es_cargo ? "rgba(255, 247, 237, 0.5)" : "inherit",
													}}
												>
													<TableCell>
														<Typography variant="body2" fontWeight={600} textTransform="capitalize">
															{diaNombre}
														</Typography>
													</TableCell>

													<TableCell>
														{grupo.es_cargo ? (
															<Chip
																icon={<WorkOutlineIcon style={{ fontSize: 16 }} />}
																size="small"
																label="CARGO"
																sx={{
																	bgcolor: "#ea580c",
																	color: "#fff",
																	fontWeight: 700,
																	fontSize: "0.72rem",
																}}
															/>
														) : (
															<Chip
																size="small"
																label="CÁTEDRA"
																color="primary"
																variant="outlined"
																sx={{ fontWeight: 700, fontSize: "0.72rem" }}
															/>
														)}
													</TableCell>

													<TableCell>
														<Typography variant="body2" fontWeight={600}>
															{grupo.materia}
														</Typography>
														{grupo.bloquesCount > 1 && (
															<Typography variant="caption" color="text.secondary">
																{grupo.bloquesCount} horas cátedra
															</Typography>
														)}
													</TableCell>

													<TableCell>
														<Typography variant="body2" color="text.secondary">
															{grupo.comision || "-"}
														</Typography>
													</TableCell>

													<TableCell>
														<Typography variant="body2" fontWeight={500}>
															{rangoHorario}
														</Typography>
														<Typography variant="caption" color="text.secondary">
															Turno: {grupo.turno}
														</Typography>
													</TableCell>

													<TableCell>
														<Typography variant="body2">
															{grupo.profesorado_nombre !== "-" ? grupo.profesorado_nombre : "Institucional"}
														</Typography>
														{grupo.plan_resolucion !== "-" && (
															<Typography variant="caption" color="text.secondary" display="block">
																Plan: {grupo.plan_resolucion}
															</Typography>
														)}
													</TableCell>

													<TableCell align="center">
														{grupo.ya_registrada ? (
															<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
																<CheckCircleOutlineIcon color="success" fontSize="small" />
																<Box textAlign="left">
																	<Typography
																		variant="body2"
																		color="success.main"
																		fontWeight={700}
																	>
																		Presente
																	</Typography>
																	{grupo.registrada_en && (
																		<Typography variant="caption" color="text.secondary" display="block">
																			{grupo.registrada_en}
																		</Typography>
																	)}
																</Box>
															</Stack>
														) : (
															<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
																<HighlightOffIcon color="error" fontSize="small" />
																<Typography
																	variant="body2"
																	color="error.main"
																	fontWeight={700}
																>
																	Ausente
																</Typography>
															</Stack>
														)}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</TableContainer>
						)}
					</Stack>
				)}

				{!puedeVerDocentes && (
					<Stack direction="row" spacing={1} alignItems="center" color="warning.main" mt={1}>
						<WarningAmberIcon fontSize="small" />
						<Typography variant="caption">
							Tu rol no tiene acceso a la asistencia docente. Coordina con Secretaría para habilitarlo.
						</Typography>
					</Stack>
				)}
			</Stack>
		</Paper>
	);
};

export default DocentesPanel;
