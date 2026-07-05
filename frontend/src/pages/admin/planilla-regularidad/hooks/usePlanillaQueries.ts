import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import {
	type GuardarRegularidadPayload,
	guardarPlanillaRegularidad,
	obtenerDocentesDefecto as obtenerDocentesDefectoStandard,
	obtenerPlanillaRegularidad,
} from "@/api/cargaNotas";
import {
	actualizarPlanillaRegularidad,
	crearPlanillaRegularidad,
	obtenerDocentesDefecto,
	obtenerInscriptosActivos,
	obtenerPlanillaRegularidadDetalle,
	type PlanillaRegularidadCreatePayload,
	type PlanillaRegularidadCreateResult,
	type PlanillaRegularidadFilaPayload,
} from "@/api/primeraCarga";
import { buildDefaultRow, todayIso } from "../constants";
import type {
	PlanillaDetalleResponse,
	PlanillaFormValues,
	PlanillaSubmitResult,
} from "../types";

interface UsePlanillaQueriesOptions {
	open: boolean;
	scope: "primera_carga" | "standard";
	planillaId?: number | null;
	comisionId?: number | null;
	defaultProfesoradoId?: number;
	defaultMateriaId?: number;
	mode: "create" | "edit" | "view";
	watchMateriaId: string | number;
	watchProfesoradoId: string | number;
	watchFechaYear: number;
	onClose: () => void;
	onCreated?: (
		result: PlanillaRegularidadCreateResult | undefined,
		dryRun: boolean,
	) => void;
	getValues: UseFormGetValues<PlanillaFormValues>;
	setValue: UseFormSetValue<PlanillaFormValues>;
	persistStudents: boolean;
}

