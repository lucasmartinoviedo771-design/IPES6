import AccessTime from "@mui/icons-material/AccessTime";
import Assignment from "@mui/icons-material/Assignment";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import CompareArrows from "@mui/icons-material/CompareArrows";
import Event from "@mui/icons-material/Event";
import EventNote from "@mui/icons-material/EventNote";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import School from "@mui/icons-material/School";
import TrendingUp from "@mui/icons-material/TrendingUp";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCursoIntroEstado } from "@/api/cursoIntro";
import { type CorrelativaCaidaItem, getMisAlertas } from "@/api/reportes";
import { fetchVentanas, type VentanaDto } from "@/api/ventanas";
import SectionCard from "@/components/secretaria/SectionCard";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import {
	ICON_GRADIENT,
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";
import { hasAnyRole, hasRole } from "@/utils/roles";

type EventCard = {
	title: string;
	date: string;
	icon: React.ReactNode;
	path?: string;
};

type SectionCardData = {
	title: string;
	subtitle: string;
	icon: React.ReactNode;
	path: string;
	status?: "success" | "info" | "warning";
	disabled?: boolean;
};

type Section = {
	title: string;
	subtitle: string;
	items: SectionCardData[];
};

const WINDOW_TYPE_CONFIG: Record<
	string,
	{ title: string; icon: React.ReactNode; subtitle: string; path?: string }
> = {
	MATERIAS: {
		title: "Inscripción a Materias",
		subtitle: "Registro de cursadas y materias",
		icon: <Assignment />,
		path: "/estudiantes/inscripcion-materia",
	},
	MESAS_FINALES: {
		title: "Exámenes Finales",
		subtitle: "Inscripción a mesas de examen",
		icon: <CalendarMonth />,
		path: "/estudiantes/mesa-examen",
	},
	MESAS_EXTRA: {
		title: "Exámenes Extraordinarios",
		subtitle: "Mesas especiales y remanentes",
		icon: <CalendarMonth />,
		path: "/estudiantes/mesa-examen",
	},
	COMISION: {
		title: "Cambio de Comisión",
		subtitle: "Solicitud de cambio de grupo",
		icon: <CompareArrows />,
		path: "/estudiantes/cambio-comision",
	},
	ANALITICOS: {
		title: "Pedido de Analítico",
		subtitle: "Gestión y seguimiento de trámites",
		icon: <School />,
		path: "/estudiantes/tramites",
	},
	EQUIVALENCIAS: {
		title: "Equivalencias",
		subtitle: "Convalidación de materias externas",
		icon: <CompareArrows />,
		path: "/estudiantes/tramites",
	},
	CURSO_INTRODUCTORIO: {
		title: "Curso Introductorio",
		subtitle: "Ingreso y nivelación",
		icon: <VerifiedUser />,
		path: "/estudiantes/curso-introductorio",
	},
};

const formatDateShort = (dStr?: string) => {
	if (!dStr) return null;
	const d = new Date(dStr);
	if (isNaN(d.getTime())) return dStr;
	return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

const baseSections: Section[] = [
	{
		title: "Inscripciones",
		subtitle: "Mantenete al día con las fechas importantes del ciclo académico.",
		items: [
			{
				title: "Dar el Presente",
				subtitle: "Registrá tu asistencia a clase usando el PIN del docente.",
				icon: <VerifiedUser />,
				path: "/estudiantes/tomar-asistencia",
			},
			{
				title: "Trayectoria del Estudiante",
				subtitle: "Historial completo, materias y seguimiento de inscripciones.",
				icon: <TrendingUp />,
				path: "/estudiantes/trayectoria",
			},
			{
				title: "Mis Asistencias",
				subtitle: "Consultá tu historial de presentismo por materia.",
				icon: <CalendarMonth />,
				path: "/estudiantes/asistencia",
			},
		],
	},
	{
		title: "Trámites",
		subtitle: "Accesos rápidos para inscribirte y gestionar tus trámites académicos.",
		items: [
			{
				title: "Inscripción a Materias",
				subtitle: "Inscribite a las materias de tu plan de estudio.",
				icon: <Assignment />,
				path: "/estudiantes/inscripcion-materia",
			},
			{
				title: "Horario de Cursada",
				subtitle: "Consultá tu horario (comisión) y descargalo en PDF.",
				icon: <AccessTime />,
				path: "/estudiantes/horario",
			},
			{
				title: "Cambio de Comisión",
				subtitle: "Solicitá tu cambio de comisión a otra materia.",
				icon: <CompareArrows />,
				path: "/estudiantes/cambio-comision",
			},
			{
				title: "Analíticos y Equivalencias",
				subtitle: "Solicitá Analítico o inicia y seguí tus pedidos de equivalencias.",
				icon: <School />,
				path: "/estudiantes/tramites",
			},
			{
				title: "Mesa de Examen",
				subtitle: "Inscribite a mesas de examen",
				icon: <CalendarMonth />,
				path: "/estudiantes/mesa-examen",
			},
		],
	},
	{
		title: "Certificados",
		subtitle: "Generá tus títulos oficiales para tramitar donde lo necesites.",
		items: [
			{
				title: "Constancia de Estudiante Regular",
				subtitle: "Descarga tu certificado de estudiante regular en un clic.",
				icon: <VerifiedUser />,
				path: "/estudiantes/certificado-regular",
			},
			{
				title: "Constancia de examen",
				subtitle: "Descargá la constancia de la última mesa rendida.",
				icon: <EventNote />,
				path: "/estudiantes/constancia-examen",
			},
		],
	},
];

export default function EstudiantesIndex() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const isStudent = hasAnyRole(user, ["estudiante", "estudiantes"]);
	const isAdmin = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

	const { data: cursoIntroEstado } = useQuery({
		queryKey: ["curso-intro", "estado"],
		queryFn: fetchCursoIntroEstado,
		staleTime: 60_000,
		enabled: isStudent && !isAdmin,
		retry: false,
	});

	const { data: alertas } = useQuery<CorrelativaCaidaItem[]>({
		queryKey: ["mis-alertas"],
		queryFn: getMisAlertas,
		staleTime: 60_000,
		enabled: isStudent && !isAdmin,
		retry: false,
	});

	const { data: ventanas } = useQuery({
		queryKey: ["ventanas"],
		queryFn: () => fetchVentanas(),
		staleTime: 60_000,
	});

	const dynamicEvents = useMemo(() => {
		const byTipo = new Map<string, any>();
		Object.keys(WINDOW_TYPE_CONFIG).forEach((tipo) => {
			byTipo.set(tipo, {
				tipo,
				status: "unscheduled",
				desde: null,
				hasta: null,
			});
		});

		if (ventanas && Array.isArray(ventanas)) {
			const now = new Date();
			const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

			ventanas.forEach((v: VentanaDto) => {
				const curr = byTipo.get(v.tipo);
				if (!curr) return;

				let status = (v as any).status;
				if (!status && v.desde && v.hasta) {
					const dParts = String(v.desde).split("T")[0].split("-").map(Number);
					const hParts = String(v.hasta).split("T")[0].split("-").map(Number);
					if (dParts.length === 3 && hParts.length === 3) {
						const desde = new Date(dParts[0], dParts[1] - 1, dParts[2]).getTime();
						const hasta = new Date(hParts[0], hParts[1] - 1, hParts[2], 23, 59, 59, 999).getTime();
						if (v.activo && hoy >= desde && hoy <= hasta) {
							status = "active";
						} else if (v.activo && hoy < desde) {
							status = "future";
						} else {
							status = "closed";
						}
					}
				}

				const vWithStatus = { ...v, status };

				if (status === "active") {
					byTipo.set(v.tipo, vWithStatus);
				} else if (status === "future" && curr.status !== "active") {
					byTipo.set(v.tipo, vWithStatus);
				} else if (
					status === "closed" &&
					curr.status !== "active" &&
					curr.status !== "future"
				) {
					byTipo.set(v.tipo, vWithStatus);
				}
			});
		}

		const result = Array.from(byTipo.values()).map((v) => {
			const config = WINDOW_TYPE_CONFIG[v.tipo] || {
				title: v.nombre || v.tipo,
				subtitle: "Información de la ventana",
				icon: <Event />,
				path: undefined,
			};
			return {
				...v,
				title: config.title,
				subtitle: config.subtitle,
				icon: config.icon,
				path: config.path,
			};
		});

		const displayOrder: Record<string, number> = {
			active: 1,
			future: 2,
			closed: 3,
			unscheduled: 4,
		};
		return result.sort((a, b) => {
			if (displayOrder[a.status] !== displayOrder[b.status]) {
				return displayOrder[a.status] - displayOrder[b.status];
			}
			if (a.desde && b.desde) {
				return new Date(b.desde).getTime() - new Date(a.desde).getTime();
			}
			return 0;
		});
	}, [ventanas]);

	const sections = useMemo<Section[]>(() => {
		let filteredSections = baseSections;

		if (!isStudent && !isAdmin) {
			filteredSections = baseSections.filter((s) => s.title === "Trayectoria");
		}

		if (!isStudent) {
			return filteredSections;
		}

		const subtitle = cursoIntroEstado
			? cursoIntroEstado.aprobado
				? "Curso introductorio aprobado."
				: cursoIntroEstado.registro_actual
					? `Estado: ${cursoIntroEstado.registro_actual.resultado_display}`
					: cursoIntroEstado.cohortes_disponibles.length
						? "Inscripciones abiertas."
						: "Consultá el estado e inscribite."
			: "Consultá el curso introductorio.";

		const cursoIntroCard: SectionCardData = {
			title: "Curso Introductorio",
			subtitle,
			icon: <VerifiedUser />,
			path: "/estudiantes/curso-introductorio",
			status: cursoIntroEstado?.aprobado ? "success" : undefined,
			disabled: cursoIntroEstado?.aprobado ?? false,
		};

		return filteredSections.map((section) => {
			if (section.title !== "Inscripciones") {
				return section;
			}
			return {
				...section,
				items: [...section.items, cursoIntroCard],
			};
		});
	}, [cursoIntroEstado, isStudent]);

	const userName = user?.name || user?.dni || "";
	const heroTitle = userName
		? `Bienvenido, ${userName}`
		: `Bienvenido a Estudiantes`;
	const heroSubtitle = `IPES Paulo Freire / Estudiantes`;

	return (
		<Box>
			<PageHero
				title={heroTitle}
				subtitle={heroSubtitle}
			/>

			{alertas && alertas.length > 0 && (
				<Stack spacing={2} sx={{ mb: 4, mt: 2 }}>
					<Alert severity="error" variant="filled" sx={{ borderRadius: 3 }}>
						<AlertTitle>Atención: Problemas con correlatividades</AlertTitle>
						Tenés materias cursando con regularidades de correlativas vencidas o
						inválidas.
					</Alert>
					{alertas.map((alerta, index) => (
						<Paper
							key={index}
							sx={{ p: 2, borderLeft: "6px solid #d32f2f", bgcolor: "#fff5f5" }}
						>
							<Typography
								variant="subtitle1"
								fontWeight="bold"
								color="error.main"
							>
								{alerta.materia_actual}
							</Typography>
							<Typography variant="body2">
								La correlativa <strong>{alerta.materia_correlativa}</strong>{" "}
								presenta el siguiente problema: <em>{alerta.motivo}</em>.
							</Typography>
						</Paper>
					))}
				</Stack>
			)}

			<Stack spacing={4}>
				{/* Contenedor del Carrusel de Próximos Eventos */}
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
					<SectionTitlePill title="Próximos eventos" />
					<Box
						sx={{
							display: "flex",
							gap: 2,
							overflowX: "auto",
							pb: 1,
							pt: 1,
							scrollSnapType: "x mandatory",
							"&::-webkit-scrollbar": {
								height: 6,
							},
							"&::-webkit-scrollbar-thumb": {
								backgroundColor: "rgba(140, 67, 46, 0.3)",
								borderRadius: 4,
							},
						}}
					>
						{!ventanas ? (
							<Typography variant="body2" color="text.secondary">
								Cargando eventos...
							</Typography>
						) : dynamicEvents.length === 0 ? (
							<Typography variant="body2" color="text.secondary">
								No hay eventos próximos.
							</Typography>
						) : (
							dynamicEvents.map((event) => {
								const isActive = event.status === "active";
								const isFuture = event.status === "future";
								const isUnscheduled = event.status === "unscheduled";

								const VIBRANT_GREEN = "#2D8C3C";
								const CLOSED_COLOR = "#9e9e9e";
								const UNSCHEDULED_COLOR = "#7d7f6e";

								return (
									<Box
										key={event.id || event.title}
										sx={{
											minWidth: { xs: "280px", sm: "320px" },
											maxWidth: { xs: "280px", sm: "320px" },
											scrollSnapAlign: "start",
										}}
									>
										<Box
											sx={{
												position: "relative",
												display: "flex",
												alignItems: "center",
												p: 2,
												borderRadius: "14px",
												height: "100%",
												boxSizing: "border-box",
												border: isActive
													? `1.5px solid ${VIBRANT_GREEN}`
													: isFuture
														? `1.5px solid ${INSTITUTIONAL_TERRACOTTA}`
														: `1px solid #D6CAA`,
												cursor: "default",
												backgroundColor: "#ffffff",
												boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
											}}
										>
											<Box
												component="span"
												sx={{
													position: "absolute",
													top: 10,
													right: 10,
													bgcolor: isActive
														? VIBRANT_GREEN
														: isFuture
															? INSTITUTIONAL_TERRACOTTA
															: isUnscheduled
																? UNSCHEDULED_COLOR
																: CLOSED_COLOR,
													color: "white",
													fontSize: "0.68rem",
													fontWeight: 800,
													px: 1,
													py: 0.3,
													borderRadius: "4px",
													textTransform: "uppercase",
													letterSpacing: "0.04em",
												}}
											>
												{isActive
													? "Abierto"
													: isFuture
														? "Próximamente"
														: isUnscheduled
															? "Sin fecha"
															: "Vencido"}
											</Box>

											<Box
												sx={{
													mr: 1.8,
													width: 44,
													height: 44,
													borderRadius: "12px",
													backgroundColor: INSTITUTIONAL_TERRACOTTA,
													color: "common.white",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													flexShrink: 0,
													boxShadow: "0 4px 10px rgba(156, 78, 53, 0.3)",
												}}
											>
												{React.cloneElement(event.icon as React.ReactElement, {
													sx: { fontSize: 24 },
												})}
											</Box>

											<Box sx={{ flexGrow: 1, pr: 5 }}>
												<Typography
													variant="subtitle2"
													fontWeight={700}
													sx={{ lineHeight: 1.2, mb: 0.3, fontSize: "0.9rem" }}
												>
													{event.title}
												</Typography>
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{ display: "block", mb: 0.8, fontSize: "0.75rem" }}
												>
													{event.subtitle}
												</Typography>

												<Stack
													direction="row"
													spacing={1.5}
													alignItems="center"
													flexWrap="wrap"
												>
													{isUnscheduled ? (
														<Typography
															variant="caption"
															color="text.secondary"
															fontStyle="italic"
															sx={{ fontSize: "0.7rem" }}
														>
															Fecha no definida.
														</Typography>
													) : (
														<>
															<Stack
																direction="row"
																spacing={0.5}
																alignItems="center"
															>
																<CalendarMonth
																	sx={{
																		fontSize: 13,
																		color: "text.secondary",
																		opacity: 0.7,
																	}}
																/>
																<Typography
																	variant="caption"
																	sx={{ fontSize: "0.68rem" }}
																>
																	<Box component="span" color="text.secondary">
																		Desde:
																	</Box>{" "}
																	{formatDateShort(event.desde)}
																</Typography>
															</Stack>

															<Stack
																direction="row"
																spacing={0.5}
																alignItems="center"
															>
																<Assignment
																	sx={{
																		fontSize: 13,
																		color: "text.secondary",
																		opacity: 0.7,
																	}}
																/>
																<Typography
																	variant="caption"
																	sx={{ fontSize: "0.68rem" }}
																>
																	<Box component="span" color="text.secondary">
																		Hasta:
																	</Box>{" "}
																	{formatDateShort(event.hasta)}
																</Typography>
															</Stack>
														</>
													)}
												</Stack>
											</Box>
										</Box>
									</Box>
								);
							})
						)}
					</Box>
				</Box>

				{/* Secciones de Tarjetas en Cajas Beiges Agrupadoras */}
				{sections.map((section) => (
					<Box
						key={section.title}
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
						<SectionTitlePill title={section.title} />
						<Grid container spacing={2}>
							{section.items.map((item) => (
								<SectionCard
									key={`${section.title}-${item.title}`}
									title={item.title}
									subtitle={item.subtitle}
									icon={item.icon}
									path={item.path}
									disabled={item.disabled}
									status={item.status}
								/>
							))}
						</Grid>
					</Box>
				))}
			</Stack>
		</Box>
	);
}
