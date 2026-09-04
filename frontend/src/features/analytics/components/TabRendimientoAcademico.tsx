import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SchoolIcon from "@mui/icons-material/School";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCarreras } from "@/api/carreras";
import AnalyticsFilters, { type FactorRiesgo } from "./AnalyticsFilters";
import AnalyticsHeader from "./AnalyticsHeader";
import { RegularizacionCursadaPanel } from "./ResumenPorProfesoradoPanels";
import {
	useAcademicPerformancePorMateria,
	useAcademicPerformancePorComisiones,
	useAcademicPerformanceCohortes,
} from "../hooks/useAnalytics";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_BEIGE,
} from "@/styles/institutionalColors";

interface TabRendimientoAcademicoProps {
	anio: number;
	profesoradoId?: number;
	onAnioChange: (anio: number) => void;
	onProfesoradoChange: (profesoradoId?: number) => void;
}

type SubTab = "materias" | "comisiones" | "cohortes";

export default function TabRendimientoAcademico({
	anio,
	profesoradoId,
	onAnioChange,
	onProfesoradoChange,
}: TabRendimientoAcademicoProps) {
	const [subTab, setSubTab] = useState<SubTab>("materias");

	// Carreras para el selector
	const { data: carreras = [] } = useQuery({
		queryKey: ["carreras", "activas"],
		queryFn: () => fetchCarreras(),
	});

	// Datos por materia
	const {
		data: dataMaterias,
		isLoading: loadingMaterias,
		error: errorMaterias,
		refetch: refetchMaterias,
	} = useAcademicPerformancePorMateria({
		profesorado_id: profesoradoId,
	});

	// Datos por comisiones
	const {
		data: dataComisiones,
		isLoading: loadingComisiones,
		error: errorComisiones,
		refetch: refetchComisiones,
	} = useAcademicPerformancePorComisiones({
		profesorado_id: profesoradoId,
	});

	// Datos por cohortes
	const {
		data: dataCohortes,
		isLoading: loadingCohortes,
		error: errorCohortes,
		refetch: refetchCohortes,
	} = useAcademicPerformanceCohortes({
		profesorado_id: profesoradoId,
	});

	const handleSubTabChange = (_: React.SyntheticEvent, newTab: SubTab) => {
		setSubTab(newTab);
	};

	return (
		<Stack spacing={3}>
			<AnalyticsHeader fechaActualizacion={null} />

			<AnalyticsFilters
				anio={anio}
				onAnioChange={onAnioChange}
				profesoradoId={profesoradoId}
				onProfesoradoChange={onProfesoradoChange}
				carreras={carreras}
			/>

			{/* Tarjetas Resumen */}
			<Grid container spacing={2}>
				<Grid item xs={12} sm={6} md={3}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<SchoolIcon sx={{ mr: 1 }} />
								<Typography variant="subtitle2">Promedio General</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{dataMaterias?.promedio_general?.toFixed(2) ?? "-"}
							</Typography>
							<Typography variant="caption" sx={{ opacity: 0.9 }}>
								De un máximo de 10
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_GREEN,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<TrendingUpIcon sx={{ mr: 1 }} />
								<Typography variant="subtitle2">Tasa Aprobación</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{dataMaterias?.tasa_aprobacion_general?.toFixed(1) ?? "-"}%
							</Typography>
							<Typography variant="caption" sx={{ opacity: 0.9 }}>
								Estudiantes aprobados
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<AssignmentIcon sx={{ mr: 1 }} />
								<Typography variant="subtitle2">Materias</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{dataMaterias?.items?.length ?? 0}
							</Typography>
							<Typography variant="caption" sx={{ opacity: 0.9 }}>
								Materias analizadas
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_BEIGE,
							color: INSTITUTIONAL_TERRACOTTA,
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<AssignmentIcon sx={{ mr: 1 }} />
								<Typography variant="subtitle2">Comisiones</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{dataComisiones?.total_comisiones ?? 0}
							</Typography>
							<Typography variant="caption" sx={{ opacity: 0.8 }}>
								Cátedras evaluadas
							</Typography>
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{/* Pestañas de Desglose */}
			<Paper sx={{ mb: 2, borderRadius: 2 }}>
				<Tabs
					value={subTab}
					onChange={handleSubTabChange}
					sx={{
						borderBottom: `2px solid ${INSTITUTIONAL_BEIGE}`,
						"& .MuiTab-root": {
							color: INSTITUTIONAL_GREEN,
							fontWeight: 600,
							"&.Mui-selected": {
								color: INSTITUTIONAL_TERRACOTTA,
							},
						},
						"& .MuiTabs-indicator": {
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							height: 3,
						},
					}}
				>
					<Tab label="Finales por materia" value="materias" />
					<Tab label="Finales por comisión" value="comisiones" />
					<Tab label="Finales por cohorte" value="cohortes" />
				</Tabs>
			</Paper>

			{/* TAB: Materias */}
			{subTab === "materias" && (
				<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
					{errorMaterias ? (
						<Alert
							severity="error"
							action={
								<Button
									color="inherit"
									size="small"
									onClick={() => refetchMaterias()}
								>
									Reintentar
								</Button>
							}
							sx={{ m: 2 }}
						>
							Error al cargar rendimiento por materia.
						</Alert>
					) : (
						<Box sx={{ overflow: "auto" }}>
							<Table>
								<TableHead
									sx={{ backgroundColor: INSTITUTIONAL_TERRACOTTA }}
								>
									<TableRow>
										<TableCell
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_TERRACOTTA,
											}}
										>
											Materia
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_TERRACOTTA,
											}}
										>
											Estudiantes
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_TERRACOTTA,
											}}
										>
											Promedio
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_TERRACOTTA,
											}}
										>
											Aprobación
										</TableCell>
										<TableCell
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_TERRACOTTA,
											}}
										>
											Distribución
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{loadingMaterias ? (
										<TableRow>
											<TableCell colSpan={5}>
												<LinearProgress sx={{ my: 1 }} />
											</TableCell>
										</TableRow>
									) : dataMaterias?.items && dataMaterias.items.length > 0 ? (
										dataMaterias.items.map((mat) => (
											<TableRow key={mat.materia_id}>
												<TableCell
													sx={{
														fontWeight: 600,
														color: INSTITUTIONAL_TERRACOTTA,
													}}
												>
													{mat.materia_nombre}
												</TableCell>
												<TableCell align="right">
													{mat.total_estudiantes}
												</TableCell>
												<TableCell
													align="right"
													sx={{
														backgroundColor:
															mat.promedio_nota !== null &&
															mat.promedio_nota >= 7
																? "#e8f5e9"
																: "#fff3e0",
														fontWeight: 600,
														color:
															mat.promedio_nota !== null &&
															mat.promedio_nota >= 7
																? "#2e7d32"
																: "#e65100",
													}}
												>
													{mat.promedio_nota?.toFixed(2) ?? "-"}
												</TableCell>
												<TableCell align="right">
													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															gap: 1,
														}}
													>
														<LinearProgress
															variant="determinate"
															value={mat.tasa_aprobacion}
															sx={{
																flex: 1,
																height: 8,
																borderRadius: 4,
																backgroundColor:
																	"#e0e0e0",
																"& .MuiLinearProgress-bar":
																	{
																		backgroundColor:
																			INSTITUTIONAL_GREEN,
																	},
															}}
														/>
														<Typography
															variant="body2"
															sx={{
																minWidth: 50,
																fontWeight: 600,
														}}
														>
															{mat.tasa_aprobacion.toFixed(0)}%
														</Typography>
													</Box>
												</TableCell>
												<TableCell>
													<Typography variant="caption">
														0-4: {mat.distribucion_notas["0-4"]} | 5-6:{" "}
														{mat.distribucion_notas["5-6"]} | 7-8:{" "}
														{mat.distribucion_notas["7-8"]} | 9-10:{" "}
														{mat.distribucion_notas["9-10"]}
													</Typography>
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={5} align="center">
												<Typography variant="body2" sx={{ py: 2 }}>
													Sin datos disponibles
												</Typography>
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</Box>
					)}
				</Paper>
			)}

			{/* TAB: Comisiones */}
			{subTab === "comisiones" && (
				<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
					{errorComisiones ? (
						<Alert
							severity="error"
							action={
								<Button
									color="inherit"
									size="small"
									onClick={() => refetchComisiones()}
								>
									Reintentar
								</Button>
							}
							sx={{ m: 2 }}
						>
							Error al cargar rendimiento por comisión.
						</Alert>
					) : (
						<Box sx={{ overflow: "auto" }}>
							<Table>
								<TableHead
									sx={{ backgroundColor: INSTITUTIONAL_GREEN }}
								>
									<TableRow>
										<TableCell
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Comisión
										</TableCell>
										<TableCell
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Materia
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Inscritos
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Promedio
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Aprobación
										</TableCell>
										<TableCell
											align="right"
											sx={{
												color: "white",
												fontWeight: 700,
												backgroundColor: INSTITUTIONAL_GREEN,
											}}
										>
											Riesgo
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{loadingComisiones ? (
										<TableRow>
											<TableCell colSpan={6}>
												<LinearProgress sx={{ my: 1 }} />
											</TableCell>
										</TableRow>
									) : dataComisiones?.items &&
									  dataComisiones.items.length > 0 ? (
										dataComisiones.items.map((com) => (
											<TableRow key={com.comision_codigo}>
												<TableCell
													sx={{
														fontWeight: 600,
														color: INSTITUTIONAL_TERRACOTTA,
													}}
												>
													{com.comision_codigo}
												</TableCell>
												<TableCell>{com.materia_nombre}</TableCell>
												<TableCell align="right">
													{com.total_inscritos}
												</TableCell>
												<TableCell align="right">
													{com.promedio_nota?.toFixed(2) ?? "-"}
												</TableCell>
												<TableCell align="right">
													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															gap: 1,
														}}
													>
														<LinearProgress
															variant="determinate"
															value={com.tasa_aprobacion}
															sx={{
																flex: 1,
																height: 6,
																borderRadius: 3,
																backgroundColor:
																	"#e0e0e0",
																"& .MuiLinearProgress-bar":
																	{
																		backgroundColor:
																			INSTITUTIONAL_GREEN,
																	},
															}}
														/>
														<Typography
															variant="caption"
															sx={{
																minWidth: 40,
																fontWeight: 600,
														}}
														>
															{com.tasa_aprobacion.toFixed(0)}%
														</Typography>
													</Box>
												</TableCell>
												<TableCell
													align="right"
													sx={{
														fontWeight: 600,
														color:
															com.estudiantes_riesgo > 0
																? INSTITUTIONAL_TERRACOTTA
																: INSTITUTIONAL_GREEN,
													}}
												>
													{com.estudiantes_riesgo}
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={6} align="center">
												<Typography variant="body2" sx={{ py: 2 }}>
													Sin datos disponibles
												</Typography>
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</Box>
					)}
				</Paper>
			)}

			{/* TAB: Cohortes */}
			{subTab === "cohortes" && (
				<Stack spacing={2}>
					{errorCohortes ? (
						<Alert
							severity="error"
							action={
								<Button
									color="inherit"
									size="small"
									onClick={() => refetchCohortes()}
								>
									Reintentar
								</Button>
							}
						>
							Error al cargar comparación de cohortes.
						</Alert>
					) : (
						<>
							<Grid container spacing={2}>
								{(loadingCohortes
									? []
									: dataCohortes?.items || []
								).map((cohorte) => (
									<Grid item key={cohorte.cohorte} xs={12} sm={6}>
										<Card
											sx={{
												borderLeft: `4px solid ${INSTITUTIONAL_TERRACOTTA}`,
												borderRadius: 1,
											}}
										>
											<CardContent>
												<Typography
													variant="h6"
													sx={{
														fontWeight: 700,
														color: INSTITUTIONAL_TERRACOTTA,
														mb: 2,
													}}
												>
													Cohorte {cohorte.cohorte}
												</Typography>
												<Stack spacing={1.5}>
													<Box>
														<Typography variant="body2" sx={{ mb: 0.5 }}>
															Estudiantes:{" "}
															<strong>
																{cohorte.total_estudiantes}
															</strong>
														</Typography>
														<Typography variant="body2" sx={{ mb: 0.5 }}>
															Promedio General:{" "}
															<strong>
																{cohorte.promedio_general?.toFixed(
																	2
																) ?? "-"}
															</strong>
														</Typography>
														<Box sx={{ mt: 1 }}>
															<Box
																sx={{
																	display: "flex",
																	justifyContent:
																		"space-between",
																	mb: 0.5,
																}}
															>
																<Typography variant="caption">
																	Tasa de Aprobación
																</Typography>
																<Typography
																	variant="caption"
																	sx={{
																		fontWeight: 600,
																		color: INSTITUTIONAL_GREEN,
																	}}
																>
																	{cohorte.tasa_aprobacion.toFixed(
																		0
																	)}
																	%
																</Typography>
															</Box>
															<LinearProgress
																variant="determinate"
																value={cohorte.tasa_aprobacion}
																sx={{
																	height: 8,
																	borderRadius: 4,
																	backgroundColor: "#e0e0e0",
																	"& .MuiLinearProgress-bar":
																		{
																			backgroundColor:
																				INSTITUTIONAL_GREEN,
																		},
																}}
															/>
														</Box>
													</Box>
												</Stack>
											</CardContent>
										</Card>
									</Grid>
								))}
							</Grid>

							{loadingCohortes && (
								<Box sx={{ my: 2 }}>
									<LinearProgress />
								</Box>
							)}
						</>
					)}
				</Stack>
			)}

			<RegularizacionCursadaPanel />
		</Stack>
	);
}
