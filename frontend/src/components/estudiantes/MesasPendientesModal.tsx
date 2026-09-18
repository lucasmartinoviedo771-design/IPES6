import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import PlaceIcon from "@mui/icons-material/Place";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { obtenerTrayectoriaEstudiante } from "@/api/estudiantes";
import type { TrayectoriaMesaDTO } from "@/api/estudiantes/types";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/utils/date";
import { isOnlyEstudiante } from "@/utils/roles";

const MESA_TIPO_LABEL: Record<string, string> = {
	FIN: "Ordinaria",
	EXT: "Extraordinaria",
	ESP: "Especial",
};

/**
 * Parsea fechas que pueden venir en formato DD/MM/YYYY o YYYY-MM-DD
 */
function parseMesaDate(dateStr: string): dayjs.Dayjs | null {
	if (!dateStr) return null;
	if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
		const [d, m, y] = dateStr.split("/");
		return dayjs(`${y}-${m}-${d}`);
	}
	const d = dayjs(dateStr);
	return d.isValid() ? d : null;
}

export const MesasPendientesModal: React.FC = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const isEstudiante = useMemo(() => {
		if (!user) return false;
		const roles = (user.roles ?? []).map((r) => r.toLowerCase().trim());
		return roles.includes("estudiante") || isOnlyEstudiante(user);
	}, [user]);

	// Session storage key única por usuario para no ser invasivos repetidamente si ya descartó en la misma sesión
	const sessionKey = useMemo(
		() => (user?.dni ? `dismissed_mesas_modal_${user.dni}` : null),
		[user?.dni],
	);

	const [dismissed, setDismissed] = useState<boolean>(() => {
		if (!sessionKey) return false;
		try {
			return sessionStorage.getItem(sessionKey) === "1";
		} catch {
			return false;
		}
	});

	const { data: trayectoria } = useQuery({
		queryKey: ["trayectoria", "estudiante", user?.dni],
		queryFn: () => obtenerTrayectoriaEstudiante(),
		enabled: !!user && isEstudiante && !dismissed,
		staleTime: 60_000,
	});

	// Mesas pendientes de rendir: estado "INS" (Inscripto/Confirmado) con fecha >= hoy
	const mesasPendientes = useMemo<TrayectoriaMesaDTO[]>(() => {
		if (!trayectoria?.mesas || !Array.isArray(trayectoria.mesas)) return [];
		const todayStart = dayjs().startOf("day");

		return trayectoria.mesas.filter((m) => {
			if (m.estado !== "INS") return false;
			const parsed = parseMesaDate(m.fecha);
			if (!parsed) return true; // Si no tiene fecha parseable, conservarla por precaución
			return parsed.isSame(todayStart, "day") || parsed.isAfter(todayStart);
		});
	}, [trayectoria]);

	// Si el usuario ya está parado en la página de mesas, no es necesario desplegar el aviso
	const isAlreadyInMesaPage = location.pathname.startsWith(
		"/estudiantes/mesa-examen",
	);

	const open =
		!dismissed &&
		!isAlreadyInMesaPage &&
		isEstudiante &&
		mesasPendientes.length > 0;

	const handleClose = () => {
		setDismissed(true);
		if (sessionKey) {
			try {
				sessionStorage.setItem(sessionKey, "1");
			} catch {
				/* ignore */
			}
		}
	};

	const handleNavigate = () => {
		handleClose();
		// Tab 2 corresponde al Cronograma de Mesas Inscriptas
		navigate("/estudiantes/mesa-examen?tab=2");
	};

	if (!open) return null;

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="sm"
			fullWidth
			PaperProps={{
				sx: {
					borderRadius: 3,
					p: 1,
					boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
				},
			}}
		>
			<DialogTitle sx={{ pb: 1, pt: 2 }}>
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Box
						sx={{
							bgcolor: "#fff3e0",
							color: "#d35400",
							p: 1,
							borderRadius: "50%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<EventAvailableIcon fontSize="medium" />
					</Box>
					<Box>
						<Typography variant="h6" fontWeight={700} color="#2c3e50">
							Mesas de examen pendientes
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Tenés {mesasPendientes.length}{" "}
							{mesasPendientes.length === 1
								? "mesa programada"
								: "mesas programadas"}{" "}
							para concurrir
						</Typography>
					</Box>
				</Stack>
			</DialogTitle>

			<DialogContent dividers sx={{ py: 2 }}>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Recordá presentarte a horario con tu documento de identidad y libreta
					o constancia correspondiente.
				</Typography>

				<Stack spacing={1.5}>
					{mesasPendientes.map((m) => (
						<Paper
							key={m.id || m.mesa_id}
							variant="outlined"
							sx={{
								p: 1.5,
								borderRadius: 2,
								borderColor: "#e0e0e0",
								bgcolor: "#fafafa",
								transition: "all 0.2s ease",
								"&:hover": {
									bgcolor: "#f5f5f5",
									borderColor: "#b7694e",
								},
							}}
						>
							<Stack
								direction="row"
								justifyContent="space-between"
								alignItems="flex-start"
								spacing={1}
							>
								<Box sx={{ flex: 1 }}>
									<Typography variant="subtitle2" fontWeight={700} color="#333">
										{m.materia_nombre}
									</Typography>
									<Stack
										direction="row"
										spacing={2}
										alignItems="center"
										flexWrap="wrap"
										sx={{ mt: 0.5 }}
									>
										<Stack
											direction="row"
											spacing={0.5}
											alignItems="center"
											color="text.secondary"
										>
											<CalendarMonthIcon sx={{ fontSize: "1rem" }} />
											<Typography variant="caption" fontWeight={600}>
												{formatDate(m.fecha)}
											</Typography>
										</Stack>

										{m.hora_desde && (
											<Stack
												direction="row"
												spacing={0.5}
												alignItems="center"
												color="text.secondary"
											>
												<ScheduleIcon sx={{ fontSize: "1rem" }} />
												<Typography variant="caption">{m.hora_desde}</Typography>
											</Stack>
										)}

										{m.aula && (
											<Stack
												direction="row"
												spacing={0.5}
												alignItems="center"
												color="text.secondary"
											>
												<PlaceIcon sx={{ fontSize: "1rem" }} />
												<Typography variant="caption">Aula: {m.aula}</Typography>
											</Stack>
										)}
									</Stack>
								</Box>

								<Chip
									label={MESA_TIPO_LABEL[m.tipo] ?? m.tipo}
									size="small"
									sx={{
										fontSize: "0.7rem",
										height: 22,
										fontWeight: 600,
										bgcolor: m.tipo === "EXT" ? "#ffebee" : "#e3f2fd",
										color: m.tipo === "EXT" ? "#c62828" : "#1565c0",
									}}
								/>
							</Stack>
						</Paper>
					))}
				</Stack>
			</DialogContent>

			<DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
				<Button
					onClick={handleClose}
					color="inherit"
					sx={{ textTransform: "none", color: "text.secondary" }}
				>
					No ver ahora
				</Button>
				<Button
					onClick={handleNavigate}
					variant="contained"
					sx={{
						textTransform: "none",
						fontWeight: 600,
						bgcolor: "#B7694E",
						"&:hover": { bgcolor: "#9c573f" },
					}}
				>
					Ver mis mesas pendientes
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default MesasPendientesModal;