export function usePlanillaQueries({
	open,
	scope,
	planillaId,
	comisionId,
	defaultProfesoradoId,
	defaultMateriaId,
	mode,
	watchMateriaId,
	watchProfesoradoId,
	watchFechaYear,
	onClose,
	onCreated,
	getValues,
	setValue,
	persistStudents,
}: UsePlanillaQueriesOptions) {
	const queryClient = useQueryClient();

	const detailQuery = useQuery<PlanillaDetalleResponse>({
		queryKey:
			scope === "standard"
				? ["carga-notas", "regularidad", comisionId]
				: ["primera-carga", "regularidades", "detalle", planillaId],
		queryFn: async (): Promise<PlanillaDetalleResponse> => {
			if (scope === "standard") {
				const data = await obtenerPlanillaRegularidad(comisionId!);
				let defDocentes: Awaited<
					ReturnType<typeof obtenerDocentesDefectoStandard>
				> = [];
				try {
					const profId = data.profesorado_id || defaultProfesoradoId || 0;
					const matId = data.materia_id || defaultMateriaId || 0;
					const year = data.anio || new Date().getFullYear();
					if (profId && matId) {
						defDocentes = await obtenerDocentesDefectoStandard(
							Number(matId),
							Number(profId),
							year,
						);
					}
				} catch (_err) {
					void 0;
				}

				const mappedDocentes =
					defDocentes.length > 0
						? defDocentes.map((doc, idx) => ({
								docente_id: doc.docente_id,
								nombre: doc.nombre,
								dni: doc.dni || "",
								rol: doc.rol || "profesor",
								orden: doc.orden ?? idx + 1,
							}))
						: data.docentes.map((name: string, idx: number) => ({
								docente_id: null,
								nombre: name,
								dni: "",
								rol: idx === 0 ? "profesor" : "bedel",
								orden: idx + 1,
							}));

				return {
					ok: true,
					message: "Planilla cargada",
					data: {
						profesorado_id: data.profesorado_id || defaultProfesoradoId || "",
						materia_id: data.materia_id || defaultMateriaId || "",
						profesorado_nombre: data.profesorado_nombre || "",
						materia_nombre: data.materia_nombre || "",
						materia_anio: data.materia_anio || null,
						formato: data.formato || "",
						regimen: data.regimen || "",
						plantilla_id: 1,
						fecha: data.fecha_cierre || todayIso(),
						folio: "",
						plan_resolucion: data.plan_resolucion || "",
						observaciones: "",
						docentes: mappedDocentes,
						filas: data.estudiantes.map((e, idx) => ({
							orden: e.orden || idx + 1,
							dni: e.dni,
							apellido_nombre: e.apellido_nombre,
							nota_final: e.nota_final !== null ? String(e.nota_final) : "",
							asistencia: e.asistencia !== null ? String(e.asistencia) : "",
							situacion: e.situacion || "",
							excepcion: e.excepcion ?? false,
							datos: (e.datos as Record<
								string,
								string | number | null | undefined
							>) || {
								tp_final: e.nota_tp !== null ? String(e.nota_tp) : "",
							},
							inscripcion_id: e.inscripcion_id,
						})),
						estado: data.esta_cerrada ? "final" : "draft",
						force_upgrade: false,
						situaciones: data.situaciones,
					},
				};
			}
			return obtenerPlanillaRegularidadDetalle(planillaId!);
		},
		enabled: open && (scope === "standard" ? !!comisionId : !!planillaId),
	});

	const inscriptosActivosQuery = useQuery({
		queryKey: [
			"primera-carga",
			"materias",
			watchMateriaId,
			"inscriptos-activos",
			watchFechaYear,
		],
		queryFn: () =>
			obtenerInscriptosActivos(Number(watchMateriaId), watchFechaYear),
		enabled:
			open &&
			mode === "create" &&
			!!watchMateriaId &&
			scope === "primera_carga",
	});

	const docentesDefectoQuery = useQuery({
		queryKey:
			scope === "standard"
				? [
						"carga-notas",
						"materias",
						watchMateriaId,
						"docentes-defecto",
						watchProfesoradoId,
						watchFechaYear,
					]
				: [
						"primera-carga",
						"materias",
						watchMateriaId,
						"docentes-defecto",
						watchProfesoradoId,
						watchFechaYear,
					],
		queryFn: () => {
			if (scope === "standard") {
				return obtenerDocentesDefectoStandard(
					Number(watchMateriaId),
					Number(watchProfesoradoId),
					watchFechaYear,
				);
			}
			return obtenerDocentesDefecto(
				Number(watchMateriaId),
				Number(watchProfesoradoId),
				watchFechaYear,
			);
		},
		enabled:
			open &&
			(mode === "create" || scope === "standard") &&
			!!watchMateriaId &&
			!!watchProfesoradoId,
	});

	const mutation = useMutation<
		PlanillaSubmitResult,
		unknown,
		PlanillaRegularidadCreatePayload
	>({
		mutationFn: async (payload: PlanillaRegularidadCreatePayload) => {
			if (scope === "standard") {
				const parseVal = (v: string | number | null | undefined) => {
					if (
						v === undefined ||
						v === null ||
						String(v).trim() === "" ||
						String(v).trim() === "---"
					)
						return null;
					return Number(String(v).replace(",", "."));
				};
				const standardPayload: GuardarRegularidadPayload = {
					comision_id: comisionId!,
					fecha_cierre: payload.fecha,
					observaciones_generales: payload.observaciones || undefined,
					estudiantes: payload.filas.map(
						(
							f: PlanillaRegularidadFilaPayload & {
								inscripcion_id?: number;
								observaciones?: string;
							},
						) => ({
							inscripcion_id: f.inscripcion_id || 0,
							nota_tp: f.datos?.tp_final
								? parseVal(f.datos.tp_final)
								: f.datos?.tp_1c
									? parseVal(f.datos.tp_1c)
									: null,
							nota_final: f.nota_final ? parseVal(f.nota_final) : null,
							asistencia: f.asistencia ? parseVal(f.asistencia) : null,
							excepcion: f.excepcion,
							situacion: f.situacion,
							observaciones: f.observaciones || undefined,
							datos: f.datos || {},
						}),
					),
				};
				return guardarPlanillaRegularidad(standardPayload);
			}

			if (mode === "edit" && planillaId) {
				return actualizarPlanillaRegularidad(planillaId, payload);
			}
			return crearPlanillaRegularidad(payload);
		},
		onSuccess: (data, variables) => {
			if (scope === "standard") {
				queryClient.invalidateQueries({
					queryKey: ["carga-notas", "regularidad", comisionId],
				});
				enqueueSnackbar(
					data.message || "Notas de regularidad guardadas correctamente.",
					{ variant: "success" },
				);
				onClose();
				return;
			}

			queryClient.invalidateQueries({
				queryKey: ["primera-carga", "regularidades", "historial"],
			});
			enqueueSnackbar(data.message, { variant: "success" });

			if (typeof data.data?.regularidades_registradas === "number") {
				const count = data.data.regularidades_registradas;
				const messageDetalle = variables.dry_run
					? `Simuladas ${count} regularidades.`
					: `${count} regularidades registradas.`;
				enqueueSnackbar(messageDetalle, { variant: "info" });
			}
			if (data.data?.warnings?.length) {
				data.data.warnings.forEach((warning: string) => {
					if (warning && !warning.includes("No se encontró inscripción")) {
						enqueueSnackbar(warning, { variant: "warning" });
					}
				});
			}
			if (!variables.dry_run && data.data?.pdf_url) {
				const base = import.meta.env.VITE_API_BASE || window.location.origin;
				const mediaBase = base.replace(/\/api\/?$/, "/");
				let targetUrl = data.data.pdf_url;
				if (!/^https?:\/\//i.test(targetUrl)) {
					try {
						targetUrl = new URL(targetUrl, mediaBase).toString();
					} catch {
						// intentionally empty — URL parsing failure keeps original targetUrl
					}
				}
				window.open(targetUrl, "_blank", "noopener,noreferrer");
			}

			onCreated?.(data.data ?? undefined, !!variables.dry_run);

			if (!variables.dry_run && !planillaId && persistStudents) {
				const serverFilas: Array<{ dni: string; apellido_nombre: string }> =
					data.data?.filas || getValues("filas");
				const preservedFilas = serverFilas.map((f, idx) => ({
					...buildDefaultRow(idx),
					dni: f.dni,
					apellido_nombre: f.apellido_nombre,
					orden: idx + 1,
				}));

				setValue("materiaId", "");
				setValue("plantillaId", "");
				setValue("folio", "");
				setValue("observaciones", "");
				setValue("filas", preservedFilas);

				enqueueSnackbar(
					"Se han mantenido los estudiantes para la siguiente carga. Seleccione nueva materia.",
					{ variant: "info" },
				);
			} else {
				onClose();
			}
		},
		onError: (error: unknown) => {
			const message =
				(error as { response?: { data?: { message?: string } } })?.response
					?.data?.message ?? "No se pudo generar la planilla.";
			enqueueSnackbar(message, { variant: "error" });
		},
	});

	return {
		detailQuery,
		inscriptosActivosQuery,
		docentesDefectoQuery,
		mutation,
	};
}
