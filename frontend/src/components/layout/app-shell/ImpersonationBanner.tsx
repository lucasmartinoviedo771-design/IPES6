import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getDefaultHomeRoute } from "@/utils/roles";
import { toast } from "@/utils/toast";

export const ImpersonationBanner: React.FC = () => {
	const navigate = useNavigate();
	const { user, stopImpersonate } = useAuth();
	const [loading, setLoading] = useState(false);

	if (!user?.is_impersonated) return null;

	const handleExit = async () => {
		setLoading(true);
		try {
			await stopImpersonate();
			toast.success("Has vuelto a tu sesión de Administrador.");
			try {
				sessionStorage.removeItem("roleOverride");
				localStorage.removeItem("ipes_active_role");
			} catch {
				/* ignore */
			}
			// Redirección completa para limpiar caches y estado de React
			window.location.href = "/dashboard";
		} catch (err: any) {
			toast.error(err.message || "Error al salir de la simulación.");
			setLoading(false);
		}
	};

	return (
		<Box
			sx={{
				position: "sticky",
				top: 64, // Justo debajo de la TopBar
				zIndex: (theme) => theme.zIndex.appBar - 1,
				backgroundColor: "#b45309", // Ámbar oscuro institucional de alerta
				color: "#ffffff",
				px: { xs: 2, sm: 3 },
				py: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 2,
				boxShadow: "0 4px 12px rgba(180, 83, 9, 0.35)",
				borderRadius: { xs: 0, sm: 2 },
				mb: 2,
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
				<VisibilityIcon sx={{ fontSize: 22, color: "#fef3c7" }} />
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					MODO SIMULACIÓN: Estás viendo el sistema como{" "}
					<span style={{ textDecoration: "underline", fontWeight: 700 }}>
						{user.name || user.dni} (DNI: {user.dni})
					</span>
					{user.original_admin_name && (
						<Typography
							component="span"
							variant="caption"
							sx={{ ml: 1, color: "#fef3c7", opacity: 0.9 }}
						>
							[Sesión Admin: {user.original_admin_name}]
						</Typography>
					)}
				</Typography>
			</Box>

			<Button
				variant="contained"
				size="small"
				onClick={handleExit}
				disabled={loading}
				startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ExitToAppIcon fontSize="small" />}
				sx={{
					backgroundColor: "#ffffff",
					color: "#b45309",
					fontWeight: 700,
					textTransform: "none",
					borderRadius: 8,
					px: 2,
					py: 0.5,
					"&:hover": {
						backgroundColor: "#fef3c7",
					},
					flexShrink: 0,
				}}
			>
				{loading ? "Saliendo..." : "Volver a Administrador"}
			</Button>
		</Box>
	);
};
