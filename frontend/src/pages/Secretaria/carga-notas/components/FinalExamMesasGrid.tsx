import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EditIcon from "@mui/icons-material/Edit";
import GroupIcon from "@mui/icons-material/Group";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import type React from "react";
import type { MesaResumenDTO } from "@/api/cargaNotas";
import type { FinalFiltersState } from "../types";

type Props = {
	finalMesas: MesaResumenDTO[];
	finalSelectedMesaId: number | null;
	finalLoadingMesas: boolean;
	finalLoadingPlanilla: boolean;
	estadoPlanilla: FinalFiltersState["estadoPlanilla"];
	onOpenFinalPlanilla: (mesaId: number) => void;
	isDocente?: boolean;
};

type ProximidadInfo = {
	label: string;
	color: "error" | "warning" | "info" | "default" | "success";
	score: number; // Menor score = más inminente
	sublabel?: string;
};

function calcularProximidad(fechaStr: string, horaDesde?: string | null): ProximidadInfo {
	if (!fechaStr) {
		return { label: "-", color: "default", score: 999999 };
	}

	const hoy = dayjs().startOf("day");
	const fechaMesa = dayjs(fechaStr).startOf("day");
	const diffDias = fechaMesa.diff(hoy, "day");
	const hora = horaDesde ? horaDesde.slice(0, 5) : "";

	if (diffDias === 0) {
		return {
			label: hora ? `¡HOY A LAS ${hora}!` : "¡HOY!",
			color: "error",
			score: 0,
			sublabel: "Mesa del día",
		};
	}

	if (diffDias === 1) {
		return {
			label: hora ? `MAÑANA a las ${hora}` : "MAÑANA",
			color: "warning",
			score: 1,
			sublabel: "Próxima mesa",
		};
	}

	if (diffDias > 1 && diffDias <= 7) {
		const diaSemana = fechaMesa.format("dddd");
		return {
			label: `En ${diffDias} días (${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)})`,
			color: "info",
			score: diffDias,
		};
	}

	if (diffDias > 7) {
		return {
			label: `En ${diffDias} días`,
			color: "default",
			score: diffDias,
		};
	}

	// diffDias < 0 (Fecha ya transcurrida)
	return {
		label: `Fecha cumplida (${Math.abs(diffDias)} d)`,
		color: "default",
		score: 10000 + Math.abs(diffDias),
	};
}

