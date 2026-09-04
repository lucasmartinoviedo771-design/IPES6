import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningIcon from "@mui/icons-material/Warning";
import SchoolIcon from "@mui/icons-material/School";
import { useQuery } from "@tanstack/react-query";
import { fetchCarreras } from "@/api/carreras";
import AnalyticsFilters from "./AnalyticsFilters";
import AnalyticsHeader from "./AnalyticsHeader";
import { useAusentismoConsolidado } from "../hooks/useAnalytics";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_GREEN_DARK,
	INSTITUTIONAL_BEIGE,
} from "@/styles/institutionalColors";

interface TabAusentismoProps {
	anio: number;
	profesoradoId?: number;
	onAnioChange: (anio: number) => void;
	onProfesoradoChange: (profesoradoId?: number) => void;
}

export default function TabAusentismo({
	anio,
	profesoradoId,
	onAnioChange,
	onProfesoradoChange,
}: TabAusentismoProps) {
	// Carreras para el selector
	const { data: carreras = [] } = useQuery({
		queryKey: ["carreras", "activas"],
		queryFn: () => fetchCarreras(),
	});

	// Datos de ausentismo consolidado
	const {
		data: ausentismoData,
		isLoading,
		error,
		refetch,
	} = useAusentismoConsolidado({
		profesorado_id: profesoradoId,
		dias: 90,
	});

	if (error) {
		return (
			<Stack spacing={3}>
				<AnalyticsHeader fechaActualizacion={null} />
				<Alert
					severity="error"
					action={
						<Button color="inherit" size="small" onClick={() => refetch()}>
							Reintentar
						</Button>
					}
				>
					Error al cargar datos de ausentismo.
				</Alert>
			</Stack>
		);
	}

	const resumen = ausentismoData?.resumen;
	const catedras = ausentismoData?.catedras || [];

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

			{/* KPI Cards */}
			<Grid container spacing={2}>
				<Grid size={{ xs: 12, sm: 6, md: 3 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<WarningIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Tasa Promedio
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.tasa_promedio?.toFixed(1) || "0"}%
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Últimos 90 días
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 3 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<TrendingUpIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Tasa Máxima
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.tasa_maxima?.toFixed(1) || "0"}%
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Pico registrado
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 3 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_GREEN,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<SchoolIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Cátedras Críticas
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.catedras_criticas || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Tasa &gt; 20%
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 3 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_BEIGE,
							color: INSTITUTIONAL_TERRACOTTA,
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<WarningIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Estudiantes Críticos
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : ausentismoData?.estudiantes_criticos || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.8 }}>
								&gt; 30% ausencias
							</Typography>
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{/* Tabla de Presión de Cátedra */}
			<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
				<Box sx={{ backgroundColor: INSTITUTIONAL_GREEN, p: 2 }}>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 700,
							color: "white",
						}}
					>
						Presión de Cátedra - Tasa de Ausentismo
					</Typography>
					<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
						Identificar comisiones con problemas emergentes de asistencia
					</Typography>
				</Box>

				{isLoading ? (
					<Box sx={{ p: 2 }}>
						<LinearProgress />
					</Box>
				) : catedras && catedras.length > 0 ? (
					<Box sx={{ overflow: "auto" }}>
						<Table>
							<TableHead sx={{ backgroundColor: "#f5f5f5" }}>
								<TableRow>
									<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Comisión
									</TableCell>
									<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Materia
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Estudiantes
									</TableCell>
									<TableCell align="center" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Ausentismo Actual
									</TableCell>
									<TableCell align="center" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Promedio 7d
									</TableCell>
									<TableCell align="center" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Tendencia
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										En Riesgo
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{catedras.map((catedra) => (
									<TableRow
										key={catedra.codigo_comision}
										sx={{
											backgroundColor:
												catedra.tasa_ausentismo_actual > 20
													? "rgba(211, 47, 47, 0.05)"
													: catedra.tasa_ausentismo_actual > 10
														? "rgba(255, 152, 0, 0.05)"
														: "transparent",
										}}
									>
										<TableCell sx={{ fontWeight: 600, color: INSTITUTIONAL_TERRACOTTA }}>
											{catedra.codigo_comision}
										</TableCell>
										<TableCell>
											<Typography variant="body2">{catedra.materia}</Typography>
											<Typography variant="caption" sx={{ color: "#666" }}>
												{catedra.docentes.join(", ")}
											</Typography>
										</TableCell>
										<TableCell align="right">{catedra.total_estudiantes}</TableCell>
										<TableCell align="center">
											<Box
												sx={{
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													gap: 1,
												}}
											>
												<LinearProgress
													variant="determinate"
													value={Math.min(catedra.tasa_ausentismo_actual, 100)}
													sx={{
														width: 60,
														height: 6,
														borderRadius: 3,
														backgroundColor: "#e0e0e0",
														"& .MuiLinearProgress-bar": {
															backgroundColor:
																catedra.tasa_ausentismo_actual > 20
																	? "#d32f2f"
																	: catedra.tasa_ausentismo_actual > 10
																		? "#ff9800"
																		: INSTITUTIONAL_GREEN,
														},
													}}
												/>
												<Typography
													variant="body2"
													sx={{
														fontWeight: 600,
														minWidth: 45,
														color:
															catedra.tasa_ausentismo_actual > 20
																? "#d32f2f"
																: catedra.tasa_ausentismo_actual > 10
																	? "#ff9800"
																	: INSTITUTIONAL_GREEN,
													}}
												>
													{catedra.tasa_ausentismo_actual.toFixed(1)}%
												</Typography>
											</Box>
										</TableCell>
										<TableCell align="center">
											<Chip
												label={`${catedra.tasa_ausentismo_promedio_7d.toFixed(1)}%`}
												size="small"
												sx={{
													backgroundColor: INSTITUTIONAL_BEIGE,
													color: INSTITUTIONAL_TERRACOTTA,
													fontWeight: 600,
												}}
											/>
										</TableCell>
										<TableCell align="center">
											{catedra.tendencia === "empeorando" ? (
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														gap: 0.5,
													}}
												>
													<TrendingUpIcon
														sx={{ color: "#d32f2f", fontSize: 18 }}
													/>
													<Typography variant="caption" sx={{ color: "#d32f2f" }}>
														Empeorando
													</Typography>
												</Box>
											) : catedra.tendencia === "mejorando" ? (
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														gap: 0.5,
													}}
												>
													<TrendingDownIcon
														sx={{ color: INSTITUTIONAL_GREEN, fontSize: 18 }}
													/>
													<Typography variant="caption" sx={{ color: INSTITUTIONAL_GREEN }}>
														Mejorando
													</Typography>
												</Box>
											) : (
												<Chip
													label="Estable"
													size="small"
													sx={{
														backgroundColor: "#e0e0e0",
														fontWeight: 500,
													}}
												/>
											)}
										</TableCell>
										<TableCell align="right">
											{catedra.estudiantes_en_riesgo > 0 ? (
												<Chip
													label={catedra.estudiantes_en_riesgo}
													size="small"
													sx={{
														backgroundColor: "#ffebee",
														color: "#d32f2f",
														fontWeight: 600,
													}}
												/>
											) : (
												<Typography variant="body2" sx={{ color: "#999" }}>
													0
												</Typography>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Box>
				) : (
					<Box sx={{ p: 2, textAlign: "center" }}>
						<Typography variant="body2" color="textSecondary">
							Sin datos disponibles
						</Typography>
					</Box>
				)}
			</Paper>

			{/* Nota metodológica */}
			<Alert severity="info" sx={{ borderRadius: 2 }}>
				<Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
					Metodología de Presión de Cátedra
				</Typography>
				<Typography variant="caption">
					La tasa de ausentismo se calcula como: (Ausencias / Total de clases registradas) × 100.
					Se considera <strong>crítica</strong> cuando supera el 20%, y <strong>preocupante</strong> cuando supera el 10%.
					La <strong>tendencia</strong> se calcula comparando la tasa de los últimos 7 días.
					Los <strong>estudiantes en riesgo</strong> tienen más del 30% de ausencias.
				</Typography>
			</Alert>
		</Stack>
	);
}
