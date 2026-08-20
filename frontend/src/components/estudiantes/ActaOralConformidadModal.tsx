import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import GavelIcon from "@mui/icons-material/Gavel";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SchoolIcon from "@mui/icons-material/School";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";
import React, { useEffect, useMemo, useState } from "react";
import {
	type ActaOralPendienteConformidadDTO,
	listarActasPendientesConformidad,
	responderConformidadActaOral,
} from "@/api/cargaNotas";
import { useAuth } from "@/context/AuthContext";
import { isOnlyEstudiante } from "@/utils/roles";

export const ActaOralConformidadModal: React.FC = () => {
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const isEstudiante = useMemo(() => {
		if (!user) return false;
		const roles = (user.roles ?? []).map((r) => r.toLowerCase().trim());
		return roles.includes("estudiante") || isOnlyEstudiante(user);
	}, [user]);

	const {
		data: actasPendientes = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["actas-orales", "pendientes-conformidad"],
		queryFn: listarActasPendientesConformidad,
		enabled: !!user && isEstudiante,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});

	const [currentIndex, setCurrentIndex] = useState(0);
	const [observacionesDisconforme, setObservacionesDisconforme] = useState("");
	const [showDisconformeForm, setShowDisconformeForm] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const currentActa: ActaOralPendienteConformidadDTO | undefined =
		actasPendientes[currentIndex];

	// Temporizador regresivo en segundos basado en el valor inicial del backend
	const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

	useEffect(() => {
		if (!currentActa) return;
		setRemainingSeconds(Math.max(0, currentActa.segundos_restantes));
		setObservacionesDisconforme("");
		setShowDisconformeForm(false);
	}, [currentActa?.acta_id, currentActa?.segundos_restantes]);

	useEffect(() => {
		if (remainingSeconds <= 0 || !currentActa) return;

		const timer = setInterval(() => {
			setRemainingSeconds((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					// Revalidar con el backend (que cerrará automáticamente por timeout)
					refetch();
					enqueueSnackbar(
						"La ventana de 10 minutos ha finalizado. El acta quedó asentada sin objeción.",
						{ variant: "info" },
					);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [remainingSeconds, currentActa, refetch]);

	const formatTimer = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	};

	const handleResponder = async (
		conformidad: "CON" | "DIS",
		observaciones?: string,
	) => {
		if (!currentActa || submitting) return;

		setSubmitting(true);
		try {
			const res = await responderConformidadActaOral(currentActa.acta_id, {
				conformidad,
				observaciones: observaciones?.trim() || undefined,
			});

			if (res.ok) {
				enqueueSnackbar(
					conformidad === "CON"
						? "Conformidad registrada exitosamente."
						: "Disconformidad registrada correctamente.",
					{ variant: conformidad === "CON" ? "success" : "warning" },
				);
			}

			await queryClient.invalidateQueries({
				queryKey: ["actas-orales", "pendientes-conformidad"],
			});
			const updated = await refetch();

			if (updated.data && updated.data.length > 0) {
				setCurrentIndex(0);
			}
		} catch (error: any) {
			const msg =
				error?.response?.data?.message ||
				error?.message ||
				"Ocurrió un error al procesar la respuesta.";
			enqueueSnackbar(msg, { variant: "error" });
			await refetch();
		} finally {
			setSubmitting(false);
		}
	};

	if (!isEstudiante || actasPendientes.length === 0 || !currentActa) {
		return null;
	}

	const totalPendientes = actasPendientes.length;
	const timerPercent = Math.max(
		0,
		Math.min(100, (remainingSeconds / 600) * 100),
	);

	return (
		<Dialog
			open={true}
			fullWidth
			maxWidth="md"
			disableEscapeKeyDown
			PaperProps={{
				sx: {
					borderRadius: 3,
					p: { xs: 1, sm: 2 },
					boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
					border: "2px solid #3b82f6",
				},
			}}
		>
			<DialogTitle sx={{ pb: 1 }}>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", sm: "center" }}
					gap={1}
				>
					<Stack direction="row" alignItems="center" spacing={1.5}>
						<GavelIcon color="primary" sx={{ fontSize: 32 }} />
						<Box>
							<Typography variant="h6" fontWeight={700}>
								Devolución y Conformidad de Acta Oral
							</Typography>
							<Typography variant="caption" color="text.secondary">
								Disposición Institucional - Anexo I (Mesa de Examen)
							</Typography>
						</Box>
					</Stack>

					<Chip
						icon={<AccessTimeIcon />}
						label={`Tiempo restante: ${formatTimer(remainingSeconds)}`}
						color={
							remainingSeconds < 120
								? "error"
								: remainingSeconds < 300
									? "warning"
									: "primary"
						}
						sx={{ fontWeight: 700, fontSize: "0.95rem", py: 2 }}
					/>
				</Stack>

				<LinearProgress
					variant="determinate"
					value={timerPercent}
					color={
						remainingSeconds < 120
							? "error"
							: remainingSeconds < 300
								? "warning"
								: "primary"
					}
					sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
				/>

				{totalPendientes > 1 && (
					<Typography
						variant="subtitle2"
						color="primary.main"
						fontWeight={600}
						sx={{ mt: 1 }}
					>
						Acta {currentIndex + 1} de {totalPendientes} pendientes
					</Typography>
				)}
			</DialogTitle>

			<Divider />

			<DialogContent sx={{ py: 2 }}>
				<Stack spacing={2.5}>
					<Alert severity="info" icon={<ReportProblemIcon />}>
						<Typography variant="body2">
							El tribunal docente ha cargado la devolución de su examen oral.
							Dispone de una ventana institucional de <b>10 minutos</b> desde la
							carga para manifestar su conformidad o disconformidad. Pasado
							dicho lapso, el acta se cerrará automáticamente como notificada y
							sin objeción.
						</Typography>
					</Alert>

					{/* Encabezado del Examen */}
					<Paper
						variant="outlined"
						sx={{ p: 2, backgroundColor: "#f8fafc", borderRadius: 2 }}
					>
						<Stack spacing={1}>
							<Typography variant="h6" color="primary.dark" fontWeight={700}>
								{currentActa.materia_nombre}
							</Typography>
							{currentActa.profesorado_nombre && (
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{ display: "flex", alignItems: "center", gap: 1 }}
								>
									<SchoolIcon fontSize="small" />{" "}
									{currentActa.profesorado_nombre}
								</Typography>
							)}

							<Stack
								direction={{ xs: "column", sm: "row" }}
								spacing={2}
								sx={{ mt: 0.5 }}
							>
								<Typography variant="body2">
									<b>Fecha:</b>{" "}
									{currentActa.fecha
										? dayjs(currentActa.fecha).format("DD/MM/YYYY")
										: "S/D"}
								</Typography>
								{currentActa.curso && (
									<Typography variant="body2">
										<b>Comisión/Curso:</b> {currentActa.curso}
									</Typography>
								)}
								{currentActa.tribunal && currentActa.tribunal.length > 0 && (
									<Typography variant="body2">
										<b>Tribunal:</b> {currentActa.tribunal.join(" | ")}
									</Typography>
								)}
							</Stack>
						</Stack>
					</Paper>

					{/* Temas evaluados */}
					{(currentActa.temas_estudiante.length > 0 ||
						currentActa.temas_docente.length > 0) && (
						<TableContainer
							component={Paper}
							variant="outlined"
							sx={{ borderRadius: 2 }}
						>
							<Table size="small">
								<TableHead sx={{ backgroundColor: "#f1f5f9" }}>
									<TableRow>
										<TableCell sx={{ fontWeight: 700 }}>
											Temas Evaluados
										</TableCell>
										<TableCell sx={{ fontWeight: 700, width: 140 }}>
											Origen
										</TableCell>
										<TableCell
											align="center"
											sx={{ fontWeight: 700, width: 160 }}
										>
											Calificación
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{currentActa.temas_estudiante.map((t, i) => (
										<TableRow key={`est-${i}`}>
											<TableCell>{t.tema}</TableCell>
											<TableCell>
												<Chip
													label="Estudiante"
													size="small"
													variant="outlined"
												/>
											</TableCell>
											<TableCell align="center">
												<Chip
													label={t.score || "-"}
													size="small"
													color="primary"
												/>
											</TableCell>
										</TableRow>
									))}
									{currentActa.temas_docente.map((t, i) => (
										<TableRow key={`doc-${i}`}>
											<TableCell>{t.tema}</TableCell>
											<TableCell>
												<Chip
													label="Docente"
													size="small"
													variant="outlined"
													color="secondary"
												/>
											</TableCell>
											<TableCell align="center">
												<Chip
													label={t.score || "-"}
													size="small"
													color="primary"
												/>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}

					{/* Nota y Observaciones */}
					<Paper
						elevation={0}
						sx={{
							p: 2,
							backgroundColor: "#eff6ff",
							border: "1px solid #bfdbfe",
							borderRadius: 2,
						}}
					>
						<Stack
							direction={{ xs: "column", sm: "row" }}
							justifyContent="space-between"
							alignItems={{ xs: "flex-start", sm: "center" }}
							spacing={1}
						>
							<Typography variant="subtitle1" fontWeight={700} color="#1e40af">
								Calificación Definitiva:
							</Typography>
							<Chip
								label={currentActa.nota_final || "Sin calificar"}
								sx={{
									fontSize: "1.1rem",
									fontWeight: 800,
									height: 36,
									px: 1,
									backgroundColor: "#1e40af",
									color: "#ffffff",
								}}
							/>
						</Stack>

						{currentActa.observaciones_docente && (
							<Box sx={{ mt: 1.5 }}>
								<Typography
									variant="caption"
									fontWeight={700}
									color="text.secondary"
								>
									OBSERVACIONES DEL TRIBUNAL:
								</Typography>
								<Typography
									variant="body2"
									sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
								>
									{currentActa.observaciones_docente}
								</Typography>
							</Box>
						)}
					</Paper>

					{/* Formulario de Disconformidad si se solicita */}
					{showDisconformeForm && (
						<Paper
							elevation={0}
							sx={{
								p: 2,
								backgroundColor: "#fff7ed",
								border: "1px solid #ffedd5",
								borderRadius: 2,
							}}
						>
							<Typography
								variant="subtitle2"
								fontWeight={700}
								color="warning.dark"
								gutterBottom
							>
								Indique el motivo de la disconformidad:
							</Typography>
							<TextField
								fullWidth
								multiline
								rows={3}
								placeholder="Escriba aquí los fundamentos u objeciones respecto a la evaluación..."
								value={observacionesDisconforme}
								onChange={(e) => setObservacionesDisconforme(e.target.value)}
								sx={{ backgroundColor: "#ffffff" }}
							/>
						</Paper>
					)}
				</Stack>
			</DialogContent>

			<Divider />

			<DialogActions sx={{ p: 2, gap: 1 }}>
				{!showDisconformeForm ? (
					<>
						<Button
							variant="outlined"
							color="warning"
							onClick={() => setShowDisconformeForm(true)}
							disabled={submitting || remainingSeconds <= 0}
						>
							Notificado y en disconformidad
						</Button>
						<Button
							variant="contained"
							color="success"
							startIcon={
								submitting ? (
									<CircularProgress size={20} color="inherit" />
								) : (
									<CheckCircleIcon />
								)
							}
							onClick={() => handleResponder("CON")}
							disabled={submitting || remainingSeconds <= 0}
							sx={{ fontWeight: 700, px: 3 }}
						>
							Notificado y sin objeción
						</Button>
					</>
				) : (
					<>
						<Button
							variant="text"
							color="inherit"
							onClick={() => setShowDisconformeForm(false)}
							disabled={submitting}
						>
							Volver
						</Button>
						<Button
							variant="contained"
							color="warning"
							startIcon={
								submitting ? (
									<CircularProgress size={20} color="inherit" />
								) : (
									<ErrorOutlineIcon />
								)
							}
							onClick={() =>
								handleResponder("DIS", observacionesDisconforme)
							}
							disabled={submitting || remainingSeconds <= 0}
							sx={{ fontWeight: 700 }}
						>
							Confirmar Disconformidad
						</Button>
					</>
				)}
			</DialogActions>
		</Dialog>
	);
};

export default ActaOralConformidadModal;
