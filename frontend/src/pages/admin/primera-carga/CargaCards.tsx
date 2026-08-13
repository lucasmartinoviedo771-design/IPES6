import AssignmentLateIcon from "@mui/icons-material/AssignmentLate";
import CompareArrows from "@mui/icons-material/CompareArrows";
import FileCopy from "@mui/icons-material/FileCopy";
import HistoryIcon from "@mui/icons-material/History";
import PersonAdd from "@mui/icons-material/PersonAdd";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { SectionTitlePill } from "@/components/ui/GradientTitles";

import {
	ICON_GRADIENT,
	INSTITUTIONAL_TERRACOTTA,
	INSTITUTIONAL_TERRACOTTA_DARK,
} from "@/styles/institutionalColors";

type Props = {
	onOpenStudentDialog: () => void;
	onOpenPlanillaDialog: () => void;
	onOpenMesaPandemiaDialog: () => void;
	onOpenDisposicionDialog: () => void;
};

const iconBoxStyles = {
	width: 52,
	height: 52,
	borderRadius: "12px",
	background: ICON_GRADIENT,
	color: "common.white",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	boxShadow: "0 4px 12px rgba(156, 78, 53, 0.3)",
};

const cardStyles = {
	height: "100%",
	borderRadius: "14px",
	border: "1px solid #D6CAA",
	boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
	backgroundColor: "#ffffff",
	transition: "all 0.2s ease-in-out",
	"&:hover": {
		borderColor: INSTITUTIONAL_TERRACOTTA,
		boxShadow: "0 8px 20px rgba(140, 67, 46, 0.18)",
		transform: "translateY(-3px)",
	},
};

