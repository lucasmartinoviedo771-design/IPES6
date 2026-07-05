import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PeopleIcon from "@mui/icons-material/People";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCarreras } from "@/api/carreras";
import { getGlobalOverview } from "@/api/management";
import {
	listarPreinscripciones,
	type PreinscripcionDTO,
} from "@/api/preinscripciones";
import { getCorrelativasCaidas } from "@/api/reportes";
import AdminCorrelativasWidget from "@/components/dashboard/AdminCorrelativasWidget";
import { ForcedResetWidget } from "@/components/dashboard/ForcedResetWidget";
import StudentAlerts from "@/components/dashboard/StudentAlerts";
import { PageHero } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import {
	ICON_GRADIENT,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";
import { hasAnyRole } from "@/utils/roles";

type QuickAction = {
	title: string;
	description: string;
	icon: React.ReactNode;
	onClick: () => void;
	variant?: "contained" | "outlined";
	roles?: string[];
};

const TERRACOTTA = INSTITUTIONAL_TERRACOTTA;
const TERRACOTTA_DARK = INSTITUTIONAL_TERRACOTTA_DARK;
const OLIVE = INSTITUTIONAL_GREEN;
const OLIVE_TINT = "rgba(125,127,110,0.25)";
const TERRACOTTA_TINT = "rgba(183,105,78,0.15)";
const STAT_PURPLE_GRADIENT = "linear-gradient(135deg,#7c3aed,#a855f7)";
const STAT_GREEN_GRADIENT = "linear-gradient(135deg,#22c55e,#4ade80)";
const STAT_AMBER_GRADIENT = "linear-gradient(135deg,#f59e0b,#f97316)";
const STAT_PINK_GRADIENT = "linear-gradient(135deg,#fb7185,#f43f5e)";

const CardBox = ({
	children,
	sx = {},
}: {
	children: React.ReactNode;
	sx?: SxProps<Theme>;
}) => (
	<Paper
		elevation={0}
		sx={{
			p: 3,
			borderRadius: 3,
			backgroundColor: "#ffffff",
			border: "1px solid rgba(125,127,110,0.2)",
			boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
			...sx,
		}}
	>
		{children}
	</Paper>
);

type StatCardProps = {
	title: string;
	value: number;
	subtitle?: string;
	icon: React.ReactNode;
	accent: string;
	iconBg: string;
	borderColor: string;
};

const StatCard = ({
	title,
	value,
	subtitle,
	icon,
	accent,
	iconBg,
	borderColor,
}: StatCardProps) => (
	<Paper
		elevation={0}
		sx={{
			p: 3,
			minHeight: 150,
			borderRadius: 3,
			background: "#fff",
			border: `1px solid ${borderColor}`,
			boxShadow: "0 20px 45px rgba(15,23,42,0.06)",
			display: "flex",
			flexDirection: "column",
			gap: 1.2,
		}}
	>
		<Box
			sx={{
				width: 52,
				height: 52,
				borderRadius: 12,
				background: iconBg,
				display: "grid",
				placeItems: "center",
				color: "#fff",
				boxShadow: "0 18px 30px rgba(0,0,0,0.08)",
			}}
		>
			{icon}
		</Box>
		<Typography
			variant="caption"
			sx={{
				textTransform: "uppercase",
				letterSpacing: 0.8,
				color: "#64748b",
				fontWeight: 600,
			}}
		>
			{title}
		</Typography>
		<Typography variant="h4" fontWeight={700} color="#0f172a">
			{value}
		</Typography>
		{subtitle && (
			<Typography variant="body2" color="#475569">
				{subtitle}
			</Typography>
		)}
	</Paper>
);

export default function DashboardPage() {
	const navigate = useNavigate();
	const { user } = useAuth();

	// Filtros de Dashboard
	const [selectedProfesorado, setSelectedProfesorado] = useState<
		number | string
	>("");
	const [selectedAnio, setSelectedAnio] = useState<number | string>(
		dayjs().year(),
	);

	// Cargar carreras para el filtro
	const { data: carreras } = useQuery({
		queryKey: ["profesorados-dashboard"],
		queryFn: fetchCarreras,
	});

	const years = useMemo(() => {
		const current = dayjs().year();
		return [current + 1, current, current - 1, current - 2];
	}, []);

	type EstadoNormalizado = Lowercase<PreinscripcionDTO["estado"]>;
	const normalizeEstado = (estado: PreinscripcionDTO["estado"]) =>
		estado.toLowerCase() as EstadoNormalizado;

	const can = useCallback(
		(roles?: string[]) => hasAnyRole(user, roles || []),
		[user],
	);

	// Query correlativas caídas (key compartida con widget hijo para deduplicación)
	const { data: correlativasCaidas } = useQuery({
		queryKey: ["correlativas-caidas"],
		queryFn: () => getCorrelativasCaidas(),
		enabled: can(["admin", "secretaria"]),
		staleTime: 1000 * 60 * 5,
	});

	// Query global para métricas exactas (evita problemas de paginación)
	const { data: overview } = useQuery({
		queryKey: ["global-overview", selectedProfesorado, selectedAnio],
		queryFn: () =>
			getGlobalOverview(
				typeof selectedProfesorado === "number"
					? selectedProfesorado
					: undefined,
				typeof selectedAnio === "number" ? selectedAnio : undefined,
			),
		enabled: can(["admin", "secretaria", "bedel", "preinscripciones"]),
		staleTime: 1000 * 60 * 2, // 2 min
	});

	// Query preinscripciones (para lista de recientes)
	const { data: preinscripcionesRaw } = useQuery({
		queryKey: ["preinscripciones-dashboard", selectedProfesorado, selectedAnio],
		queryFn: () =>
			listarPreinscripciones({
				limit: 10,
				profesorado_id:
					typeof selectedProfesorado === "number"
						? selectedProfesorado
						: undefined,
				anio: typeof selectedAnio === "number" ? selectedAnio : undefined,
			}),
		enabled: can(["admin", "secretaria", "bedel", "preinscripciones"]),
		staleTime: 1000 * 60 * 2, // 2 min
	});

	// 1. Métricas exactas desde la base de datos (vía Overview)
	const metrics = useMemo(() => {
		if (overview) {
			const pre = overview.preinscripciones;
			const findTotal = (estadoStr: string) =>
				pre.por_estado.find(
					(e) => (e.estado || "").toLowerCase() === estadoStr.toLowerCase(),
				)?.total || 0;

			const total = pre.total;
			const confirmadas = findTotal("confirmada");
			const enviadas = findTotal("enviada");
			const observadas = findTotal("observada");
			const rechazadas = findTotal("rechazada");

			return {
				total,
				confirmadas,
				pendientes: enviadas + observadas,
				observadas,
				rechazadas,
				ratio: total > 0 ? Math.round((confirmadas / total) * 100) : 0,
			};
		}

		// Fallback inicial
		return {
			total: 0,
			confirmadas: 0,
			pendientes: 0,
			observadas: 0,
			rechazadas: 0,
			ratio: 0,
		};
	}, [overview]);

	// 2. Lista de preinscripciones recientes (usamos la lista paginada para mantener el objeto Estudiante)
	const recientes = useMemo(() => {
		const data: PreinscripcionDTO[] = Array.isArray(preinscripcionesRaw)
			? preinscripcionesRaw
			: 				(preinscripcionesRaw as any)?.results || [];
		return data.slice(0, 5); // Mostramos las últimas 5
	}, [preinscripcionesRaw]);

	const rawActions: QuickAction[] = [
		{
			title: "Nueva preinscripción",
			description: "Crear una nueva preinscripción",
			icon: <AddIcon />,
			onClick: () => navigate("/preinscripcion"),
			variant: "contained",
		},
		{
			title: "Ver preinscripciones",
			description: "Gestionar inscripciones existentes",
			icon: <ScheduleIcon />,
			onClick: () => navigate("/preinscripciones"),
			variant: "outlined",
		},
		{
			title: "Gestión de estudiantes",
			description: "Administrar información de estudiantes",
			icon: <PeopleIcon />,
			onClick: () => navigate("/estudiantes"),
			variant: "outlined",
			roles: ["secretaria", "admin"],
		},
		{
			title: "Carreras",
			description: "Administrar carreras y cohortes",
			icon: <MenuBookIcon />,
			onClick: () => navigate("/carreras"),
			variant: "outlined",
			roles: ["admin"],
		},
		{
			title: "Reportes",
			description: "Ver estadísticas y reportes",
			icon: <BarChartIcon />,
			onClick: () => navigate("/reportes"),
			variant: "outlined",
			roles: ["secretaria", "admin"],
		},
	];

	const actions = rawActions.filter((a) => can(a.roles));

	const estadoChip = (estado: PreinscripcionDTO["estado"]) => {
		const map: Record<
			EstadoNormalizado,
			"default" | "success" | "warning" | "error"
		> = {
			confirmada: "success",
			observada: "warning",
			rechazada: "error",
			enviada: "warning",
			borrador: "default",
		};
		const intent = map[normalizeEstado(estado)] ?? "default";
		return (
			<Chip
				size="small"
				variant={intent === "default" ? "outlined" : "filled"}
				label={estado}
				color={intent}
				sx={{
					borderRadius: 999,
					fontWeight: 600,
					textTransform: "capitalize",
					...(intent === "default"
						? { borderColor: TERRACOTTA, color: TERRACOTTA }
						: {}),
				}}
			/>
		);
	};

	const statBlocks = [
		{
			title: "Total de preinscripciones",
			value: metrics.total,
			subtitle: "Ciclo lectivo en curso",
			icon: <ScheduleIcon />,
			accent: "#4338ca",
			iconBg: STAT_PURPLE_GRADIENT,
			borderColor: "rgba(99,102,241,0.25)",
		},
		{
			title: "Confirmadas",
			value: metrics.confirmadas,
			subtitle: `${metrics.ratio}% del total`,
			icon: <CheckCircleIcon />,
			accent: "#0f9d58",
			iconBg: STAT_GREEN_GRADIENT,
			borderColor: "rgba(34,197,94,0.25)",
		},
		{
			title: "Pendientes",
			value: metrics.pendientes,
			subtitle: "Requieren revisión",
			icon: <ScheduleIcon />,
			accent: "#b45309",
			iconBg: STAT_AMBER_GRADIENT,
			borderColor: "rgba(245,158,11,0.25)",
		},
		{
			title: "Correlativas Caídas",
			value: correlativasCaidas?.length || 0,
			subtitle: "Estudiantes con problemas",
			icon: <WarningAmberIcon />,
			accent: "#ef4444",
			iconBg: "linear-gradient(135deg, #ef4444, #b91c1c)",
			borderColor: "rgba(239, 68, 68, 0.25)",
		},
	];

	return (
		<Stack spacing={3}>
			{/* Alertas para estudiantes (solo se muestran si hay problemas) */}
			<StudentAlerts />

			<PageHero
				title="Panel principal"
				subtitle="Visualizá indicadores clave, accedé a las preinscripciones y mantené actualizadas las cohortes desde un único espacio."
				actions={
					<Stack
						direction={{ xs: "column", sm: "row" }}
						spacing={1.5}
						alignItems="center"
					>
						<Button
							variant="outlined"
							onClick={() => navigate("/reportes")}
							sx={{
								borderColor: "rgba(255,255,255,0.4)",
								color: "#fff",
								textTransform: "none",
								fontWeight: 600,
								borderRadius: 999,
								px: 3,
								backgroundColor: "rgba(255,255,255,0.08)",
								"&:hover": {
									backgroundColor: "rgba(255,255,255,0.15)",
									borderColor: "rgba(255,255,255,0.6)",
								},
							}}
						>
							Ver reportes
						</Button>
						<Button
							variant="contained"
							onClick={() => navigate("/preinscripciones")}
							startIcon={<ScheduleIcon />}
							sx={{
								background: `linear-gradient(135deg, ${TERRACOTTA} 0%, ${TERRACOTTA_DARK} 100%)`,
								color: "#fff",
								textTransform: "none",
								fontWeight: 700,
								borderRadius: 999,
								px: 3,
								boxShadow: "0 20px 40px rgba(183,105,78,0.35)",
								"&:hover": {
									background: `linear-gradient(135deg, ${TERRACOTTA_DARK} 0%, ${TERRACOTTA_DARK} 100%)`,
								},
							}}
						>
							Gestionar preinscripciones
						</Button>
					</Stack>
				}
			/>

			{/* Filtros Globales */}
			<Box sx={{ mb: 4, mt: -2 }}>
				<Grid container spacing={2} alignItems="center">
					<Grid item xs={12} md={5}>
						<FormControl fullWidth size="small">
							<InputLabel id="profesorado-filter-label">
								Filtrar por Carrera
							</InputLabel>
							<Select
								labelId="profesorado-filter-label"
								value={selectedProfesorado}
								label="Filtrar por Carrera"
								onChange={(e) => setSelectedProfesorado(e.target.value)}
								sx={{ bgcolor: "white" }}
							>
								<MenuItem value="">Todas las carreras</MenuItem>
								{carreras?.map((c) => (
									<MenuItem key={c.id} value={c.id}>
										{c.nombre}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={12} md={3}>
						<FormControl fullWidth size="small">
							<InputLabel id="anio-filter-label">Año Lectivo</InputLabel>
							<Select
								labelId="anio-filter-label"
								value={selectedAnio}
								label="Año Lectivo"
								onChange={(e) => setSelectedAnio(e.target.value)}
								sx={{ bgcolor: "white" }}
							>
								<MenuItem value="">Todos los años</MenuItem>
								{years.map((y) => (
									<MenuItem key={y} value={y}>
										{y}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</Grid>
				</Grid>
			</Box>

			<Grid container spacing={3}>
				{statBlocks.map((stat) => (
					<Grid key={stat.title} item xs={12} sm={6} lg={3}>
						<StatCard {...stat} />
					</Grid>
				))}
			</Grid>

			{can(["admin", "secretaria"]) && (
				<Grid container spacing={3} mb={3}>
					<Grid item xs={12} md={6} lg={4}>
						<ForcedResetWidget />
					</Grid>
					<Grid item xs={12} md={6} lg={8}>
						<CardBox
							sx={{
								bgcolor: "rgba(125,127,110,0.05)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								height: "100%",
								borderStyle: "dashed",
							}}
						>
							<Box textAlign="center" maxWidth={400}>
								<Typography
									variant="subtitle2"
									fontWeight={700}
									color={INSTITUTIONAL_TERRACOTTA_DARK}
									mb={1}
								>
									Herramientas de Mantenimiento
								</Typography>
								<Typography variant="body2" color="text.secondary">
									<strong>Reseteo Forzado:</strong> Use esto para dar acceso
									inmediato a usuarios bloqueados. Al resetear, el estudiante
									podrá ingresar directamente sin pasar por la pantalla de
									cambio de clave.
								</Typography>
							</Box>
						</CardBox>
					</Grid>
				</Grid>
			)}

			<Grid container spacing={3}>
				<Grid item xs={12} lg={7}>
					<CardBox>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography variant="h6" fontWeight={700} color="#020617">
								Accesos rápidos
							</Typography>
							<Button
								size="small"
								startIcon={<AddIcon />}
								sx={{
									textTransform: "none",
									color: TERRACOTTA,
									fontWeight: 600,
								}}
								onClick={() => navigate("/preinscripcion")}
							>
								Nueva preinscripción
							</Button>
						</Stack>
						<Grid container spacing={1.5}>
							{actions.map((action) => (
								<Grid item xs={12} sm={6} key={action.title}>
									<Paper
										elevation={0}
										onClick={action.onClick}
										sx={{
											borderRadius: 5,
											p: 2,
											border: `1px solid rgba(125,127,110,0.25)`,
											cursor: "pointer",
											display: "flex",
											alignItems: "center",
											gap: 1.5,
											transition: "all .2s ease",
											backgroundColor: "#fff",
											"&:hover": {
												boxShadow: "0 20px 45px rgba(15,23,42,0.08)",
												transform: "translateY(-2px)",
												borderColor: TERRACOTTA_TINT,
											},
										}}
									>
										<Box
											sx={{
												width: 44,
												height: 44,
												borderRadius: 5,
												background: ICON_GRADIENT,
												display: "grid",
												placeItems: "center",
												color: "#fff",
												boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
											}}
										>
											{action.icon}
										</Box>
										<Box>
											<Typography fontWeight={700} color="#020617">
												{action.title}
											</Typography>
											<Typography variant="body2" color="#020617">
												{action.description}
											</Typography>
										</Box>
									</Paper>
								</Grid>
							))}
						</Grid>
					</CardBox>
				</Grid>

				<Grid item xs={12} lg={5}>
					<CardBox>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography variant="h6" fontWeight={700} color="#020617">
								Preinscripciones recientes
							</Typography>
							<Button
								size="small"
								sx={{
									textTransform: "none",
									color: TERRACOTTA,
									fontWeight: 600,
								}}
								onClick={() => navigate("/preinscripciones")}
							>
								Ver todas
							</Button>
						</Stack>
						<List dense sx={{ pt: 0 }}>
							{recientes.length === 0 && (
								<Typography variant="body2" color="#020617">
									Aún no hay movimientos recientes.
								</Typography>
							)}
							{recientes.map((r) => (
								<ListItem
									key={r.codigo}
									sx={{
										px: 2,
										mb: 1.5,
										borderRadius: 3,
										border: "1px solid rgba(125,127,110,0.2)",
										cursor: "pointer",
										backgroundColor: "#fff",
									}}
									secondaryAction={estadoChip(r.estado)}
									onClick={() =>
										navigate(
											`/gestion/confirmar?codigo=${encodeURIComponent(r.codigo)}`,
										)
									}
								>
									<ListItemText
										primaryTypographyProps={{
											fontWeight: 600,
											color: "#020617",
										}}
										primary={`${r.estudiante.apellido}, ${r.estudiante.nombres} · ${r.carrera.nombre}`}
										secondaryTypographyProps={{ color: "#475569" }}
										secondary={`${r.codigo} · ${dayjs(r.fecha).format("DD/MM/YYYY")}`}
									/>
								</ListItem>
							))}
						</List>
					</CardBox>
				</Grid>
			</Grid>

			<Grid container spacing={3}>
				<Grid item xs={12} md={4}>
					<CardBox>
						<Typography variant="subtitle2" color="#020617">
							Confirmaciones del período
						</Typography>
						<Typography variant="h4" fontWeight={700} mt={1} color="#020617">
							{metrics.confirmadas} / {metrics.total || 1}
						</Typography>
						<LinearProgress
							variant="determinate"
							value={metrics.total ? metrics.ratio : 0}
							sx={{
								mt: 2,
								height: 8,
								borderRadius: 5,
								"& .MuiLinearProgress-bar": { backgroundColor: TERRACOTTA },
								backgroundColor: TERRACOTTA_TINT,
							}}
						/>
						<Typography variant="body2" color="#020617" mt={1}>
							{metrics.ratio}% de las preinscripciones ya están confirmadas.
						</Typography>
					</CardBox>
				</Grid>

				<Grid item xs={12} md={4}>
					<CardBox>
						<Typography variant="subtitle2" color="#020617">
							Estados en seguimiento
						</Typography>
						<Stack gap={1.5} mt={2}>
							<Stack direction="row" spacing={1} alignItems="center">
								<CheckCircleIcon fontSize="small" color="success" />
								<Typography variant="body2" color="#020617">
									Confirmadas
								</Typography>
								<Chip
									label={metrics.confirmadas}
									size="small"
									color="success"
								/>
							</Stack>
							<Stack direction="row" spacing={1} alignItems="center">
								<ScheduleIcon fontSize="small" color="warning" />
								<Typography variant="body2" color="#020617">
									Pendientes
								</Typography>
								<Chip label={metrics.pendientes} size="small" color="warning" />
							</Stack>
							<Stack direction="row" spacing={1} alignItems="center">
								<WarningAmberIcon fontSize="small" color="warning" />
								<Typography variant="body2" color="#020617">
									Observadas
								</Typography>
								<Chip
									label={metrics.observadas}
									size="small"
									color="warning"
									variant="outlined"
								/>
							</Stack>
							<Stack direction="row" spacing={1} alignItems="center">
								<CancelIcon fontSize="small" color="error" />
								<Typography variant="body2" color="#020617">
									Rechazadas
								</Typography>
								<Chip
									label={metrics.rechazadas}
									size="small"
									color="error"
									variant="outlined"
								/>
							</Stack>
						</Stack>
					</CardBox>
				</Grid>

				<Grid item xs={12} md={4}>
					<CardBox>
						<Typography variant="subtitle2" color="#020617">
							Próximos pasos sugeridos
						</Typography>
						<Stack spacing={1.5} mt={2}>
							<Button
								fullWidth
								variant="outlined"
								sx={{
									textTransform: "none",
									borderRadius: 999,
									borderColor: TERRACOTTA,
									color: TERRACOTTA,
								}}
								onClick={() => navigate("/preinscripciones")}
							>
								Revisar pendientes
							</Button>
							<Button
								fullWidth
								variant="outlined"
								sx={{
									textTransform: "none",
									borderRadius: 999,
									borderColor: TERRACOTTA,
									color: TERRACOTTA,
								}}
								onClick={() => navigate("/reportes")}
							>
								Descargar reportes
							</Button>
							<Button
								fullWidth
								variant="outlined"
								sx={{
									textTransform: "none",
									borderRadius: 999,
									borderColor: TERRACOTTA,
									color: TERRACOTTA,
								}}
								onClick={() => navigate("/carreras")}
							>
								Actualizar cohortes
							</Button>
						</Stack>
					</CardBox>
				</Grid>
			</Grid>
			<AdminCorrelativasWidget />
		</Stack>
	);
}
