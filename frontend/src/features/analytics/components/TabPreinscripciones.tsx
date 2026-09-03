import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import {
	Bar,
	BarChart,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useCarreras } from "@/hooks/useCarreras";
import {
	usePreinscripcionesEvolucion,
	usePreinscripcionesSummary,
} from "../hooks/useAnalytics";

interface TabPreinscripcionesProps {
	anio: number;
	profesoradoId?: number;
	onAnioChange: (anio: number) => void;
	onProfesoradoChange: (profesoradoId?: number) => void;
}

const COLORS_ESTADO: Record<string, string> = {
	Confirmada: "#16a34a",
	Enviada: "#eab308",
	Observada: "#f97316",
	Borrador: "#94a3b8",
	Rechazada: "#dc2626",
};

export default function TabPreinscripciones({
	anio,
	profesoradoId,
	onAnioChange,
	onProfesoradoChange,
}: TabPreinscripcionesProps) {
	const [agrupacion, setAgrupacion] = useState<"semana" | "mes">("semana");
	const { data: carreras } = useCarreras();

	const { data: summary, isLoading: loadingSummary } =
		usePreinscripcionesSummary({
			anio,
			profesorado_id: profesoradoId,
		});

	const { data: evolucion, isLoading: loadingEvolucion } =
		usePreinscripcionesEvolucion({
			anio,
			profesorado_id: profesoradoId,
			agrupacion,
		});

	// Preparar datos para el PieChart de estados
	const pieData = Object.entries(summary?.por_estado || {})
		.filter(([_, value]) => value > 0)
		.map(([name, value]) => ({
			name,
			value,
			color: COLORS_ESTADO[name] || "#64748b",
		}));

	const confirmadas = summary?.por_estado?.Confirmada || 0;
	const enviadas = summary?.por_estado?.Enviada || 0;
	const observadas = summary?.por_estado?.Observada || 0;
	const total = summary?.total || 0;
	const ratioConfirmadas =
		total > 0 ? Math.round((confirmadas / total) * 100) : 0;

	return (
		<Stack spacing={3}>
			{/* Filtros de la solapa */}
			<Paper
				elevation={0}
				sx={{
					p: 2.5,
					borderRadius: 3,
					border: "1px solid #e2e8f0",
					backgroundColor: "#fff",
				}}
			>
				<Grid container spacing={2} alignItems="center">
					<Grid item xs={12} sm={4} md={3}>
						<FormControl fullWidth size="small">
							<InputLabel id="preins-anio-label">Ciclo Lectivo</InputLabel>
							<Select
								labelId="preins-anio-label"
								value={anio}
								label="Ciclo Lectivo"
								onChange={(e) => onAnioChange(Number(e.target.value))}
							>
								{[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
									<MenuItem key={y} value={y}>
										Año {y}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>

					<Grid item xs={12} sm={8} md={6}>
						<FormControl fullWidth size="small">
							<InputLabel id="preins-carrera-label">
								Carrera / Profesorado
							</InputLabel>
							<Select
								labelId="preins-carrera-label"
								value={profesoradoId || ""}
								label="Carrera / Profesorado"
								onChange={(e) =>
									onProfesoradoChange(
										e.target.value ? Number(e.target.value) : undefined,
									)
								}
							>
								<MenuItem value="">Todas las carreras</MenuItem>
								{(carreras || []).map((c) => (
									<MenuItem key={c.id} value={c.id}>
										{c.nombre}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
				</Grid>
			</Paper>

			{/* KPI Cards de resumen */}
			<Grid container spacing={2}>
				<Grid item xs={12} sm={6} md={3}>
					<Card
						elevation={0}
						sx={{
							borderRadius: 3,
							border: "1px solid #e2e8f0",
							p: 1,
							backgroundColor: "#f8fafc",
						}}
					>
						<CardContent>
							<Typography variant="caption" fontWeight={600} color="#64748b">
								TOTAL PREINSCRIPCIONES
							</Typography>
							<Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
								{loadingSummary ? <Skeleton width={80} /> : total}
							</Typography>
							<Typography variant="body2" color="#64748b" mt={0.5}>
								Iniciadas en el ciclo {anio}
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						elevation={0}
						sx={{
							borderRadius: 3,
							border: "1px solid #bbf7d0",
							p: 1,
							backgroundColor: "#f0fdf4",
						}}
					>
						<CardContent>
							<Typography variant="caption" fontWeight={600} color="#166534">
								CONFIRMADAS (CON LEGAJO)
							</Typography>
							<Typography variant="h4" fontWeight={800} color="#15803d" mt={0.5}>
								{loadingSummary ? <Skeleton width={80} /> : confirmadas}
							</Typography>
							<Typography variant="body2" color="#166534" mt={0.5}>
								{ratioConfirmadas}% del total de postulantes
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						elevation={0}
						sx={{
							borderRadius: 3,
							border: "1px solid #fef08a",
							p: 1,
							backgroundColor: "#fefce8",
						}}
					>
						<CardContent>
							<Typography variant="caption" fontWeight={600} color="#854d0e">
								ENVIADAS / PENDIENTES
							</Typography>
							<Typography variant="h4" fontWeight={800} color="#a16207" mt={0.5}>
								{loadingSummary ? <Skeleton width={80} /> : enviadas}
							</Typography>
							<Typography variant="body2" color="#854d0e" mt={0.5}>
								Aguardando revisión de legajo
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} sm={6} md={3}>
					<Card
						elevation={0}
						sx={{
							borderRadius: 3,
							border: "1px solid #fed7aa",
							p: 1,
							backgroundColor: "#fff7ed",
						}}
					>
						<CardContent>
							<Typography variant="caption" fontWeight={600} color="#9a3412">
								OBSERVADAS / DOC. PENDIENTE
							</Typography>
							<Typography variant="h4" fontWeight={800} color="#c2410c" mt={0.5}>
								{loadingSummary ? <Skeleton width={80} /> : observadas}
							</Typography>
							<Typography variant="body2" color="#9a3412" mt={0.5}>
								Requieren subsanar requisitos
							</Typography>
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{/* Gráficos principales de Recharts */}
			<Grid container spacing={3}>
				{/* Gráfico de Torta: Distribución por Estado */}
				<Grid item xs={12} md={5}>
					<Paper
						elevation={0}
						sx={{
							p: 3,
							borderRadius: 3,
							border: "1px solid #e2e8f0",
							height: 400,
							display: "flex",
							flexDirection: "column",
						}}
					>
						<Typography variant="h6" fontWeight={700} color="#1e293b" mb={1}>
							Distribución por Estado
						</Typography>
						<Typography variant="body2" color="#64748b" mb={2}>
							Estado actual de tramitación en el ciclo {anio}
						</Typography>

						{loadingSummary ? (
							<Skeleton variant="circular" width={220} height={220} sx={{ m: "auto" }} />
						) : pieData.length === 0 ? (
							<Box m="auto" textAlign="center">
								<Typography color="#94a3b8">Sin datos para el período seleccionado</Typography>
							</Box>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={pieData}
										dataKey="value"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={100}
										innerRadius={45}
										paddingAngle={4}
									>
										{pieData.map((entry) => (
											<Cell key={entry.name} fill={entry.color} />
										))}
									</Pie>
									<Tooltip
										formatter={(val: any, name: any) => [
											`${val} (${Math.round((Number(val) / (total || 1)) * 100)}%)`,
											name,
										]}
									/>
									<Legend verticalAlign="bottom" height={36} />
								</PieChart>
							</ResponsiveContainer>
						)}
					</Paper>
				</Grid>

				{/* Gráfico de Barras: Evolución Temporal */}
				<Grid item xs={12} md={7}>
					<Paper
						elevation={0}
						sx={{
							p: 3,
							borderRadius: 3,
							border: "1px solid #e2e8f0",
							height: 400,
							display: "flex",
							flexDirection: "column",
						}}
					>
						<Stack
							direction={{ xs: "column", sm: "row" }}
							justifyContent="space-between"
							alignItems={{ xs: "flex-start", sm: "center" }}
							mb={2}
							gap={1}
						>
							<Box>
								<Typography variant="h6" fontWeight={700} color="#1e293b">
									Evolución Temporal de Carga
								</Typography>
								<Typography variant="body2" color="#64748b">
									Ingreso de preinscripciones según fecha de registro
								</Typography>
							</Box>
							<ToggleButtonGroup
								size="small"
								value={agrupacion}
								exclusive
								onChange={(_, val) => val && setAgrupacion(val)}
							>
								<ToggleButton value="semana">Semana</ToggleButton>
								<ToggleButton value="mes">Mes</ToggleButton>
							</ToggleButtonGroup>
						</Stack>

						{loadingEvolucion ? (
							<Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
						) : !evolucion || evolucion.length === 0 ? (
							<Box m="auto" textAlign="center">
								<Typography color="#94a3b8">
									No hay registros temporales para los filtros seleccionados
								</Typography>
							</Box>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={evolucion}>
									<XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
									<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
									<Tooltip
										formatter={(val: any) => [`${val} preinscripciones`, "Total"]}
									/>
									<Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						)}
					</Paper>
				</Grid>
			</Grid>

			{/* Tabla desglose por Profesorado */}
			{summary?.por_profesorado && summary.por_profesorado.length > 0 && (
				<Paper
					elevation={0}
					sx={{
						p: 3,
						borderRadius: 3,
						border: "1px solid #e2e8f0",
					}}
				>
					<Typography variant="h6" fontWeight={700} color="#1e293b" mb={2}>
						Distribución de Postulantes por Carrera
					</Typography>
					<Grid container spacing={1.5}>
						{summary.por_profesorado.map((c) => (
							<Grid item xs={12} sm={6} md={4} key={c.profesorado_id}>
								<Box
									sx={{
										p: 1.5,
										borderRadius: 2,
										border: "1px solid #f1f5f9",
										backgroundColor: "#fafafa",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<Typography variant="body2" fontWeight={600} color="#334155" noWrap sx={{ maxWidth: "75%" }}>
										{c.profesorado_nombre}
									</Typography>
									<Chip label={c.total} size="small" color="primary" sx={{ fontWeight: 700 }} />
								</Box>
							</Grid>
						))}
					</Grid>
				</Paper>
			)}
		</Stack>
	);
}
