import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
	type ComisionResumenDTO,
	type EquivalenciaItemDTO,
	type HistorialEstudianteDTO,
	type HorarioDTO,
	type MateriaInscriptaItemDTO,
	type MateriaPlanDTO,
	cancelarInscripcionMateria,
	obtenerCarrerasActivas,
	obtenerEquivalencias,
	obtenerHistorialEstudiante,
	obtenerMateriasInscriptas,
	obtenerMateriasPlanEstudiante,
	obtenerVentanaMaterias,
	solicitarCambioComision,
	type VentanaInscripcion,
} from "@/api/estudiantes";
import { fetchVentanas } from "@/api/ventanas";
import BackButton from "@/components/ui/BackButton";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import { useAuth } from "@/context/AuthContext";
import { isVentanaActiva } from "@/utils/date";
import { hasAnyRole } from "@/utils/roles";

type Horario = HorarioDTO;
type Cuatrimestre = MateriaPlanDTO["cuatrimestre"];

type Materia = {
	id: number;
	nombre: string;
	anio: number;
	cuatrimestre: Cuatrimestre;
	horarios: Horario[];
	correlativasRegular: number[];
	correlativasAprob: number[];
	profesorado?: string;
	tipo_formacion?: string;
	formato?: string;
	horas_semana?: number;
};

type InscripcionConHorario = {
	inscripcion: MateriaInscriptaItemDTO;
	comision: ComisionResumenDTO;
	horarios: Horario[];
	cuatrimestre: Cuatrimestre;
};

type MateriaBloqueada = {
	materia: Materia;
	horarios: Horario[];
	cuatrimestre: Cuatrimestre;
	conflictos: Array<{ nombre: string; horarios: Horario[] }>;
	inscripcion_id?: number;
};

interface AlternativaItem {
	comision: ComisionResumenDTO;
	horarios: Horario[];
	profesorado: string;
	anio: number | null;
};

type HorarioLaboral = {
	dia: number; // 0=Lun, 4=Vie
	desde: string; // "08:00"
	hasta: string; // "14:00"
};

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const toMin = (t: string) => {
	if (!t) return 0;
	const [h, m] = t.split(":").map(Number);
	return h * 60 + (m || 0);
};

const hayChoque = (a: Horario[], b: Horario[]) =>
	a.some((ha) =>
		b.some(
			(hb) =>
				ha.dia === hb.dia &&
				Math.max(toMin(ha.desde), toMin(hb.desde)) <
					Math.min(toMin(ha.hasta), toMin(hb.hasta)),
		),
	);

const hayChoqueConLaboral = (materiasH: Horario[], labH: HorarioLaboral[]) =>
	materiasH.some((mh) =>
		labH.some(
			(lh) =>
				DIAS.indexOf(mh.dia) === lh.dia &&
				Math.max(toMin(mh.desde), toMin(lh.desde)) <
					Math.min(toMin(mh.hasta), toMin(lh.hasta)),
		),
	);

const cuatrimestreCompatible = (a: Cuatrimestre, b: Cuatrimestre) => {
	if (a === "ANUAL" || b === "ANUAL") return true;
	return a === b;
};

const mismasEtapas = (objetivo: Cuatrimestre, candidato: Cuatrimestre) => {
	if (objetivo === "ANUAL") return candidato === "ANUAL";
	return objetivo === candidato;
};

const formatHorarios = (horarios: Horario[]) =>
	horarios.map((h) => `${h.dia} ${h.desde}-${h.hasta}`).join("  ");

const mensajeError = (error: unknown) => {
		const err = error as any;
	return (
		err?.response?.data?.message ||
		err?.message ||
		"No se pudo registrar la solicitud."
	);
};

const mapMateria = (dto: MateriaPlanDTO): Materia => ({
	id: dto.id,
	nombre: dto.nombre,
	anio: dto.anio,
	cuatrimestre: dto.cuatrimestre,
	horarios: dto.horarios ?? [],
	correlativasRegular: dto.correlativas_regular ?? [],
	correlativasAprob: dto.correlativas_aprob ?? [],
	profesorado: dto.profesorado ?? undefined,
	tipo_formacion: dto.tipo_formacion,
	formato: dto.formato,
	horas_semana: dto.horas_semana,
});