const FinalExamMesasGrid: React.FC<Props> = ({
	finalMesas,
	finalSelectedMesaId,
	finalLoadingMesas,
	finalLoadingPlanilla,
	estadoPlanilla,
	onOpenFinalPlanilla,
	isDocente = false,
}) => {
	// Filtrar por estado
	const filtered = finalMesas.filter((mesa: MesaResumenDTO) => {
		if (estadoPlanilla === "ABIERTAS") return !mesa.esta_cerrada;
		if (estadoPlanilla === "CERRADAS") return mesa.esta_cerrada;
		return true;
	});

	// Ordenar por proximidad de fecha: HOY (0) -> MAÑANA (1) -> Venideras -> Pasadas
	const sortedMesas = [...filtered].sort((a, b) => {
		const proxA = calcularProximidad(a.fecha, a.hora_desde);
		const proxB = calcularProximidad(b.fecha, b.hora_desde);
		if (proxA.score !== proxB.score) {
			return proxA.score - proxB.score;
		}
		// Desempate por hora_desde
		return (a.hora_desde || "").localeCompare(b.hora_desde || "");
	});

	return (
		<Grid container spacing={1.5}>
			{finalLoadingMesas ? (
				<Grid item xs={12}>
					<Stack alignItems="center" py={4}>
						<CircularProgress size={32} />
					</Stack>
				</Grid>
			) : sortedMesas.length ? (
				sortedMesas.map((mesa: MesaResumenDTO) => {
					const fecha = mesa.fecha
						? mesa.fecha.split("-").reverse().join("/")
						: "-";
					const horaDesde = mesa.hora_desde
						? mesa.hora_desde.slice(0, 5)
						: "";
					const horaHasta = mesa.hora_hasta
						? mesa.hora_hasta.slice(0, 5)
						: "";
					const isSelected = mesa.id === finalSelectedMesaId;
					const proximidad = calcularProximidad(mesa.fecha, mesa.hora_desde);

					// Roles y permisos
					const esPresidente = mesa.mi_rol === "Presidente";
					const esVocal = mesa.mi_rol === "Vocal 1" || mesa.mi_rol === "Vocal 2";
					const puedeEditar = mesa.puede_editar ?? !mesa.esta_cerrada;

					const hoy = dayjs().startOf("day");
					const fechaMesa = dayjs(mesa.fecha).startOf("day");
					const esFechaFutura = fechaMesa.isAfter(hoy);

					return (
						<Grid item xs={12} md={6} lg={4} key={mesa.id}>
							<Paper
								variant="outlined"
								sx={{
									p: 2,
									display: "flex",
									flexDirection: "column",
									justifyContent: "space-between",
									height: "100%",
									borderColor: isSelected
										? "primary.main"
										: proximidad.score === 0
											? "error.main"
											: "divider",
									borderWidth: isSelected || proximidad.score === 0 ? 2 : 1,
									boxShadow: isSelected
										? 3
										: proximidad.score === 0
											? "0 4px 12px rgba(211, 47, 47, 0.15)"
											: 1,
									transition: "all 0.2s ease-in-out",
									"&:hover": {
										boxShadow: 3,
										transform: "translateY(-1px)",
									},
								}}
							>
								<Stack gap={1}>
									{/* Badges superiores: Inminencia de Fecha y Rol */}
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="center"
										flexWrap="wrap"
										gap={0.5}
									>
										{/* Badge de Proximidad */}
										<Chip
											icon={
												proximidad.score === 0 ? (
													<AccessTimeIcon style={{ fontSize: 14 }} />
												) : (
													<CalendarTodayIcon style={{ fontSize: 13 }} />
												)
											}
											label={proximidad.label}
											size="small"
											color={proximidad.color}
											variant={proximidad.score === 0 ? "filled" : "outlined"}
											sx={{
												height: 22,
												fontSize: "0.7rem",
												fontWeight: 800,
												letterSpacing: "0.02em",
											}}
										/>

										{/* Badge de Rol del Docente */}
										{isDocente && mesa.mi_rol && (
											<Chip
												icon={
													esPresidente ? (
														<WorkspacePremiumIcon style={{ fontSize: 14 }} />
													) : (
														<GroupIcon style={{ fontSize: 14 }} />
													)
												}
												label={esPresidente ? "PRESIDENTE" : mesa.mi_rol.toUpperCase()}
												size="small"
												color={esPresidente ? "primary" : "secondary"}
												variant="filled"
												sx={{
													height: 22,
													fontSize: "0.68rem",
													fontWeight: 700,
												}}
											/>
										)}
									</Stack>

									{/* Título de Materia y Estado de Edición */}
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="flex-start"
										gap={1}
									>
										<Typography
											variant="subtitle1"
											sx={{ lineHeight: 1.25, fontWeight: 700, flex: 1 }}
										>
											{mesa.materia_nombre} (#{mesa.materia_id})
										</Typography>

										{/* Estado de Edición */}
										{mesa.esta_cerrada ? (
											<Chip
												icon={<LockIcon style={{ fontSize: 14 }} />}
												label="CERRADA"
												size="small"
												color="default"
												variant="outlined"
												sx={{
													height: 20,
													fontSize: "0.65rem",
													fontWeight: 700,
													backgroundColor: "#f5f5f5",
												}}
											/>
										) : isDocente && esVocal ? (
											<Chip
												icon={<VisibilityIcon style={{ fontSize: 13 }} />}
												label="SOLO LECTURA"
												size="small"
												color="default"
												variant="outlined"
												sx={{
													height: 20,
													fontSize: "0.65rem",
													fontWeight: 700,
													bgcolor: "action.hover",
												}}
											/>
										) : isDocente && esPresidente && esFechaFutura ? (
											<Chip
												icon={<AccessTimeIcon style={{ fontSize: 13 }} />}
												label={`HABILITA ${fecha}`}
												size="small"
												color="warning"
												variant="outlined"
												sx={{
													height: 20,
													fontSize: "0.65rem",
													fontWeight: 700,
												}}
											/>
										) : puedeEditar ? (
											<Chip
												icon={<EditIcon style={{ fontSize: 14 }} />}
												label="EDICIÓN ACTIVA"
												size="small"
												color="success"
												variant="outlined"
												sx={{
													height: 20,
													fontSize: "0.65rem",
													fontWeight: 700,
												}}
											/>
										) : (
											<Chip
												icon={<VisibilityIcon style={{ fontSize: 13 }} />}
												label="SOLO LECTURA"
												size="small"
												color="default"
												variant="outlined"
												sx={{
													height: 20,
													fontSize: "0.65rem",
													fontWeight: 700,
												}}
											/>
										)}
									</Stack>

									{/* Profesorado y Plan */}
									<Typography variant="body2" color="text.secondary">
										{mesa.profesorado_nombre ?? "Sin profesorado"} | Plan{" "}
										{mesa.plan_resolucion ?? "-"}
									</Typography>

									{/* Detalle de Horario, Modalidad y Tipo */}
									<Typography variant="body2" color="text.secondary">
										{fecha} {horaDesde}
										{horaHasta ? ` - ${horaHasta}` : ""} |{" "}
										{mesa.modalidad === "LIB" ? "Libre" : "Regular"} |{" "}
										{mesa.tipo === "FIN"
											? "Ordinaria"
											: mesa.tipo === "EXT"
												? "Extraordinaria"
												: "Especial"}
									</Typography>
								</Stack>

								{/* Botón de Acción */}
								<Box mt={1.5}>
									<Button
										size="small"
										fullWidth
										variant={puedeEditar && !mesa.esta_cerrada ? "contained" : "outlined"}
										color={
											mesa.esta_cerrada
												? "primary"
												: puedeEditar
													? "success"
													: "primary"
										}
										startIcon={
											puedeEditar && !mesa.esta_cerrada ? (
												<EditIcon style={{ fontSize: 16 }} />
											) : (
												<VisibilityIcon style={{ fontSize: 16 }} />
											)
										}
										onClick={() => onOpenFinalPlanilla(mesa.id)}
										disabled={finalLoadingPlanilla && isSelected}
									>
										{puedeEditar && !mesa.esta_cerrada
											? "Cargar / Editar acta"
											: "Ver planilla (solo lectura)"}
									</Button>
								</Box>
							</Paper>
						</Grid>
					);
				})
			) : (
				<Grid item xs={12}>
					<Alert severity="info">
						No se encontraron mesas que coincidan con los filtros seleccionados.
					</Alert>
				</Grid>
			)}
		</Grid>
	);
};

export default FinalExamMesasGrid;

