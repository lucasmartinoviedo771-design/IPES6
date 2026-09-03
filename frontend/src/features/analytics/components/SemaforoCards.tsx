import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SemaforoBreakdown } from "@/api/analytics";

interface SemaforoCardsProps {
	semaforo?: SemaforoBreakdown;
	nivelSeleccionado: string;
	onSelectNivel: (nivel: string) => void;
	loading: boolean;
}

export default function SemaforoCards({
	semaforo,
	nivelSeleccionado,
	onSelectNivel,
	loading,
}: SemaforoCardsProps) {
	if (loading || !semaforo) {
		return (
			<Grid container spacing={2.5} sx={{ mb: 4 }}>
				{[1, 2, 3].map((i) => (
					<Grid item xs={12} md={4} key={i}>
						<Skeleton variant="rounded" height={130} sx={{ borderRadius: 2 }} />
					</Grid>
				))}
			</Grid>
		);
	}

	const total = semaforo.total_evaluados || 1;
	const pctRojo = ((semaforo.rojo / total) * 100).toFixed(1);
	const pctAmarillo = ((semaforo.amarillo / total) * 100).toFixed(1);
	const pctVerde = ((semaforo.verde / total) * 100).toFixed(1);

	const cards = [
		{
			id: "rojo",
			titulo: "Riesgo Crítico",
			subtitulo: "Prioridad máxima de intervención",
			conteo: semaforo.rojo,
			porcentaje: pctRojo,
			icono: <ErrorOutlineIcon sx={{ fontSize: 36, color: "#DC2626" }} />,
			colorBg: "#FEF2F2",
			borderColor: "#EF4444",
			textColor: "#991B1B",
			badgeColor: "#FEE2E2",
			prioritario: true,
		},
		{
			id: "amarillo",
			titulo: "Riesgo Medio",
			subtitulo: "Alerta temprana y seguimiento",
			conteo: semaforo.amarillo,
			porcentaje: pctAmarillo,
			icono: <WarningAmberIcon sx={{ fontSize: 36, color: "#D97706" }} />,
			colorBg: "#FFFBEB",
			borderColor: "#F59E0B",
			textColor: "#92400E",
			badgeColor: "#FEF3C7",
			prioritario: false,
		},
		{
			id: "verde",
			titulo: "Trayectoria Regular",
			subtitulo: "Continuidad y rendimiento estándar",
			conteo: semaforo.verde,
			porcentaje: pctVerde,
			icono: <CheckCircleOutlineIcon sx={{ fontSize: 36, color: "#16A34A" }} />,
			colorBg: "#F0FDF4",
			borderColor: "#22C55E",
			textColor: "#166534",
			badgeColor: "#DCFCE7",
			prioritario: false,
		},
	];

	return (
		<Grid container spacing={2.5} sx={{ mb: 4 }}>
			{cards.map((card) => {
				const isSelected = nivelSeleccionado === card.id;

				return (
					<Grid item xs={12} md={4} key={card.id}>
						<Paper
							onClick={() => onSelectNivel(card.id)}
							sx={{
								p: 2.5,
								cursor: "pointer",
								bgcolor: card.colorBg,
								border: isSelected
									? `2.5px solid ${card.borderColor}`
									: "1px solid #e2e8f0",
								borderRadius: 2.5,
								transition: "all 0.2s ease-in-out",
								boxShadow: isSelected
									? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
									: "0 2px 6px rgba(15,23,42,0.04)",
								transform: isSelected ? "translateY(-2px)" : "none",
								"&:hover": {
									borderColor: card.borderColor,
									boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
									transform: "translateY(-2px)",
								},
							}}
						>
							<Stack direction="row" justifyContent="space-between" alignItems="flex-start">
								<Box>
									<Typography
										variant="caption"
										fontWeight={700}
										sx={{
											textTransform: "uppercase",
											letterSpacing: 0.8,
											color: card.textColor,
										}}
									>
										{card.titulo}
									</Typography>
									<Typography variant="h3" fontWeight={800} color={card.textColor} sx={{ my: 0.5 }}>
										{card.conteo.toLocaleString("es-AR")}
									</Typography>
									<Typography variant="body2" color="#64748b" fontWeight={500}>
										{card.porcentaje}% del alumnado
									</Typography>
								</Box>
								<Box
									sx={{
										p: 1,
										borderRadius: 2,
										bgcolor: card.badgeColor,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									{card.icono}
								</Box>
							</Stack>

							<Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed #cbd5e1" }}>
								<Typography variant="caption" fontWeight={600} color={card.textColor}>
									{isSelected ? "● Listado visible abajo" : "Clic para ver listado de estudiantes →"}
								</Typography>
							</Box>
						</Paper>
					</Grid>
				);
			})}
		</Grid>
	);
}
