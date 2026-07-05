/* eslint-disable react-doctor/no-giant-component, react-doctor/query-mutation-missing-invalidation, react-doctor/prefer-module-scope-pure-function, react-doctor/no-array-index-as-key */

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { ComisionDTO } from "@/api/comisiones";
import {
	cerrarPlanillaCursada,
	type FilaCursadaOut,
	generarPlanillasCursada,
	guardarBorradorPlanilla,
	type PlanillaCursadaOut,
	sincronizarPlanilla,
} from "@/api/planillasCursada";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";

const ESTADO_COLOR: Record<string, "warning" | "success" | "info" | "default"> =
	{
		BORRADOR: "warning",
		CERRADA: "default",
		REABIERTA: "info",
	};

const headerCellSx = {
	fontWeight: 600,
	fontSize: "0.75rem",
	textTransform: "uppercase" as const,
	backgroundColor: "grey.100",
	border: "1px solid",
	borderColor: "grey.300",
	whiteSpace: "nowrap" as const,
};

const bodyCellSx = {
	border: "1px solid",
	borderColor: "grey.200",
	px: 1.5,
	py: 1,
	verticalAlign: "middle" as const,
};

type FilaEditable = FilaCursadaOut & {
	_asistencia: string;
	_situacion: string;
};

function filaToEditable(f: FilaCursadaOut): FilaEditable {
	return {
		...f,
		_asistencia:
			f.asistencia_porcentaje !== null ? String(f.asistencia_porcentaje) : "",
		_situacion: f.situacion,
	};
}

