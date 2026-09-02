import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Link, useNavigate } from "react-router-dom";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";
import { useAuth } from "@/context/AuthContext";
import { getDefaultHomeRoute } from "@/utils/roles";
import { toast } from "@/utils/toast";

interface SimularUsuarioModalProps {
	open: boolean;
	onClose: () => void;
}

export const SimularUsuarioModal: React.FC<SimularUsuarioModalProps> = ({
	open,
	onClose,
}) => {
	const navigate = useNavigate();
	const { impersonateUser } = useAuth();
	const [dni, setDni] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleClose = () => {
		if (loading) return;
		setDni("");
		setError(null);
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const cleanDni = dni.trim();
		if (!cleanDni) {
			setError("Ingresá un número de DNI o usuario válido.");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const targetUser = await impersonateUser(cleanDni);
			if (targetUser) {
				toast.success(
					`Simulación iniciada como ${targetUser.name || targetUser.dni}`
				);
				const targetHome = getDefaultHomeRoute(targetUser);
				// Recarga completa a la vista del usuario para resetear todo el árbol de React
				window.location.href = targetHome;
			}
		} catch (err: any) {
			setError(err.message || "Error al iniciar la simulación.");
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
			<form onSubmit={handleSubmit}>
				<DialogTitle sx={{ fontWeight: 700, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
					<VisibilityIcon sx={{ color: INSTITUTIONAL_TERRACOTTA }} />
					Simular Usuario (Ver como)
				</DialogTitle>
				<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
					<Typography variant="body2" color="text.secondary">
						Ingresá el DNI del <strong>Estudiante</strong> o <strong>Docente</strong> para ver la plataforma exactamente como la ve ese usuario.
					</Typography>

					{error && (
						<Alert severity="error" sx={{ fontSize: "0.85rem" }}>
							{error}
						</Alert>
					)}

					<TextField
						label="DNI / Usuario"
						placeholder="Ej: 38528474"
						value={dni}
						onChange={(e) => setDni(e.target.value)}
						disabled={loading}
						fullWidth
						autoFocus
						required
						size="small"
					/>
				</DialogContent>
				<DialogActions sx={{ p: 2, pt: 0 }}>
					<Button onClick={handleClose} disabled={loading} color="inherit">
						Cancelar
					</Button>
					<Button
						type="submit"
						variant="contained"
						disabled={loading || !dni.trim()}
						sx={{
							backgroundColor: INSTITUTIONAL_TERRACOTTA,
							"&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
						}}
					>
						{loading ? <CircularProgress size={20} color="inherit" /> : "Iniciar Simulación"}
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
};
