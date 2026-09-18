import LockResetIcon from "@mui/icons-material/LockReset";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type React from "react";
import { useState } from "react";
import { client as axios } from "@/api/client";
import {
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";

export const ForcedResetWidget: React.FC = () => {
	const [dni, setDni] = useState("");
	const [password, setPassword] = useState("");
	const [email, setEmail] = useState("");
	const [requiresEmail, setRequiresEmail] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const handleReset = async () => {
		if (!dni.trim()) {
			setError("Ingrese un DNI");
			return;
		}
		if (requiresEmail && !email.trim()) {
			setError("Ingrese el correo electrónico para enviarle las credenciales.");
			return;
		}
		setLoading(true);
		setError(null);
		setSuccess(null);
		try {
			const res = await axios.post("staff/force-password-reset", {
				username: dni.trim(),
				new_password: password.trim() || null,
				email: email.trim() || null,
			});
			setSuccess(res.data.message);
			setDni("");
			setPassword("");
			setEmail("");
			setRequiresEmail(false);
		} catch (err: unknown) {
			const e = err as {
				response?: { data?: { message?: string; requires_email?: boolean } };
				message?: string;
			};
			if (e?.response?.data?.requires_email) {
				setRequiresEmail(true);
			}
			setError(e?.response?.data?.message || e?.message || "Error al resetear");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Paper
			elevation={0}
			sx={{
				p: 3,
				borderRadius: 4,
				bgcolor: "#fff",
				border: "1px solid rgba(183,105,78,0.2)",
				boxShadow: "0 10px 25px rgba(183,105,78,0.08)",
			}}
		>
			<Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
				<Box
					sx={{
						p: 1,
						borderRadius: 2,
						bgcolor: "rgba(183,105,78,0.1)",
						color: INSTITUTIONAL_TERRACOTTA,
					}}
				>
					<LockResetIcon />
				</Box>
				<Box>
					<Typography
						variant="subtitle1"
						fontWeight={700}
						color={INSTITUTIONAL_TERRACOTTA_DARK}
					>
						Reseteo de Acceso Rápido
					</Typography>
					<Typography variant="caption" color="text.secondary">
						Habilitación y entrega de clave temporal por correo
					</Typography>
				</Box>
			</Stack>

			<Stack spacing={2}>
				<Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
					<TextField
						size="small"
						label="DNI"
						placeholder="Sin puntos"
						fullWidth
						value={dni}
						onChange={(e) => {
							setDni(e.target.value);
							setRequiresEmail(false);
							setError(null);
						}}
					/>
					<TextField
						size="small"
						label="Clave (opcional)"
						placeholder="Temporal aleatoria"
						fullWidth
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</Box>

				{requiresEmail && (
					<TextField
						size="small"
						label="Correo Electrónico (Requerido)"
						placeholder="usuario@ejemplo.com"
						type="email"
						fullWidth
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						helperText="Este usuario no tiene correo registrado. Se guardará en la base de datos y se le enviarán las credenciales."
						error={Boolean(error && !email.trim())}
					/>
				)}

				<Button
					variant="contained"
					fullWidth
					startIcon={
						loading ? (
							<CircularProgress size={20} color="inherit" />
						) : (
							<LockResetIcon />
						)
					}
					onClick={handleReset}
					disabled={loading || !dni.trim()}
					sx={{
						bgcolor: INSTITUTIONAL_TERRACOTTA,
						"&:hover": { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK },
						borderRadius: 2,
						py: 1,
					}}
				>
					{loading ? "Procesando..." : requiresEmail ? "Guardar Correo y Resetear" : "Resetear Acceso"}
				</Button>

				{error && (
					<Alert severity={requiresEmail ? "warning" : "error"} sx={{ py: 0 }}>
						{error}
					</Alert>
				)}
				{success && (
					<Alert severity="success" sx={{ py: 0 }}>
						{success}
					</Alert>
				)}
			</Stack>
		</Paper>
	);
};