// Función para filtrar alternativas que cumplen con la compatibilidad académica
const esCompatible = (a: Materia, b: MateriaPlanDTO | ComisionResumenDTO) => {
	// Nota: Si es ComisionResumenDTO, no tenemos horas_semana/formato directamente aquí,
	// pero el backend /equivalencias ya filtró esto.
	// Si comparamos Materias entre sí (ej: en lógica de superposición):
	if ("formato" in b && b.formato !== a.formato) return false;
	if ("horas_semana" in b && b.horas_semana !== a.horas_semana) return false;
	return true;
};

const ventanaPermiteMateria = (
	ventana: VentanaInscripcion | null,
	materia: Materia,
) => {
	const periodoClave = ventana?.periodo;
	if (!periodoClave) return true;
	if (periodoClave === "1C_ANUALES") {
		return materia.cuatrimestre === "ANUAL" || materia.cuatrimestre === "1C";
	}
	if (periodoClave === "2C") {
		return materia.cuatrimestre === "2C";
	}
	return true;
};

const defaultHistorial: HistorialEstudianteDTO = {
	aprobadas: [],
	regularizadas: [],
	inscriptas_actuales: [],
};

const CambioComisionPage: React.FC = () => {
		const { user } = (useAuth?.() ?? { user: null }) as any;
	const canGestionar = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

	const [dniFiltro, setDniFiltro] = React.useState<string>("");
	const [debouncedDni, setDebouncedDni] = React.useState(dniFiltro);
	const [tab, setTab] = React.useState(0);
	const [info, setInfo] = React.useState<string | null>(null);
	const [err, setErr] = React.useState<string | null>(null);

	// Estado para horario laboral
	const [horarioLab, setHorarioLab] = React.useState<HorarioLaboral[]>([]);

	React.useEffect(() => {
		const handler = setTimeout(() => setDebouncedDni(dniFiltro), 500);
		return () => clearTimeout(handler);
	}, [dniFiltro]);

	const normalizedDni = debouncedDni.trim();

	React.useEffect(() => {
		setInfo(null);
		setErr(null);
	}, [normalizedDni, tab]);

	const queryClient = useQueryClient();
	const isEstudiante = !canGestionar;
	const shouldFetch = isEstudiante || normalizedDni.length > 0;

	const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");

	const { data: carrerasData } = useQuery({
		queryKey: ["carreras-activas", normalizedDni],
		queryFn: () =>
			obtenerCarrerasActivas(normalizedDni ? { dni: normalizedDni } : undefined),
		enabled: shouldFetch,
	});

	const carrerasList = carrerasData?.carreras ?? [];
	const defaultPlanId = React.useMemo(() => {
		if (!carrerasList.length) return "";
		const carrera = carrerasList[0];
		const primerPlanVigente = carrera.planes?.find((p: any) => p.vigente)?.id;
		const primerPlanFallback = carrera.planes?.[0]?.id;
		const pId = primerPlanVigente || primerPlanFallback;
		return pId ? String(pId) : "";
	}, [carrerasList]);

	const activePlanId = selectedPlanId || defaultPlanId;

	// Cuando cambia el DNI, limpiamos el plan seleccionado para que se recalcule
	React.useEffect(() => {
		setSelectedPlanId("");
	}, [normalizedDni]);

	const {
		data: materiasData,
		isError: materiasError,
		isLoading: materiasLoading,
	} = useQuery({
		queryKey: ["cc-materias", normalizedDni, activePlanId],
		queryFn: async () => {
			if (!activePlanId) return [];
			return (
				await obtenerMateriasPlanEstudiante({
					plan_id: Number(activePlanId),
					...(normalizedDni ? { dni: normalizedDni } : {}),
				})
			).map(mapMateria);
		},
		enabled: shouldFetch && !!activePlanId,
	});

	const {
		data: historialData,
		isError: historialError,
		isLoading: historialLoading,
	} = useQuery({
		queryKey: ["cc-historial", normalizedDni],
		queryFn: () =>
			obtenerHistorialEstudiante(
				normalizedDni ? { dni: normalizedDni } : undefined,
			),
		enabled: shouldFetch,
	});

	const {
		data: ventanaData,
		isError: ventanaError,
		isLoading: ventanaLoading,
	} = useQuery<VentanaInscripcion | null>({
		queryKey: ["cc-ventana", canGestionar],
		queryFn: async () => {
			if (canGestionar) {
				const [ventanasGestion, ventanasRegular] = await Promise.all([
					fetchVentanas({ tipo: "COMISION_GESTION" }).catch((): VentanaInscripcion[] => []),
					fetchVentanas({ tipo: "COMISION" }).catch((): VentanaInscripcion[] => []),
				]);
				const activaGestion = ventanasGestion.find((v: VentanaInscripcion) => isVentanaActiva(v));
				if (activaGestion) return activaGestion;
				const activaRegular = ventanasRegular.find((v: VentanaInscripcion) => isVentanaActiva(v));
				if (activaRegular) return activaRegular;

				const todas = [...ventanasGestion, ...ventanasRegular].sort((a: VentanaInscripcion, b: VentanaInscripcion) => {
					const dateA = a.desde ? new Date(a.desde).getTime() : 0;
					const dateB = b.desde ? new Date(b.desde).getTime() : 0;
					return dateB - dateA;
				});
				return todas[0] || null;
			}
			const data = await fetchVentanas({ tipo: "COMISION" }).catch((): VentanaInscripcion[] => []);
			const activa = data.find((v: VentanaInscripcion) => isVentanaActiva(v));
			if (activa) return activa;
			const sorted = [...data].sort((a: VentanaInscripcion, b: VentanaInscripcion) => {
				const dateA = a.desde ? new Date(a.desde).getTime() : 0;
				const dateB = b.desde ? new Date(b.desde).getTime() : 0;
				return dateB - dateA;
			});
			return sorted[0] || null;
		},
	});

	const {
		data: inscriptasData,
		isError: inscriptasError,
		isLoading: inscriptasLoading,
	} = useQuery({
		queryKey: ["cc-inscriptas", normalizedDni],
		queryFn: () =>
			obtenerMateriasInscriptas(
				normalizedDni ? { dni: normalizedDni } : undefined,
			),
		enabled: shouldFetch,
	});

	const mSolicitar = useMutation({
		mutationFn: (payload: {
			inscripcion_id?: number;
			materia_id?: number;
			comision_id: number;
			motivo_cambio: "OVERLAP" | "WORK";
			horario_laboral?: HorarioLaboral[];
		}) => {
						const fullPayload: any = { ...payload };
			if (canGestionar && normalizedDni) {
				fullPayload.dni = normalizedDni;
			}
			return solicitarCambioComision(fullPayload);
		},
		onSuccess: (res) => {
			setInfo(res?.message || "Solicitud registrada correctamente.");
			setErr(null);
			setSolicitudPendiente(null);
			queryClient.invalidateQueries({
				queryKey: ["cc-inscriptas"],
			});
			queryClient.invalidateQueries({
				queryKey: ["cc-materias"],
			});
			queryClient.invalidateQueries({
				queryKey: ["cc-historial"],
			});
		},
		onError: (error) => {
			setErr(mensajeError(error));
			setInfo(null);
			setSolicitudPendiente(null);
		},
	});

	const mCancelar = useMutation({
		mutationFn: (inscripcion_id: number) =>
			cancelarInscripcionMateria({
				inscripcion_id,
				...(canGestionar && normalizedDni ? { dni: normalizedDni } : {}),
			}),
		onSuccess: () => {
			setInfo("Inscripción cancelada correctamente.");
			setErr(null);
			queryClient.invalidateQueries({
				queryKey: ["cc-inscriptas", normalizedDni],
			});
		},
		onError: (error) => {
			setErr(mensajeError(error));
		},
	});

	const materias = materiasData ?? [];  
	const historial = historialData ?? defaultHistorial;
	const ventana = ventanaData ?? null;
	const inscripciones = inscriptasData ?? [];  

	const materiaById = React.useMemo(() => {
		const map = new Map<number, Materia>();
		materias.forEach((m) => map.set(m.id, m));
		return map;
	}, [materias]);

	const inscripcionesActivas = React.useMemo(
		() =>
			inscripciones.filter(
				(ins) =>
					ins.estado === "CONF" ||
					ins.estado === "PEND" ||
					ins.estado === "COND",
			),
		[inscripciones],
	);

	const resolveInscripcion = React.useCallback(
		(ins: MateriaInscriptaItemDTO): InscripcionConHorario | null => {
			const materiaRef = materiaById.get(ins.materia_id);
			const baseCuatrimestre: Cuatrimestre =
				materiaRef?.cuatrimestre ?? "ANUAL";
			const baseHorarios = materiaRef?.horarios ?? [];
			const comision = ins.comision_solicitada ?? ins.comision_actual ?? null;
			const horarios = comision?.horarios?.length
				? comision.horarios
				: baseHorarios;
			if (!horarios.length) {
				return null;
			}
			const resolvedComision: ComisionResumenDTO =
				comision ??
				({
					id: -ins.inscripcion_id,
					codigo: "Sin comision asignada",
					anio_lectivo: ins.anio_academico,
					turno_id: 0,
					turno: "Turno no asignado",
					materia_id: ins.materia_id,
					materia_nombre: ins.materia_nombre,
					plan_id: null,
					profesorado_id: null,
					profesorado_nombre: materiaRef?.profesorado ?? null,
					docente: null,
					cupo_maximo: null,
					estado: ins.estado,
					horarios,
				} as ComisionResumenDTO);
			return {
				inscripcion: ins,
				comision: resolvedComision,
				horarios,
				cuatrimestre: baseCuatrimestre,
			};
		},
		[materiaById],
	);

	const inscripcionesConHorario = React.useMemo(
		() =>
			inscripcionesActivas
				.map((ins) => resolveInscripcion(ins))
				.filter((item): item is InscripcionConHorario => Boolean(item)),
		[inscripcionesActivas, resolveInscripcion],
	);

	const solicitudesEnTramite = React.useMemo(
		() => inscripciones.filter((ins) => Boolean(ins.comision_solicitada)),
		[inscripciones],
	);

	const aprobadas = React.useMemo(() => new Set(historial.aprobadas ?? []), [historial.aprobadas]);
	const regularizadas = React.useMemo(() => new Set(historial.regularizadas ?? []), [historial.regularizadas]);

	const materiasConBloqueo = React.useMemo(() => {
		if (!shouldFetch) return [] as MateriaBloqueada[];


		const inscriptasIds = new Set(
			inscripcionesActivas.map((ins) => ins.materia_id),
		);
		// Excluir materias que ya tienen un cambio de comisión pendiente o aprobado
		const materiasConCambio = new Set(
			inscripcionesActivas
				.filter((ins) => ins.comision_solicitada || ins.comision_actual !== ins.comision_solicitada)
				.map((ins) => ins.materia_id),
		);
		const resultado: MateriaBloqueada[] = [];

		materias.forEach((materia) => {
			// REGLA: Formación General o EDIs para cambios de comisión entre profesorados
			const esEDI = materia.tipo_formacion === "ESPACIO_DEFINICION_INSTITUCIONAL" || materia.nombre.toUpperCase().includes("EDI:");
			if (materia.tipo_formacion !== "FGN" && !esEDI) return;

			if (!materia.horarios.length) return;
			if (!ventanaPermiteMateria(ventana, materia) && !esEDI) return;

			// No mostrar si ya tiene un cambio de comisión en trámite
			if (materiasConCambio.has(materia.id)) return;

			// REGLA: No debe tenerla regularizada o aprobada (no deberia estar en la lista si lo esta, pero por las dudas)
			if ((regularizadas.has(materia.id) || aprobadas.has(materia.id)) && !esEDI) return;
			const faltanReg = materia.correlativasRegular.filter(
				(mid) => !regularizadas.has(mid) && !aprobadas.has(mid),
			);
			const faltanApr = materia.correlativasAprob.filter(
				(mid) => !aprobadas.has(mid),
			);
			if ((faltanReg.length || faltanApr.length) && !esEDI) return;

			if (tab === 0) {
				// MODO SUPERPOSICIÓN:
				// 1. Si YA está inscripta: buscamos si choca con OTRAS (cambiar ESTA para resolver choque)
				// 2. Si NO está inscripta: buscamos si choca con las actuales (caso Historia Social)

				const tieneChoque = inscripcionesConHorario.some((ins) => {
					if (ins.inscripcion.materia_id === materia.id) return false;
					return hayChoque(materia.horarios, ins.horarios);
				});

				if (!tieneChoque && !esEDI) return;

				const conflictos = inscripcionesConHorario
					.filter((otro) => otro.inscripcion.materia_id !== materia.id)
					.filter((otro) => hayChoque(materia.horarios, otro.horarios))
					.map((c) => ({
						nombre: c.inscripcion.materia_nombre,
						horarios: c.horarios,
					}));

				const yaInscripta = inscriptasIds.has(materia.id);
				const insId = yaInscripta
					? inscripcionesConHorario.find(
							(i) => i.inscripcion.materia_id === materia.id,
						)?.inscripcion.inscripcion_id
					: undefined;

				resultado.push({
					materia,
					horarios: materia.horarios,
					cuatrimestre: materia.cuatrimestre,
					conflictos,
					inscripcion_id: insId,
				});
			} else {
				// MODO LABORAL: Materias NO inscriptas (o inscriptas) que chocan contra el trabajo
				if (horarioLab.length === 0) return;

				const yaInscripta = inscriptasIds.has(materia.id);
				const horMateria = yaInscripta
					? (inscripcionesConHorario.find(
							(i) => i.inscripcion.materia_id === materia.id,
						)?.horarios ?? materia.horarios)
					: materia.horarios;

				if (hayChoqueConLaboral(horMateria, horarioLab)) {
					const insId = inscripcionesConHorario.find(
						(i) => i.inscripcion.materia_id === materia.id,
					)?.inscripcion.inscripcion_id;
					resultado.push({
						materia,
						inscripcion_id: insId,
						horarios: horMateria,
						cuatrimestre: materia.cuatrimestre,
						conflictos: [{ nombre: "Horario Laboral", horarios: [] }],
					});
				}
			}
		});

		return resultado;
	}, [
		historial,
		inscripcionesActivas,
		inscripcionesConHorario,
		materias,
		shouldFetch,
		ventana,
		tab,
		horarioLab,
	]);

	const ventanaActiva = isVentanaActiva(ventana);

	const [solicitudPendiente, setSolicitudPendiente] = React.useState<{
		inscripcionId?: number;
		materiaId: number;
		materiaNombre: string;
		comisionId: number;
		comisionLabel: string;
		profesorado?: string;
	} | null>(null);
	const [expandedMap, setExpandedMap] = React.useState<Record<number, boolean>>(
		{},
	);
	const toggleExpanded = React.useCallback(
		(id: number) => setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] })),
		[],
	);

	const abrirConfirmacionSolicitud = React.useCallback(
		(entrada: MateriaBloqueada, alternativa: AlternativaItem) => {
			setSolicitudPendiente({
				inscripcionId: entrada.inscripcion_id,
				materiaId: entrada.materia.id,
				materiaNombre: entrada.materia.nombre,
				comisionId: alternativa.comision.id,
				comisionLabel:
					alternativa.comision.codigo || String(alternativa.comision.id),
				profesorado: alternativa.profesorado,
			});
		},
		[],
	);

	const solicitudLoading = mSolicitar.isPending;

	const confirmarSolicitud = React.useCallback(() => {
		if (!solicitudPendiente) return;
		if (!ventanaActiva) {
			setErr("No hay una ventana de cambio de comisión activa.");
			setSolicitudPendiente(null);
			return;
		}
		const payload: any = {
			materia_id: solicitudPendiente.materiaId,
			comision_id: solicitudPendiente.comisionId,
			motivo_cambio: tab === 0 ? "OVERLAP" : "WORK",
		};

		// Incluir inscripcion_id solo si existe (no es undefined)
		if (solicitudPendiente.inscripcionId !== undefined) {
			payload.inscripcion_id = solicitudPendiente.inscripcionId;
		}

		// Incluir horario_laboral solo si es por motivos laborales
		if (tab === 1) {
			payload.horario_laboral = horarioLab;
		}

		mSolicitar.mutate(payload);
	}, [mSolicitar, solicitudPendiente, tab, horarioLab, ventanaActiva]);

	const queryError =
		shouldFetch &&
		(materiasError || historialError || inscriptasError || ventanaError);
	const loading =
		shouldFetch &&
		(materiasLoading ||
			historialLoading ||
			inscriptasLoading ||
			ventanaLoading);

	if (loading) {
		return (
			<Box p={3}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<>
			<Box sx={{ p: 3 }}>
				<BackButton
					fallbackPath={canGestionar ? "/secretaria" : "/estudiantes"}
				/>
				<Typography variant="h4" gutterBottom>
					Cambio de Comisión
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Solicitá cursar en otro profesorado por superposición horaria o
					motivos laborales.
				</Typography>

				{canGestionar && (
					<Stack
						direction={{ xs: "column", sm: "row" }}
						gap={1}
						sx={{ mt: 2, mb: 1 }}
					>
						<TextField
							label="DNI del estudiante"
							size="small"
							value={dniFiltro}
							onChange={(e) => setDniFiltro(e.target.value)}
							sx={{ maxWidth: 260 }}
						/>
					</Stack>
				)}

				{carrerasData?.carreras && carrerasData.carreras.length > 1 && (
					<Box sx={{ mt: 2, mb: 1 }}>
						<TextField
							select
							label="Profesorado"
							value={activePlanId}
							onChange={(e) => setSelectedPlanId(e.target.value)}
							size="small"
							sx={{ minWidth: 300 }}
						>
							{carrerasData.carreras.flatMap((c) =>
								c.planes.map((p) => (
									<MenuItem key={p.id} value={String(p.id)}>
										{c.nombre} {p.resolucion ? `(Res ${p.resolucion})` : ""}
									</MenuItem>
								))
							)}
						</TextField>
					</Box>
				)}

				{shouldFetch && (
					<Box sx={{ borderBottom: 1, borderColor: "divider", mt: 2 }}>
						<Tabs value={tab} onChange={(_, v) => setTab(v)}>
							<Tab label="Por Superposición" />
							<Tab label="Por Motivos Laborales" />
						</Tabs>
					</Box>
				)}

				{!shouldFetch && canGestionar && (
					<Alert severity="info" sx={{ mt: 2 }}>
						Ingresa el DNI del estudiante para procesar la solicitud.
					</Alert>
				)}

				{tab === 1 && shouldFetch && (
					<Stack spacing={2} sx={{ mt: 2 }}>
						<Alert
							severity="warning"
							variant="filled"
							sx={{
								borderRadius: 2,
								fontWeight: 600,
								fontSize: "0.95rem",
								bgcolor: "#d97706",
								color: "#fff",
								"& .MuiAlert-icon": { color: "#fff" },
							}}
						>
							<strong>Documentación obligatoria:</strong> Los estudiantes que soliciten cambio de comisión por motivos laborales deben presentar en Tutoría, un <u>Certificado de Trabajo</u> original donde consten expresamente los días y horarios de su jornada laboral.
						</Alert>

						<Paper sx={{ p: 2, bgcolor: "grey.50" }}>
							<Typography variant="subtitle2" gutterBottom>
								Definí tu horario laboral:
							</Typography>
							<HorarioLaboralForm value={horarioLab} onChange={setHorarioLab} />
						</Paper>
					</Stack>
				)}

				{queryError && (
					<Alert severity="error" sx={{ mt: 2 }}>
						Error al cargar los datos.
					</Alert>
				)}
				{info && (
					<Alert
						severity="success"
						sx={{ mt: 2 }}
						onClose={() => setInfo(null)}
					>
						{info}
					</Alert>
				)}
				{err && (
					<Alert severity="error" sx={{ mt: 2 }} onClose={() => setErr(null)}>
						{err}
					</Alert>
				)}

				{shouldFetch && !ventanaActiva && (
					<Alert severity="warning" sx={{ mt: 2 }}>
						Sin ventana de inscripción activa. Solicitudes Condicionales.
					</Alert>
				)}

				{shouldFetch && solicitudesEnTramite.length > 0 && (
					<Paper sx={{ p: 2, mt: 2, bgcolor: "info.50", borderColor: "info.main", borderWidth: 1, borderStyle: "solid" }}>
						<Typography variant="subtitle1" fontWeight={700} color="info.main" gutterBottom>
							Solicitudes de Cambio de Comisión en Trámite ({solicitudesEnTramite.length})
						</Typography>
						<Stack gap={1}>
							{solicitudesEnTramite.map((ins) => (
								<Paper key={ins.inscripcion_id} variant="outlined" sx={{ p: 1.5, bgcolor: "background.paper" }}>
									<Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1}>
										<Box flex={1}>
											<Typography variant="subtitle2" fontWeight={700}>
												{ins.materia_nombre}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Comisión actual: {ins.comision_actual?.codigo || "Sin comisión asignada"} → Comisión solicitada: <strong>{ins.comision_solicitada?.codigo} ({ins.comision_solicitada?.turno})</strong>
											</Typography>
										</Box>
										<Stack direction={{ xs: "column", sm: "row" }} alignItems="center" gap={1}>
											<Chip
												label={ins.estado_display || ins.estado || "CONDICIONAL"}
												color={ins.estado === "CONF" ? "success" : "warning"}
												size="small"
												variant="filled"
											/>
											<Button
												size="small"
												color="error"
												onClick={() => mCancelar.mutate(ins.inscripcion_id)}
												disabled={mCancelar.isPending}
											>
												Dar de baja
											</Button>
										</Stack>
									</Stack>
								</Paper>
							))}
						</Stack>
					</Paper>
				)}

				{shouldFetch && materiasConBloqueo.length === 0 ? (
					<Alert severity="info" sx={{ mt: 2 }}>
						No se detectaron materias con bloqueo para este motivo.
						{tab === 1 &&
							horarioLab.length === 0 &&
							" (Carga tu horario laboral para analizar)"}
					</Alert>
				) : shouldFetch ? (
					<Stack gap={2} sx={{ mt: 2 }}>
						{tab === 1 && (
							<Alert severity="warning">
								Las solicitudes se registran bajo carácter <b>CONDICIONAL</b> y
								deben ser aprobadas por un tutor o bedel.
							</Alert>
						)}
						{materiasConBloqueo.map((entrada) => {
							const { materia, horarios, conflictos } = entrada;
							const isExpanded = !!expandedMap[materia.id];

							return (
								<Paper key={materia.id} sx={{ p: 2 }}>
									<Stack gap={1.2}>
										<Typography variant="subtitle1" fontWeight={700}>
											{materia.nombre}
										</Typography>
										<Box>
											<Typography variant="body2" color="text.secondary">
												Horarios: {formatHorarios(horarios)}
											</Typography>
											{materia.profesorado && (
												<Typography variant="body2" color="text.secondary">
													Profesorado: {materia.profesorado}
												</Typography>
											)}
										</Box>
										<Box>
											<Typography variant="body2" fontWeight={500}>
												{tab === 0 ? "Se superpone con:" : "Motivo:"}
											</Typography>
											{tab === 0 ? (
												<Stack component="ul" sx={{ pl: 2, m: 0 }} gap={0.5}>
													{conflictos.map((otro, i) => (
														<li key={i}>
															<Typography variant="body2">
																{otro.nombre} - {formatHorarios(otro.horarios)}
															</Typography>
														</li>
													))}
												</Stack>
											) : (
												<Typography variant="body2" color="error">
													Conflicto con Horario Laboral declarado.
												</Typography>
											)}
										</Box>
										<Button
											size="small"
											onClick={() => toggleExpanded(materia.id)}
										>
											{isExpanded
												? "Ocultar alternativas"
												: "Ver alternativas compatibles"}
										</Button>
										<Collapse in={isExpanded}>
											<Alternativas
												base={entrada}
												otros={inscripcionesConHorario}
												aprobadas={aprobadas}
												disabled={mSolicitar.isPending || !ventanaActiva}
												onSolicitar={(alt) =>
													abrirConfirmacionSolicitud(entrada, alt)
												}
											/>
										</Collapse>
									</Stack>
								</Paper>
							);
						})}
					</Stack>
				) : null}
			</Box>
			<FinalConfirmationDialog
				open={!!solicitudPendiente}
				onConfirm={confirmarSolicitud}
				onCancel={() => setSolicitudPendiente(null)}
				contextText={
					solicitudPendiente
						? `SOLICITUD CONDICIONAL de cambio de comisión para ${solicitudPendiente.materiaNombre} (${solicitudPendiente.comisionLabel}${solicitudPendiente.profesorado ? ` · ${solicitudPendiente.profesorado}` : ""})`
						: "cambio de comisión"
				}
				loading={solicitudLoading}
			/>
		</>
	);
};

