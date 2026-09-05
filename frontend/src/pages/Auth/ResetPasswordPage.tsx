import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "@/api/auth";
import ipesLogoDark from "@/assets/ipes-logo-dark.png";
import { PageHero } from "@/components/ui/GradientTitles";

export default function ResetPasswordPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token") ?? "";

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!token) {
			setError("El link de recuperación es inválido. Pedí uno nuevo.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("Las contraseñas no coinciden.");
			return;
		}

		setLoading(true);
		try {
			await confirmPasswordReset(token, newPassword);
			setDone(true);
			setTimeout(() => navigate("/login", { replace: true }), 2500);
		} catch (err: any) {
			const message =
				err?.response?.data?.message ||
				err?.response?.data?.detail ||
				err?.message ||
				"No se pudo restablecer la contraseña.";
			setError(message);
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
							title="Nueva contraseña"
							subtitle="Definí tu nueva contraseña para ingresar"
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

						{!token ? (
							<Alert severity="error">
								El link de recuperación es inválido o incompleto. Pedí uno
								nuevo desde{" "}
								<Link component={RouterLink} to="/olvide-password" sx={{ color: "#fff" }}>
									esta página
								</Link>
								.
							</Alert>
						) : done ? (
							<Alert severity="success">
								Contraseña actualizada. Te llevamos al login...
							</Alert>
						) : (
							<form onSubmit={handleSubmit} autoComplete="off">
								<Stack spacing={2.5}>
									<TextField
										label="Contraseña nueva"
										type={showPassword ? "text" : "password"}
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										autoComplete="new-password"
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
											endAdornment: (
												<InputAdornment position="end">
													<IconButton
														aria-label="toggle password visibility"
														onClick={() => setShowPassword((s) => !s)}
														edge="end"
														sx={{ color: "#fff" }}
													>
														{showPassword ? <VisibilityOff /> : <Visibility />}
													</IconButton>
												</InputAdornment>
											),
										}}
									/>

									<Box sx={{ pb: 1 }}>
										<Stack spacing={0.5} sx={{ px: 1 }}>
											{[
												{ label: "Mínimo 8 caracteres", met: newPassword.length >= 8 },
												{ label: "Al menos una letra", met: /[a-zA-Z]/.test(newPassword) },
												{ label: "Al menos un número", met: /[0-9]/.test(newPassword) },
											].map((req, idx) => (
												<Stack key={idx} direction="row" spacing={1} alignItems="center">
													<Box
														sx={{
															width: 6,
															height: 6,
															borderRadius: "50%",
															bgcolor:
																newPassword === ""
																	? "rgba(255,255,255,0.3)"
																	: req.met
																		? "success.main"
																		: "error.light",
														}}
													/>
													<Typography
														variant="caption"
														sx={{
															color:
																newPassword === ""
																	? "rgba(255,255,255,0.6)"
																	: req.met
																		? "success.light"
																		: "error.light",
															fontSize: "0.7rem",
														}}
													>
														{req.label}
													</Typography>
												</Stack>
											))}
										</Stack>
									</Box>

									<TextField
										label="Confirmar contraseña nueva"
										type={showPassword ? "text" : "password"}
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										autoComplete="new-password"
										required
										fullWidth
										variant="filled"
										error={confirmPassword !== "" && newPassword !== confirmPassword}
										helperText={
											confirmPassword !== "" && newPassword !== confirmPassword
												? "Las contraseñas no coinciden"
												: ""
										}
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
										disabled={
											loading ||
											newPassword.length < 8 ||
											newPassword !== confirmPassword ||
											!/[a-zA-Z]/.test(newPassword) ||
											!/[0-9]/.test(newPassword)
										}
										sx={{
											mt: 1,
											py: 1.5,
											borderRadius: 3,
											textTransform: "none",
											fontSize: "1rem",
											background: "linear-gradient(135deg,#4776E6,#8E54E9)",
											boxShadow: "0 20px 40px rgba(71,118,230,0.35)",
											"&:disabled": { opacity: 0.5 },
										}}
									>
										{loading ? "Guardando..." : "Restablecer contraseña"}
									</Button>
								</Stack>
							</form>
						)}
					</Stack>
				</Paper>
			</Stack>
		</Box>
	);
}