export default function PlanillaCursadaFormPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { comisionId } = useParams<{ comisionId: string }>();
	const queryClient = useQueryClient();

	const state = location.state as {
		comision: ComisionDTO;
		cuatrimestre: string;
		anioLectivo: number;
	} | null;

	const comision = state?.comision;
	const cuatrimestre = state?.cuatrimestre ?? "1C";
	const anioLectivo = state?.anioLectivo ?? new Date().getFullYear();

	const [planillas, setPlanillas] = useState<PlanillaCursadaOut[]>([]);
	const [filasEditables, setFilasEditables] = useState<
		Record<number, FilaEditable[]>
	>({});

	// Genera o trae las planillas de esta comisión
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["planillas-cursada", comisionId, anioLectivo, cuatrimestre],
		queryFn: () =>
			generarPlanillasCursada({
				comision_id: Number(comisionId),
				anio_lectivo: anioLectivo,
				cuatrimestre,
			}),
		enabled: !!comisionId,
	});

	useEffect(() => {
		if (data) {
			setPlanillas(data);
			const editable: Record<number, FilaEditable[]> = {};
			data.forEach((p) => {
				editable[p.id] = p.filas.map(filaToEditable);
			});
			setFilasEditables(editable);
		}
	}, [data]);

	const buildFilasPayload = (filas: FilaEditable[]) =>
		filas.map((f) => ({
			fila_id: f.fila_id,
			asistencia_porcentaje:
				f._asistencia !== "" ? parseInt(f._asistencia, 10) : null,
			excepcion: f.excepcion,
			columnas_datos: f.columnas_datos,
			situacion: f._situacion,
		}));

	const guardarMutation = useMutation({
		mutationFn: ({
			planillaId,
			filas,
		}: {
			planillaId: number;
			filas: FilaEditable[];
		}) =>
			guardarBorradorPlanilla(planillaId, { filas: buildFilasPayload(filas) }),
		onSuccess: () => {
			enqueueSnackbar("Borrador guardado correctamente.", {
				variant: "success",
			});
			queryClient.invalidateQueries({
				queryKey: ["planillas-cursada", comisionId],
			});
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onError: (err: any) => {
			const msg =
				err?.response?.data?.message ?? "Error al guardar el borrador.";
			enqueueSnackbar(msg, { variant: "error" });
		},
	});

	const sincronizarMutation = useMutation({
		mutationFn: ({ planillaId }: { planillaId: number }) =>
			sincronizarPlanilla(planillaId, Number(comisionId)),
		onSuccess: (planillaActualizada: PlanillaCursadaOut) => {
			setPlanillas((prev) =>
				prev.map((p) =>
					p.id === planillaActualizada.id ? planillaActualizada : p,
				),
			);
			setFilasEditables((prev) => ({
				...prev,
				[planillaActualizada.id]: planillaActualizada.filas.map(filaToEditable),
			}));
			enqueueSnackbar("Estudiantes agregados correctamente.", {
				variant: "success",
			});
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onError: (err: any) => {
			const msg =
				err?.response?.data?.message ?? "Error al sincronizar la planilla.";
			enqueueSnackbar(msg, { variant: "error" });
		},
	});

	const cerrarMutation = useMutation({
		mutationFn: async ({
			planillaId,
			filas,
		}: {
			planillaId: number;
			filas: FilaEditable[];
		}) => {
			// Guardar primero y luego cerrar
			await guardarBorradorPlanilla(planillaId, {
				filas: buildFilasPayload(filas),
			});
			return cerrarPlanillaCursada(planillaId);
		},
		onSuccess: (data) => {
			enqueueSnackbar(data.message, { variant: "success" });
			queryClient.invalidateQueries({
				queryKey: ["planillas-cursada", comisionId],
			});
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onError: (err: any) => {
			const msg =
				err?.response?.data?.message ?? "Error al cerrar la planilla.";
			enqueueSnackbar(msg, { variant: "error" });
		},
	});

	const handleAsistenciaChange = (
		planillaId: number,
		filaId: number,
		value: string,
	) => {
		setFilasEditables((prev) => ({
			...prev,
			[planillaId]: prev[planillaId].map((f) =>
				f.fila_id === filaId ? { ...f, _asistencia: value } : f,
			),
		}));
	};

	const handleSituacionChange = (
		planillaId: number,
		filaId: number,
		value: string,
	) => {
		setFilasEditables((prev) => ({
			...prev,
			[planillaId]: prev[planillaId].map((f) =>
				f.fila_id === filaId ? { ...f, _situacion: value } : f,
			),
		}));
	};

	const handleColumnaDatoChange = (
		planillaId: number,
		filaId: number,
		colKey: string,
		value: string,
	) => {
		setFilasEditables((prev) => ({
			...prev,
			[planillaId]: prev[planillaId].map((f) =>
				f.fila_id === filaId
					? {
							...f,
							columnas_datos: {
								...f.columnas_datos,
								[colKey]:
									value !== ""
										? isNaN(Number(value))
											? value
											: Number(value)
										: null,
							},
						}
					: f,
			),
		}));
	};

	if (!comision) {
		return (
			<Box sx={{ p: 3 }}>
				<Alert severity="warning">
					No se encontró información de la comisión. Volvé al listado de
					planillas.
				</Alert>
				<Button
					sx={{ mt: 2 }}
					onClick={() => navigate("/docentes/mis-planillas")}
				>
					Volver
				</Button>
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3 }}>
			<Stack spacing={3}>
				<BackButton fallbackPath="/docentes/mis-planillas" />
				<PageHero
					title={comision.materia_nombre}
					subtitle={`${comision.profesorado_nombre} — ${cuatrimestre} ${anioLectivo}`}
				/>

				{isLoading && (
					<Stack direction="row" spacing={1} alignItems="center">
						<CircularProgress size={18} />
						<Typography variant="body2" color="text.secondary">
							Cargando planilla...
						</Typography>
					</Stack>
				)}

				{isError && (
					<Alert severity="error">
						{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
						{(error as any)?.response?.data?.message ??
							"No se pudo cargar la planilla. Verificá tus permisos."}
					</Alert>
				)}

				{!isLoading && !isError && planillas.length === 0 && (
					<Alert severity="info">
						No hay estudiantes inscriptos activos en esta comisión.
					</Alert>
				)}

				{planillas.map((planilla) => {
					const filas = filasEditables[planilla.id] ?? [];
					const esCerrada = planilla.estado === "CERRADA";
					const esInterProf =
						planilla.profesorado_id !== planilla.profesorado_destino_id;

					return (
						<Paper key={planilla.id} variant="outlined" sx={{ p: 2 }}>
							<Stack spacing={2}>
								{/* Encabezado de planilla */}
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="flex-start"
									flexWrap="wrap"
									gap={1}
								>
									<Box>
										<Typography variant="subtitle1" fontWeight={600}>
											{planilla.numero}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											{planilla.materia_nombre}
											{esInterProf && (
												<Tooltip
													title={`Nota va a: ${planilla.profesorado_destino_nombre}`}
												>
													<Chip
														label={`→ ${planilla.profesorado_destino_nombre}`}
														size="small"
														color="info"
														sx={{ ml: 1 }}
													/>
												</Tooltip>
											)}
										</Typography>
									</Box>
									<Chip
										label={planilla.estado}
										size="small"
										color={ESTADO_COLOR[planilla.estado] ?? "default"}
									/>
								</Stack>

								{esCerrada && (
									<Alert severity="info">
										Esta planilla está cerrada. Solo Secretaría puede reabrirla.
									</Alert>
								)}

								{/* Tabla de filas */}
								<TableContainer
									component={Paper}
									variant="outlined"
									sx={{ mt: 1 }}
								>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell
													sx={{ ...headerCellSx, width: 60 }}
													rowSpan={2}
												>
													N°
												</TableCell>
												<TableCell
													sx={{ ...headerCellSx, minWidth: 240 }}
													rowSpan={2}
												>
													Estudiantes
												</TableCell>
												<TableCell
													sx={{ ...headerCellSx, width: 140 }}
													rowSpan={2}
												>
													DNI
												</TableCell>

												{/* Render Groups for Dynamic Columns */}
												{(() => {
													const groups: { name: string; span: number }[] = [];
													let currentGroup = "";
													let currentSpan = 0;

													(planilla.columnas ?? []).forEach((col) => {
														const gName = col.group || "";
														if (gName !== currentGroup) {
															if (currentSpan > 0)
																groups.push({
																	name: currentGroup,
																	span: currentSpan,
																});
															currentGroup = gName;
															currentSpan = 1;
														} else {
															currentSpan++;
														}
													});
													if (currentSpan > 0)
														groups.push({
															name: currentGroup,
															span: currentSpan,
														});

													if (
														groups.length === 0 &&
														(planilla.columnas ?? []).length > 0
													) {
														return (
															<TableCell
																sx={{ ...headerCellSx, textAlign: "center" }}
																colSpan={planilla.columnas?.length}
															>
																Nota de trabajos prácticos
															</TableCell>
														);
													}

													return groups.map((g, idx) => (
														<TableCell
															key={`group-${idx}`}
															sx={{ ...headerCellSx, textAlign: "center" }}
															colSpan={g.span}
														>
															{g.name}
														</TableCell>
													));
												})()}

												<TableCell
													sx={{
														...headerCellSx,
														width: 80,
														textAlign: "center",
													}}
													rowSpan={2}
												>
													Final
												</TableCell>
												<TableCell
													sx={{
														...headerCellSx,
														width: 80,
														textAlign: "center",
													}}
													rowSpan={2}
												>
													Asistencia
												</TableCell>
												<TableCell
													sx={{ ...headerCellSx, minWidth: 200 }}
													rowSpan={2}
												>
													Situación académica
												</TableCell>
											</TableRow>
											<TableRow>
												{(planilla.columnas ?? []).map((col) => (
													<TableCell
														sx={{ ...headerCellSx, width: 80, minWidth: 80 }}
														key={col.key}
													>
														<Typography
															variant="body2"
															sx={{ fontSize: "0.70rem" }}
														>
															{col.label}
														</Typography>
														{col.optional ? (
															<Typography
																variant="caption"
																color="text.secondary"
																sx={{ fontSize: "0.65rem" }}
															>
																(opt)
															</Typography>
														) : null}
													</TableCell>
												))}
											</TableRow>
										</TableHead>
										<TableBody>
											{filas.map((fila) => (
												<TableRow key={fila.fila_id}>
													<TableCell
														sx={{
															...bodyCellSx,
															width: 60,
															textAlign: "center",
														}}
													>
														<Typography variant="body2" fontWeight={600}>
															{fila.orden}
														</Typography>
													</TableCell>
													<TableCell sx={{ ...bodyCellSx, minWidth: 320 }}>
														<Box sx={{ display: "flex", alignItems: "center" }}>
															<Typography variant="body2">
																{fila.apellido_nombre}
															</Typography>
															{fila.en_resguardo && (
																<Tooltip title="Nota en resguardo — legajo incompleto">
																	<Chip
																		label="Resguardo"
																		size="small"
																		color="warning"
																		sx={{ ml: 1 }}
																	/>
																</Tooltip>
															)}
														</Box>
													</TableCell>
													<TableCell sx={{ ...bodyCellSx, width: 100 }}>
														{fila.dni}
													</TableCell>
													{(planilla.columnas ?? []).map((col) => (
														<TableCell
															key={col.key}
															sx={{ ...bodyCellSx, width: 80 }}
															align="center"
														>
															<TextField
																size="small"
																type={col.type === "number" ? "number" : "text"}
																value={fila.columnas_datos?.[col.key] ?? ""}
																disabled={esCerrada}
																onChange={(e) =>
																	handleColumnaDatoChange(
																		planilla.id,
																		fila.fila_id,
																		col.key,
																		e.target.value,
																	)
																}
																sx={{ width: 80 }}
															/>
														</TableCell>
													))}
													{/* Final column cell */}
													<TableCell
														sx={{ ...bodyCellSx, width: 80 }}
														align="center"
													>
														<TextField
															size="small"
															type="number"
															disabled
															value={fila.columnas_datos?.final ?? ""}
															placeholder="--"
															sx={{ width: 60 }}
														/>
													</TableCell>
													<TableCell
														sx={{ ...bodyCellSx, width: 100 }}
														align="center"
													>
														<TextField
															size="small"
															type="number"
															value={fila._asistencia}
															disabled={esCerrada}
															onChange={(e) =>
																handleAsistenciaChange(
																	planilla.id,
																	fila.fila_id,
																	e.target.value,
																)
															}
															inputProps={{ min: 0, max: 100 }}
															InputProps={{
																endAdornment: (
																	<InputAdornment position="end">
																		%
																	</InputAdornment>
																),
															}}
															sx={{ width: 100 }}
														/>
													</TableCell>
													<TableCell sx={{ ...bodyCellSx, minWidth: 200 }}>
														<TextField
															select
															size="small"
															value={fila._situacion}
															disabled={esCerrada}
															onChange={(e) =>
																handleSituacionChange(
																	planilla.id,
																	fila.fila_id,
																	e.target.value,
																)
															}
															sx={{ width: "100%" }}
															SelectProps={{ native: true }}
														>
															<option value="">-- Seleccionar --</option>
															{planilla.situaciones?.map((sit) => (
																<option key={sit.codigo} value={sit.codigo}>
																	{sit.label}
																</option>
															))}
														</TextField>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</TableContainer>

								{!esCerrada && (
									<>
										<Divider />
										<Typography variant="caption" color="text.secondary">
											La asistencia se pre-carga desde el módulo de asistencia
											si hay clases registradas. Podés modificarla hasta el
											cierre.
										</Typography>
										<Stack
											direction="row"
											spacing={2}
											justifyContent="space-between"
											alignItems="center"
										>
											<Button
												variant="outlined"
												color="secondary"
												size="small"
												disabled={sincronizarMutation.isPending}
												onClick={() =>
													sincronizarMutation.mutate({
														planillaId: planilla.id,
													})
												}
											>
												Agregar inscriptos faltantes
											</Button>
											<Stack direction="row" spacing={2}>
												<Button
													variant="outlined"
													disabled={
														guardarMutation.isPending ||
														cerrarMutation.isPending
													}
													onClick={() =>
														guardarMutation.mutate({
															planillaId: planilla.id,
															filas,
														})
													}
												>
													Guardar borrador
												</Button>
												<Button
													variant="contained"
													color="success"
													disabled={
														guardarMutation.isPending ||
														cerrarMutation.isPending
													}
													onClick={() =>
														cerrarMutation.mutate({
															planillaId: planilla.id,
															filas,
														})
													}
												>
													Guardar y cerrar planilla
												</Button>
											</Stack>
										</Stack>
									</>
								)}
							</Stack>
						</Paper>
					);
				})}
			</Stack>
		</Box>
	);
}