function HorarioLaboralForm({
	value,
	onChange,
}: {
	value: HorarioLaboral[];
	onChange: (v: HorarioLaboral[]) => void;
}) {
	const addDay = () =>
		onChange([...value, { dia: 0, desde: "08:00", hasta: "14:00" }]);
	const removeDay = (index: number) =>
		onChange(value.filter((_, i) => i !== index));
	const updateDay = (index: number, patch: Partial<HorarioLaboral>) =>
		onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));

	return (
		<Stack gap={1.5}>
			{value.map((item, idx) => (
				<Stack
					key={idx}
					direction={{ xs: "column", sm: "row" }}
					gap={1}
					alignItems="center"
				>
					<TextField
						select
						SelectProps={{ native: true }}
						size="small"
						value={item.dia}
						onChange={(e) => updateDay(idx, { dia: Number(e.target.value) })}
						sx={{ width: 140 }}
					>
						{DIAS.map((d, i) => (
							<option key={i} value={i}>
								{d}
							</option>
						))}
					</TextField>
					<TextField
						label="Desde"
						type="time"
						size="small"
						value={item.desde}
						onChange={(e) => updateDay(idx, { desde: e.target.value })}
					/>
					<TextField
						label="Hasta"
						type="time"
						size="small"
						value={item.hasta}
						onChange={(e) => updateDay(idx, { hasta: e.target.value })}
					/>
					<Button color="error" size="small" onClick={() => removeDay(idx)}>
						Quitar
					</Button>
				</Stack>
			))}
			<Button
				variant="outlined"
				size="small"
				onClick={addDay}
				sx={{ alignSelf: "start" }}
			>
				+ Agregar Día Laboral
			</Button>
		</Stack>
	);
}

