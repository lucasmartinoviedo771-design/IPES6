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
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIcon from "@mui/icons-material/Assignment";
import TimerIcon from "@mui/icons-material/Timer";
import PendingIcon from "@mui/icons-material/Pending";
import { useState } from "react";
import AnalyticsHeader from "./AnalyticsHeader";
import { useMesasDashboard, useTramitesDashboard } from "../hooks/useAnalytics";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_GREEN_DARK,
	INSTITUTIONAL_BEIGE,
} from "@/styles/institutionalColors";

type SubTab = "mesas" | "tramites";

export default function TabMesasYTramites() {
	const [subTab, setSubTab] = useState<SubTab>("mesas");

	const { data: mesasData, isLoading: loadingMesas, error: errorMesas, refetch: refetchMesas } = useMesasDashboard();
	const {
		data: tramitesData,
		isLoading: loadingTramites,
		error: errorTramites,
		refetch: refetchTramites,
	} = useTramitesDashboard();

	const handleSubTabChange = (_: React.SyntheticEvent, newTab: SubTab) => {
		setSubTab(newTab);
	};

	return (
		<Stack spacing={3}>
			<AnalyticsHeader fechaActualizacion={null} />

			{/* Pestañas */}
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
					<Tab label="Mesas de Examen" value="mesas" />
					<Tab label="Trámites (Analíticos & Equivalencias)" value="tramites" />
				</Tabs>
			</Paper>

			{/* TAB: MESAS */}
			{subTab === "mesas" && (
				<Stack spacing={3}>
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
										<CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Total Mesas
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingMesas ? "..." : mesasData?.total_mesas || 0}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										Exámenes finales
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
										<PendingIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Pendientes
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingMesas ? "..." : mesasData?.mesas_pendientes || 0}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										Sin procesar
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
										<AssignmentIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Promedio
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingMesas ? "..." : mesasData?.promedio_general_notas?.toFixed(2) || "-"}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										Nota general
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
										<CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Aprobación
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingMesas ? "..." : mesasData?.tasa_aprobacion_general?.toFixed(1) || "-"}%
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.8 }}>
										Tasa de aprobación
									</Typography>
								</CardContent>
							</Card>
						</Grid>
					</Grid>

					{errorMesas ? (
						<Alert
							severity="error"
							action={
								<Button color="inherit" size="small" onClick={() => refetchMesas()}>
									Reintentar
								</Button>
							}
						>
							Error al cargar datos de mesas de examen.
						</Alert>
					) : (
						<>
							{/* Por Tipo */}
							<Paper sx={{ borderRadius: 2, p: 2, backgroundColor: "#fafafa" }}>
								<Typography
									variant="h6"
									sx={{
										fontWeight: 700,
										color: INSTITUTIONAL_TERRACOTTA,
										mb: 2,
									}}
								>
									Mesas por Tipo
								</Typography>
								{loadingMesas ? (
									<LinearProgress />
								) : mesasData?.por_tipo && mesasData.por_tipo.length > 0 ? (
									<Stack spacing={2}>
										{mesasData.por_tipo.map((item) => (
											<Box key={item.tipo_mesa}>
												<Box
													sx={{
														display: "flex",
														justifyContent: "space-between",
														mb: 1,
													}}
												>
													<Typography variant="body2" sx={{ fontWeight: 600 }}>
														{item.tipo_mesa}
													</Typography>
													<Typography variant="body2" sx={{ fontWeight: 600 }}>
														{item.cantidad} mesas | Promedio: {item.promedio_nota?.toFixed(2) || "-"}
													</Typography>
												</Box>
												<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
													<LinearProgress
														variant="determinate"
														value={Math.min(item.tasa_aprobacion, 100)}
														sx={{
															flex: 1,
															height: 8,
															borderRadius: 4,
															backgroundColor: "#e0e0e0",
															"& .MuiLinearProgress-bar": {
																backgroundColor: INSTITUTIONAL_GREEN,
															},
														}}
													/>
													<Typography
														variant="caption"
														sx={{
															fontWeight: 600,
															minWidth: 50,
															textAlign: "right",
														}}
													>
														{item.tasa_aprobacion.toFixed(0)}%
													</Typography>
												</Box>
											</Box>
										))}
									</Stack>
								) : (
									<Typography variant="body2" color="textSecondary">
										Sin datos disponibles
									</Typography>
								)}
							</Paper>

							{/* Últimas Mesas */}
							<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
								<Box sx={{ backgroundColor: INSTITUTIONAL_GREEN, p: 2 }}>
									<Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
										Últimas Mesas Registradas
									</Typography>
								</Box>
								<Box sx={{ overflow: "auto" }}>
									<Table>
										<TableHead sx={{ backgroundColor: "#f5f5f5" }}>
											<TableRow>
												<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
													Materia
												</TableCell>
												<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
													Estudiante
												</TableCell>
												<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
													Tipo
												</TableCell>
												<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
													Nota
												</TableCell>
												<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
													Fecha
												</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{loadingMesas ? (
												<TableRow>
													<TableCell colSpan={5}>
														<LinearProgress sx={{ my: 1 }} />
													</TableCell>
												</TableRow>
											) : mesasData?.ultimas_mesas && mesasData.ultimas_mesas.length > 0 ? (
												mesasData.ultimas_mesas.map((mesa, idx) => (
													<TableRow key={idx}>
														<TableCell sx={{ fontWeight: 600 }}>
															{mesa.materia}
														</TableCell>
														<TableCell>{mesa.estudiante}</TableCell>
														<TableCell>
															<Chip
																label={mesa.tipo}
																size="small"
																sx={{
																	backgroundColor: INSTITUTIONAL_BEIGE,
																	color: INSTITUTIONAL_TERRACOTTA,
																}}
															/>
														</TableCell>
														<TableCell align="right" sx={{ fontWeight: 600 }}>
															{mesa.nota?.toFixed(2) || "-"}
														</TableCell>
														<TableCell>
															{new Date(mesa.fecha).toLocaleDateString("es-AR")}
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
							</Paper>
						</>
					)}
				</Stack>
			)}

			{/* TAB: TRÁMITES */}
			{subTab === "tramites" && (
				<Stack spacing={3}>
					{/* KPI Cards */}
					<Grid container spacing={2}>
						<Grid size={{ xs: 12, sm: 6, md: 3 }}>
							<Card
								sx={{
									backgroundColor: "#ff9800",
									color: "white",
									borderRadius: 2,
								}}
							>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
										<PendingIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Pendientes
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingTramites ? "..." : tramitesData?.total_pendientes || 0}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										En revisión
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
										<CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Aprobados
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingTramites ? "..." : tramitesData?.total_aprobados || 0}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										Resolución positiva
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid size={{ xs: 12, sm: 6, md: 3 }}>
							<Card
								sx={{
									backgroundColor: "#d32f2f",
									color: "white",
									borderRadius: 2,
								}}
							>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
										<TimerIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Rechazados
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingTramites ? "..." : tramitesData?.total_rechazados || 0}
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.9 }}>
										No aprobados
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
										<TimerIcon sx={{ mr: 1, fontSize: 20 }} />
										<Typography variant="caption" sx={{ fontWeight: 600 }}>
											Tiempo Promedio
										</Typography>
									</Box>
									<Typography variant="h4" sx={{ fontWeight: 700 }}>
										{loadingTramites ? "..." : tramitesData?.tiempo_promedio_resolucion?.toFixed(1) || "-"}d
									</Typography>
									<Typography variant="caption2" sx={{ opacity: 0.8 }}>
										Días de resolución
									</Typography>
								</CardContent>
							</Card>
						</Grid>
					</Grid>

					{errorTramites ? (
						<Alert
							severity="error"
							action={
								<Button color="inherit" size="small" onClick={() => refetchTramites()}>
									Reintentar
								</Button>
							}
						>
							Error al cargar datos de trámites.
						</Alert>
					) : (
						<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
							<Box sx={{ backgroundColor: INSTITUTIONAL_GREEN, p: 2 }}>
								<Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
									Trámites Recientes
								</Typography>
							</Box>
							<Box sx={{ overflow: "auto" }}>
								<Table>
									<TableHead sx={{ backgroundColor: "#f5f5f5" }}>
										<TableRow>
											<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
												Tipo
											</TableCell>
											<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
												Estudiante
											</TableCell>
											<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
												Estado
											</TableCell>
											<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
												Días Transcurridos
											</TableCell>
											<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
												Fecha Solicitud
											</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{loadingTramites ? (
											<TableRow>
												<TableCell colSpan={5}>
													<LinearProgress sx={{ my: 1 }} />
												</TableCell>
											</TableRow>
										) : tramitesData?.pedidos_recientes && tramitesData.pedidos_recientes.length > 0 ? (
											tramitesData.pedidos_recientes.map((pedido) => (
												<TableRow key={`${pedido.tipo}-${pedido.id}`}>
													<TableCell sx={{ fontWeight: 600 }}>
														<Chip
															label={pedido.tipo}
															size="small"
															sx={{
																backgroundColor: INSTITUTIONAL_BEIGE,
																color: INSTITUTIONAL_TERRACOTTA,
															}}
														/>
													</TableCell>
													<TableCell>{pedido.estudiante_nombre}</TableCell>
													<TableCell>
														<Chip
															label={pedido.estado}
															size="small"
															sx={{
																backgroundColor:
																	pedido.estado === "Aprobado"
																		? "#c8e6c9"
																		: pedido.estado === "Rechazado"
																			? "#ffcdd2"
																			: "#fff9c4",
																color:
																	pedido.estado === "Aprobado"
																		? INSTITUTIONAL_GREEN
																		: pedido.estado === "Rechazado"
																			? "#d32f2f"
																			: "#f57f17",
															}}
														/>
													</TableCell>
													<TableCell align="right" sx={{ fontWeight: 600 }}>
														{pedido.dias_transcurridos}
													</TableCell>
													<TableCell>
														{new Date(pedido.fecha_solicitud).toLocaleDateString("es-AR")}
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
						</Paper>
					)}
				</Stack>
			)}
		</Stack>
	);
}