const CargaCards: React.FC<Props> = ({
	onOpenStudentDialog,
	onOpenPlanillaDialog,
	onOpenMesaPandemiaDialog,
	onOpenDisposicionDialog,
}) => {
	const navigate = useNavigate();

	return (
		<Box
			sx={{
				position: "relative",
				backgroundColor: "#E8DFD3",
				border: "1px solid #D6CAA",
				borderRadius: "20px",
				p: { xs: 2, md: 3 },
				pt: { xs: 3.5, md: 4 },
				boxShadow: "0 4px 15px rgba(0, 0, 0, 0.03)",
			}}
		>
			<SectionTitlePill title="MODULOS DE PRIMERA CARGA DE DATOS" />

			<Grid container spacing={3}>
				{/* ── Carga de Estudiantes ── */}
				<Grid item xs={12} md={6} lg={3}>
					<Card sx={cardStyles}>
						<CardContent
							sx={{ height: "100%", display: "flex", flexDirection: "column" }}
						>
							<Stack spacing={2.5} sx={{ height: "100%" }}>
								<Box sx={iconBoxStyles}>
									<PersonAdd fontSize="medium" />
								</Box>
								<Box>
									<Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.05rem" }}>
										Carga de Estudiantes
									</Typography>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
										Registre estudiantes sin preinscripción previa completando los
										datos disponibles.
									</Typography>
								</Box>
								<Button
									variant="contained"
									fullWidth
									sx={{
										mt: "auto",
										borderRadius: 999,
										backgroundColor: INSTITUTIONAL_TERRACOTTA,
										"&:hover": { backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK },
									}}
									onClick={onOpenStudentDialog}
								>
									Registrar estudiante
								</Button>
							</Stack>
						</CardContent>
					</Card>
				</Grid>

				{/* ── Regularidades ── */}
				<Grid item xs={12} md={6} lg={3}>
					<Card sx={cardStyles}>
						<CardContent
							sx={{ height: "100%", display: "flex", flexDirection: "column" }}
						>
							<Stack spacing={2.5} sx={{ height: "100%" }}>
								<Box sx={iconBoxStyles}>
									<FileCopy fontSize="medium" />
								</Box>
								<Box>
									<Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.05rem" }}>
										Regularidades
									</Typography>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
										Registrá regularidades mediante planillas para comisiones o
										cargas individuales.
									</Typography>
								</Box>
								<Stack spacing={1.5} sx={{ mt: "auto" }}>
									<Button
										variant="contained"
										fullWidth
										sx={{
											borderRadius: 999,
											backgroundColor: INSTITUTIONAL_TERRACOTTA,
											"&:hover": {
												backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
											},
										}}
										onClick={onOpenPlanillaDialog}
									>
										Planilla Completa
									</Button>
									<Button
										variant="outlined"
										fullWidth
										sx={{
											borderRadius: 999,
											borderColor: INSTITUTIONAL_TERRACOTTA,
											color: INSTITUTIONAL_TERRACOTTA,
											"&:hover": { borderColor: INSTITUTIONAL_TERRACOTTA_DARK },
										}}
										onClick={() =>
											navigate("/admin/primera-carga/historico-regularidad")
										}
									>
										Planilla Individual
									</Button>
									<Button
										variant="text"
										fullWidth
										sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
										onClick={() =>
											navigate("/admin/primera-carga/historial-regularidades")
										}
									>
										Ver Histórico
									</Button>
								</Stack>
							</Stack>
						</CardContent>
					</Card>
				</Grid>

				{/* ── Actas de Examen Final ── */}
				<Grid item xs={12} md={6} lg={3}>
					<Card sx={cardStyles}>
						<CardContent
							sx={{ height: "100%", display: "flex", flexDirection: "column" }}
						>
							<Stack spacing={2.5} sx={{ height: "100%" }}>
								<Box sx={iconBoxStyles}>
									<HistoryIcon fontSize="medium" />
								</Box>
								<Box>
									<Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.05rem" }}>
										Actas de Examen Final
									</Typography>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
										Emití actas de exámenes finales y consultá su historial de
										carga masiva.
									</Typography>
								</Box>
								<Stack spacing={1.5} sx={{ mt: "auto" }}>
									<Button
										variant="contained"
										fullWidth
										sx={{
											borderRadius: 999,
											backgroundColor: INSTITUTIONAL_TERRACOTTA,
											"&:hover": {
												backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
											},
										}}
										onClick={() => navigate("/admin/primera-carga/actas-examen")}
									>
										Registrar Actas
									</Button>
									<Button
										variant="text"
										fullWidth
										sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
										onClick={() =>
											navigate("/admin/primera-carga/historial-actas")
										}
									>
										Ver Historial
									</Button>
								</Stack>
							</Stack>
						</CardContent>
					</Card>
				</Grid>

				{/* ── Notas de Mesa – Pandemia ── */}
				<Grid item xs={12} md={6} lg={3}>
					<Card sx={cardStyles}>
						<CardContent
							sx={{ height: "100%", display: "flex", flexDirection: "column" }}
						>
							<Stack spacing={2.5} sx={{ height: "100%" }}>
								<Box
									sx={{
										...iconBoxStyles,
										background:
											"linear-gradient(135deg, #b06000 0%, #7a3b00 100%)",
									}}
								>
									<AssignmentLateIcon fontSize="medium" />
								</Box>
								<Box>
									<Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.05rem" }}>
										Notas de Mesa — Pandemia
									</Typography>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
										Cargá notas de mesas tomadas durante el período especial 2020.
										Folio/Libro se marcan como <strong>PANDEMIA</strong>.
									</Typography>
								</Box>
								<Stack spacing={1.5} sx={{ mt: "auto" }}>
									<Button
										variant="contained"
										fullWidth
										sx={{
											borderRadius: 999,
											backgroundColor: "#b06000",
											"&:hover": { backgroundColor: "#7a3b00" },
										}}
										onClick={onOpenMesaPandemiaDialog}
									>
										Registrar Notas
									</Button>
									<Button
										variant="text"
										fullWidth
										sx={{ borderRadius: 999, color: "#b06000" }}
										onClick={() =>
											navigate("/admin/primera-carga/historial-mesas-pandemia")
										}
									>
										Ver Historial
									</Button>
								</Stack>
							</Stack>
						</CardContent>
					</Card>
				</Grid>

				{/* ── Equivalencias ── */}
				<Grid item xs={12} md={6} lg={3}>
					<Card sx={cardStyles}>
						<CardContent
							sx={{ height: "100%", display: "flex", flexDirection: "column" }}
						>
							<Stack spacing={2.5} sx={{ height: "100%" }}>
								<Box sx={iconBoxStyles}>
									<CompareArrows fontSize="medium" />
								</Box>
								<Box>
									<Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.05rem" }}>
										Equivalencias
									</Typography>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
										Registrá disposiciones de equivalencia sin validación de
										correlativas.
									</Typography>
								</Box>
								<Stack spacing={1.5} sx={{ mt: "auto" }}>
									<Button
										variant="contained"
										fullWidth
										sx={{
											borderRadius: 999,
											backgroundColor: INSTITUTIONAL_TERRACOTTA,
											"&:hover": {
												backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
											},
										}}
										onClick={onOpenDisposicionDialog}
									>
										Registrar Equivalencia
									</Button>
									<Button
										variant="text"
										fullWidth
										sx={{ borderRadius: 999, color: INSTITUTIONAL_TERRACOTTA }}
										onClick={() =>
											navigate("/admin/primera-carga/historial-equivalencias")
										}
									>
										Ver Historial
									</Button>
								</Stack>
							</Stack>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Box>
	);
};

export default CargaCards;
