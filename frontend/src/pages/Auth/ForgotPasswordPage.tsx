import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { requestPasswordReset } from "@/api/auth";
import ipesLogoDark from "@/assets/ipes-logo-dark.png";
import { PageHero } from "@/components/ui/GradientTitles";

export default function ForgotPasswordPage() {
	const [login, setLogin] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!login.trim()) {
			setError("Ingresá tu DNI o usuario.");
			return;
		}
		setLoading(true);
		try {
			await requestPasswordReset(login.trim());
			setSent(true);
		} catch (err: any) {
			// El backend responde siempre el mismo mensaje genérico, así que
			// llegar acá solo pasa ante un error real (red, servidor caído, etc.)
			setError(
				err?.response?.data?.message ||
					err?.message ||
					"No se pudo procesar el pedido. Intentá de nuevo más tarde.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box
			sx={{
				minHeight: "100vh",
				backgroundColor: "#070d1f",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				py: 8,
				px: 2,
			}}
		>
			<Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 420 }}>
				<Box
					component="img"
					src={ipesLogoDark}
					alt="IPES Paulo Freire"
					sx={{ height: 96, maxWidth: "100%", objectFit: "contain" }}
				/>

				<Paper
					elevation={0}
					sx={{
						width: "100%",
						borderRadius: 4,
						p: { xs: 2, sm: 4 },
						background: "rgba(19,25,48,0.85)",
						border: "1px solid rgba(255,255,255,0.1)",
						color: "#fff",
						backdropFilter: "blur(30px)",
					}}
				>
					<Stack spacing={3}>
						<PageHero
							title="Recuperar contraseña"
							subtitle="Te enviamos un link para definir una nueva"
							sx={{
								width: "100%",
								boxShadow: "none",
								borderRadius: 3,
								background:
									"linear-gradient(135deg, rgba(125,127,110,0.95), rgba(183,105,78,0.95))",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								textAlign: "center",
							}}
						/>

						{sent ? (
							<Stack spacing={2}>
								<Alert severity="success">
									Si el usuario existe, te enviamos un email con instrucciones
									para definir una nueva contraseña. Revisá también la carpeta
									de spam.
								</Alert>
								<Link
									component={RouterLink}
									to="/login"
									sx={{ color: "#fff", textAlign: "center" }}
								>
									Volver a iniciar sesión
								</Link>
							</Stack>
						) : (
							<form onSubmit={handleSubmit} autoComplete="off">
								<Stack spacing={2.5}>
									<Typography
										variant="body2"
										sx={{ color: "rgba(255,255,255,0.75)" }}
									>
										Ingresá tu DNI o usuario. Si tenés un email cargado en el
										sistema, te mandamos un link para definir una contraseña
										nueva.
									</Typography>
									<TextField
										label="DNI o usuario"
										value={login}
										onChange={(e) => setLogin(e.target.value)}
										autoComplete="off"
										required
										fullWidth
										variant="filled"
										InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
										InputProps={{
											sx: {
												borderRadius: 3,
												backgroundColor: "rgba(255,255,255,0.08)",
												color: "#fff",
												"& .MuiFilledInput-input": { color: "#fff" },
												"&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
											},
										}}
									/>
									{error && <Alert severity="error">{error}</Alert>}
									<Button
										type="submit"
										variant="contained"
										fullWidth
										disabled={loading}
										sx={{
											mt: 1,
											py: 1.5,
											borderRadius: 3,
											textTransform: "none",
											fontSize: "1rem",
											background: "linear-gradient(135deg,#4776E6,#8E54E9)",
											boxShadow: "0 20px 40px rgba(71,118,230,0.35)",
										}}
									>
										{loading ? "Enviando..." : "Enviar link de recuperación"}
									</Button>
									<Link
										component={RouterLink}
										to="/login"
										sx={{
											color: "rgba(255,255,255,0.7)",
											textAlign: "center",
											fontSize: "0.875rem",
										}}
									>
										Volver a iniciar sesión
									</Link>
								</Stack>
							</form>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Box>
	);
}