function Alternativas({
	base,
	otros,
	aprobadas,
	disabled,
	onSolicitar,
}: {
	base: MateriaBloqueada;
	otros: InscripcionConHorario[];
	aprobadas: Set<number>;
	disabled: boolean;
	onSolicitar: (alternativa: AlternativaItem) => void;
}) {
	const [items, setItems] = React.useState<AlternativaItem[] | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const otrosKey = React.useMemo(
		() =>
			otros
				.map((o) => o.inscripcion.inscripcion_id)
				.sort()
				.join(","),
		[otros],
	);

	React.useEffect(() => {
		let mounted = true;
		setLoading(true);
		setError(null);
		obtenerEquivalencias(base.materia.id)
			.then((res) => {
				if (!mounted) return;
				const disponibles = filtrarAlternativas(res, base, otros, aprobadas);
				setItems(disponibles);
			})
			.catch((err) => {
				if (mounted) setError(mensajeError(err));
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [base.materia.id, base.cuatrimestre, otrosKey]);  

	return (
		<Box sx={{ mt: 1, pl: 1 }}>
			<Typography variant="subtitle2">
				Alternativas disponibles:
			</Typography>
			{loading && <CircularProgress size={18} sx={{ ml: 1, mt: 1 }} />}
			{!loading && error && (
				<Alert severity="error" sx={{ mt: 1 }}>
					{error}
				</Alert>
			)}
			{!loading && !error && (!items || items.length === 0) && (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
					Sin alternativas compatibles detectadas para este cuatrimestre.
				</Typography>
			)}
			<Grid container spacing={1.5} sx={{ mt: 0.5 }}>
				{(items || []).map((alt) => (
					<Grid item xs={12} md={6} key={alt.comision.id}>
						<Paper variant="outlined" sx={{ p: 1.5 }}>
							<Stack gap={0.5}>
								<Typography variant="subtitle2" color="primary">
									{alt.comision.materia_nombre || alt.profesorado}
								</Typography>
								<Typography variant="body2" sx={{ fontWeight: 'bold' }}>
									{alt.profesorado}
								</Typography>
								<Typography variant="body2">
									{alt.anio ? `Año ${alt.anio} - ` : ""}Comisión {alt.comision.codigo} ({alt.comision.turno})
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{formatHorarios(alt.horarios)}
								</Typography>
								<Button
									size="small"
									variant="contained"
									disabled={disabled}
									onClick={() => onSolicitar(alt)}
								>
									Solicitar Cambio
								</Button>
							</Stack>
						</Paper>
					</Grid>
				))}
			</Grid>
		</Box>
	);
}

function filtrarAlternativas(
	equivalencias: EquivalenciaItemDTO[],
	base: MateriaBloqueada,
	otros: InscripcionConHorario[],
	aprobadas: Set<number>,
): AlternativaItem[] {
	const resultado = new Map<number, AlternativaItem>();

	equivalencias.forEach((eq) => {
		if (aprobadas.has(eq.materia_id)) return;
		if (!mismasEtapas(base.cuatrimestre, eq.cuatrimestre)) return;

		eq.comisiones.forEach((com) => {
			const horarios =
				com.horarios && com.horarios.length ? com.horarios : eq.horarios;
			if (!horarios.length) return;

			// No debe chocar con otras materias
			const chocaConOtros = otros.some((otro) => {
				if (otro.inscripcion.materia_id === base.materia.id) return false;
				if (!cuatrimestreCompatible(eq.cuatrimestre, otro.cuatrimestre))
					return false;
				return hayChoque(horarios, otro.horarios);
			});
			if (chocaConOtros) return;

			if (!resultado.has(com.id)) {
				resultado.set(com.id, {
					comision: com,
					horarios,
					profesorado: eq.profesorado,
					anio: eq.anio ?? null,
				});
			}
		});
	});

	return Array.from(resultado.values()).sort((a, b) => {
		const profCmp = a.profesorado.localeCompare(b.profesorado);
		if (profCmp !== 0) return profCmp;
		const anioA = a.anio ?? 99;
		const anioB = b.anio ?? 99;
		return anioA - anioB;
	});
}

export default CambioComisionPage;
