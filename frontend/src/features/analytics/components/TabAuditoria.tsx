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
import SecurityIcon from "@mui/icons-material/Security";
import HistoryIcon from "@mui/icons-material/History";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useAuditoriaDashboard } from "../hooks/useAnalytics";
import AnalyticsHeader from "./AnalyticsHeader";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_BEIGE,
	INSTITUTIONAL_GREEN_DARK,
} from "@/styles/institutionalColors";

export default function TabAuditoria() {
	const { data: auditData, isLoading, error, refetch } = useAuditoriaDashboard();

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
					Error al cargar datos de auditoría.
				</Alert>
			</Stack>
		);
	}

	const resumen = auditData?.resumen;

	return (
		<Stack spacing={3}>
			<AnalyticsHeader fechaActualizacion={null} />

			{/* KPI Cards - Últimos 7 días */}
			<Grid container spacing={2}>
				<Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<HistoryIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Eventos (7d)
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.total_eventos_7d || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Total de acciones
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_GREEN,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<SecurityIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Logins (7d)
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.logins_7d || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Inicios de sesión
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
					<Card
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<HistoryIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									CRUD (7d)
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.acciones_crud_7d || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Datos modificados
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
					<Card
						sx={{
							backgroundColor: "#d32f2f",
							color: "white",
							borderRadius: 2,
						}}
					>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
								<WarningIcon sx={{ mr: 1, fontSize: 20 }} />
								<Typography variant="caption" sx={{ fontWeight: 600 }}>
									Alertas
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.alertas_sin_resolver || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.9 }}>
								Sin resolver
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
									Hoy
								</Typography>
							</Box>
							<Typography variant="h4" sx={{ fontWeight: 700 }}>
								{isLoading ? "..." : resumen?.eventos_hoy || 0}
							</Typography>
							<Typography variant="caption2" sx={{ opacity: 0.8 }}>
								Pico: {resumen?.hora_pico || "-"}
							</Typography>
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{/* Logins por día + Top Acciones */}
			<Grid container spacing={2}>
				{/* Logins por Día */}
				<Grid size={{ xs: 12, md: 6 }}>
					<Paper sx={{ borderRadius: 2, p: 2, backgroundColor: "#fafafa" }}>
						<Typography
							variant="h6"
							sx={{
								fontWeight: 700,
								color: INSTITUTIONAL_TERRACOTTA,
								mb: 2,
							}}
						>
							Logins por Día (Últimos 7)
						</Typography>

						{isLoading ? (
							<LinearProgress />
						) : auditData?.logins_por_dia && auditData.logins_por_dia.length > 0 ? (
							<Stack spacing={1.5}>
								{auditData.logins_por_dia.map((item) => (
									<Box key={item.fecha}>
										<Box
											sx={{
												display: "flex",
												justifyContent: "space-between",
												mb: 0.5,
											}}
										>
											<Typography variant="body2" sx={{ fontWeight: 500 }}>
												{new Date(item.fecha).toLocaleDateString("es-AR")}
											</Typography>
											<Typography variant="body2" sx={{ fontWeight: 600 }}>
												{item.total_logins} logins ({item.usuarios_unicos} usuarios)
											</Typography>
										</Box>
										<LinearProgress
											variant="determinate"
											value={Math.min(
												(item.total_logins / (auditData.logins_por_dia[0]?.total_logins || 1)) * 100,
												100
											)}
											sx={{
												height: 6,
												borderRadius: 3,
												backgroundColor: "#e0e0e0",
												"& .MuiLinearProgress-bar": {
													backgroundColor: INSTITUTIONAL_GREEN,
												},
											}}
										/>
									</Box>
								))}
							</Stack>
						) : (
							<Typography variant="body2" color="textSecondary">
								Sin datos disponibles
							</Typography>
						)}
					</Paper>
				</Grid>

				{/* Top Acciones */}
				<Grid size={{ xs: 12, md: 6 }}>
					<Paper sx={{ borderRadius: 2, p: 2, backgroundColor: "#fafafa" }}>
						<Typography
							variant="h6"
							sx={{
								fontWeight: 700,
								color: INSTITUTIONAL_GREEN,
								mb: 2,
							}}
						>
							Top Acciones (Últimos 7)
						</Typography>

						{isLoading ? (
							<LinearProgress />
						) : auditData?.top_acciones && auditData.top_acciones.length > 0 ? (
							<Stack spacing={1}>
								{auditData.top_acciones.map((item) => (
									<Box key={item.accion} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
										<Chip
											label={item.accion}
											size="small"
											sx={{
												backgroundColor: INSTITUTIONAL_BEIGE,
												color: INSTITUTIONAL_TERRACOTTA,
												fontWeight: 600,
											}}
										/>
										<LinearProgress
											variant="determinate"
											value={item.porcentaje}
											sx={{
												flex: 1,
												height: 6,
												borderRadius: 3,
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
												minWidth: 60,
												textAlign: "right",
											}}
										>
											{item.porcentaje}%
										</Typography>
									</Box>
								))}
							</Stack>
						) : (
							<Typography variant="body2" color="textSecondary">
								Sin datos disponibles
							</Typography>
						)}
					</Paper>
				</Grid>
			</Grid>

			{/* Top Usuarios */}
			<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
				<Box sx={{ backgroundColor: INSTITUTIONAL_GREEN, p: 2 }}>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 700,
							color: "white",
						}}
					>
						Usuarios Más Activos (Últimos 7)
					</Typography>
				</Box>

				{isLoading ? (
					<Box sx={{ p: 2 }}>
						<LinearProgress />
					</Box>
				) : auditData?.top_usuarios && auditData.top_usuarios.length > 0 ? (
					<Box sx={{ overflow: "auto" }}>
						<Table>
							<TableHead sx={{ backgroundColor: "#f5f5f5" }}>
								<TableRow>
									<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Usuario
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Acciones
									</TableCell>
									<TableCell sx={{ fontWeight: 700, color: INSTITUTIONAL_GREEN }}>
										Último Acceso
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{auditData.top_usuarios.map((user) => (
									<TableRow key={user.usuario}>
										<TableCell sx={{ fontWeight: 600, color: INSTITUTIONAL_TERRACOTTA }}>
											{user.usuario}
										</TableCell>
										<TableCell align="right">
											<Chip
												label={user.total_acciones}
												size="small"
												sx={{
													backgroundColor: INSTITUTIONAL_BEIGE,
													color: INSTITUTIONAL_TERRACOTTA,
													fontWeight: 600,
												}}
											/>
										</TableCell>
										<TableCell variant="body2">
											{user.ultimos_accesos
												? new Date(user.ultimos_accesos).toLocaleString("es-AR")
												: "-"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Box>
				) : (
					<Box sx={{ p: 2 }}>
						<Typography variant="body2" color="textSecondary">
							Sin datos disponibles
						</Typography>
					</Box>
				)}
			</Paper>

			{/* Alertas Críticas */}
			<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
				<Box sx={{ backgroundColor: "#d32f2f", p: 2 }}>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 700,
							color: "white",
						}}
					>
						Alertas Críticas Sin Resolver
					</Typography>
				</Box>

				{isLoading ? (
					<Box sx={{ p: 2 }}>
						<LinearProgress />
					</Box>
				) : auditData?.alertas_criticas && auditData.alertas_criticas.length > 0 ? (
					<Stack spacing={1} sx={{ p: 2 }}>
						{auditData.alertas_criticas.map((alert) => (
							<Alert
								key={alert.id}
								severity={alert.tipo === "SECURITY" ? "error" : "warning"}
								sx={{
									"& .MuiAlert-icon": {
										fontSize: 20,
									},
								}}
							>
								<Box>
									<Typography variant="body2" sx={{ fontWeight: 600 }}>
										{alert.tipo}: {alert.mensaje}
									</Typography>
									<Typography variant="caption" sx={{ opacity: 0.8 }}>
										Fecha: {new Date(alert.fecha).toLocaleString("es-AR")}
										{alert.entidad_afectada && ` | Entidad: ${alert.entidad_afectada}`}
									</Typography>
								</Box>
							</Alert>
						))}
					</Stack>
				) : (
					<Box sx={{ p: 2, textAlign: "center" }}>
						<CheckCircleIcon
							sx={{
								fontSize: 48,
								color: INSTITUTIONAL_GREEN,
								mb: 1,
							}}
						/>
						<Typography variant="body2" sx={{ color: INSTITUTIONAL_GREEN, fontWeight: 600 }}>
							✓ No hay alertas críticas sin resolver
						</Typography>
					</Box>
				)}
			</Paper>
		</Stack>
	);
}
