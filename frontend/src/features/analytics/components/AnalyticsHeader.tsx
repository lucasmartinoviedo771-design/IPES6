import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import "dayjs/locale/es";

dayjs.locale("es");

interface AnalyticsHeaderProps {
	fechaActualizacion: string | null;
}

export default function AnalyticsHeader({ fechaActualizacion }: AnalyticsHeaderProps) {
	const fechaTexto = fechaActualizacion
		? dayjs(fechaActualizacion).format("DD/MM/YYYY")
		: "Pendiente de primer cálculo";

	return (
		<Box
			sx={{
				p: 2,
				mb: 3,
				bgcolor: "#ffffff",
				borderRadius: 2,
				border: "1px solid #e2e8f0",
				boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
				display: "flex",
				flexDirection: { xs: "column", sm: "row" },
				justifyContent: "space-between",
				alignItems: { xs: "flex-start", sm: "center" },
				gap: 2,
			}}
		>
			<Stack direction="row" spacing={1.5} alignItems="center">
				<Chip
					icon={<AccessTimeIcon sx={{ fontSize: 18 }} />}
					label={`Datos actualizados al: ${fechaTexto} (cálculo nocturno diario)`}
					variant="outlined"
					sx={{
						borderColor: "#cbd5e1",
						color: "#475569",
						fontWeight: 500,
						fontSize: "0.875rem",
						"& .MuiChip-icon": { color: "#64748b" },
					}}
				/>
			</Stack>

			<Tooltip title="El recálculo automático se ejecuta todas las noches a las 03:00 AM. La opción de disparo manual estará disponible próximamente." arrow>
				<span>
					<Button
						variant="outlined"
						disabled
						size="small"
						startIcon={<AutorenewIcon />}
						sx={{
							textTransform: "none",
							fontWeight: 600,
							borderColor: "#cbd5e1",
							color: "#94a3b8",
						}}
					>
						Recalcular ahora
					</Button>
				</span>
			</Tooltip>
		</Box>
	);
}
