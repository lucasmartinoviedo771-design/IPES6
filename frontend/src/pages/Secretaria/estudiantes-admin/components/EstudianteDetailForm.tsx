import AddIcon from "@mui/icons-material/Add";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
	type Control,
	Controller,
	type UseFormHandleSubmit,
	type UseFormWatch,
} from "react-hook-form";
import { listarTodosProfesorados } from "@/api/cargaNotas";
import type { CarreraStatus } from "@/api/estudiantes/types";
import { useAuth } from "@/context/AuthContext";
import {
	type DetailDocumentacionForm,
	type DetailFormValues,
	ESTADO_ACADEMICO_OPTIONS,
	type EstadoLegajo,
	generoOptions,
	normalizeDoc,
} from "../types";
import { DocumentacionSection } from "./DocumentacionSection";

type Props = {
	control: Control<DetailFormValues>;
	handleSubmit: UseFormHandleSubmit<DetailFormValues>;
	watch: UseFormWatch<DetailFormValues>;
		setValue: (name: any, value: any, options?: any) => void;
	onSubmit: (values: DetailFormValues) => void;
	anioIngresoOptions: string[];
	docValues: DetailDocumentacionForm;
	anyMainSelected: boolean;
	handleMainDocChange: (
		target: keyof DetailDocumentacionForm,
	) => (_: unknown, checked: boolean) => void;
	handleAdeudaChange: (_: unknown, checked: boolean) => void;
	handleEstudianteRegularChange: (_: unknown, checked: boolean) => void;
	activeTab: number;
	autorizadoSwitch: boolean;
	setAutorizadoSwitch: (val: boolean) => void;
	autorizadoObs: string;
	setAutorizadoObs: (val: string) => void;
	onAutorizarRendir?: (
		autorizado: boolean,
		observacion: string,
		materias_autorizadas?: number[],
	) => void;
	autorizarRendirIsPending?: boolean;
	onAgregarCarrera?: (profesorado_id: number, anio_ingreso?: number) => void;
	agregarCarreraIsPending?: boolean;
		detailData?: any;
	isAdmin?: boolean;
	isAttp?: boolean;
	isRectorado?: boolean;
	carrerasDetalle?: CarreraStatus[];
};

export function EstudianteDetailForm({
	control,
	handleSubmit,
	watch,
	setValue,
	onSubmit,
	anioIngresoOptions,
	docValues,
	anyMainSelected,
	handleMainDocChange,
	handleAdeudaChange,
	handleEstudianteRegularChange,
	activeTab,
	autorizadoSwitch,
	setAutorizadoSwitch,
	autorizadoObs,
	setAutorizadoObs,
	onAutorizarRendir,
	autorizarRendirIsPending,
	onAgregarCarrera,
	agregarCarreraIsPending,
	detailData,
	isAdmin = true,
	isAttp = false,
	isRectorado = false,
	carrerasDetalle,
}: Props) {
	const [materiasAutorizadas, setMateriasAutorizadas] = React.useState<
		number[]
	>(detailData?.materias_autorizadas || []);
	const [agregarCarreraOpen, setAgregarCarreraOpen] = useState(false);
	const [nuevaCarreraId, setNuevaCarreraId] = useState<number | "">("");

	const { user } = useAuth();
	const myProfIds = user?.profesorado_ids ?? null;

	const { data: profesorados = [] } = useQuery({
		queryKey: ["profesorados-todos"],
		queryFn: () => listarTodosProfesorados(),
		enabled: agregarCarreraOpen,
	});

		const carrerasActualesIds = new Set(
		(watch("carreras_situacion") || []).map((c: any) => c.profesorado_id),
	);
	const profesoradosDisponibles = profesorados.filter((p) => {
		if (carrerasActualesIds.has(p.id)) return false;
		if (myProfIds !== null && !myProfIds.includes(p.id)) return false;
		return true;
	});

	const handleConfirmarAgregarCarrera = () => {
		if (!nuevaCarreraId || !onAgregarCarrera) return;
		onAgregarCarrera(nuevaCarreraId as number);
		setAgregarCarreraOpen(false);
		setNuevaCarreraId("");
	};

	React.useEffect(() => {
		if (detailData?.materias_autorizadas) {
			setMateriasAutorizadas(detailData.materias_autorizadas);
		}
	}, [detailData]);

	const handleMateriaToggle = (materiaId: number) => {
		setMateriasAutorizadas((prev) =>
			prev.includes(materiaId)
				? prev.filter((id) => id !== materiaId)
				: [...prev, materiaId],
		);
	};
	return (
		<form id="estudiante-admin-form" onSubmit={handleSubmit(onSubmit)}>
			<fieldset
				disabled={isRectorado}
				style={{ border: "none", margin: 0, padding: 0 }}
			>
				<Stack spacing={3}>
					{/* TAB 0: DATOS PERSONALES */}
					{activeTab === 0 && (
						<fieldset
							disabled={isAttp}
							style={{ border: "none", margin: 0, padding: 0 }}
						>
							<Stack spacing={2.0}>
								<Divider>Identidad y Nacimiento</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="dni"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="DNI"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="cuil"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="CUIL"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="apellido"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Apellido"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="nombre"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Nombre"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="fecha_nacimiento"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Fecha de nacimiento"
												size="small"
												placeholder="DD/MM/AAAA"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="genero"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												select
												label="Genero"
												size="small"
												fullWidth
											>
												{generoOptions.map((option) => (
													<MenuItem key={option.value} value={option.value}>
														{option.label}
													</MenuItem>
												))}
											</TextField>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="nacionalidad"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Nacionalidad"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="estado_civil"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Estado Civil"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>

								<Divider>Lugar de Nacimiento</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="localidad_nac"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Localidad de Nacimiento"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="provincia_nac"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Provincia de Nacimiento"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="pais_nac"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="País de Nacimiento"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>

								<Divider>Contacto y Domicilio</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="telefono"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Teléfono / Celular"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="domicilio"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Domicilio"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="emergencia_telefono"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Teléfono de Emergencia"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="emergencia_parentesco"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Parentesco"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>

								<Divider>Salud y Accesibilidad</Divider>
								<Stack direction="row" spacing={2} flexWrap="wrap">
									<Controller
										name="cud_informado"
										control={control}
										render={({ field }) => (
											<FormControlLabel
												control={
													<Checkbox
														checked={field.value}
														onChange={(e) => field.onChange(e.target.checked)}
													/>
												}
												label="Posee CUD"
											/>
										)}
									/>
									<Controller
										name="condicion_salud_informada"
										control={control}
										render={({ field }) => (
											<FormControlLabel
												control={
													<Checkbox
														checked={field.value}
														onChange={(e) => field.onChange(e.target.checked)}
													/>
												}
												label="Informa condición de salud"
											/>
										)}
									/>
								</Stack>
								<Controller
									name="condicion_salud_detalle"
									control={control}
									render={({ field }) => (
										<TextField
											{...field}
											label="Detalle de salud / Apoyo necesario"
											size="small"
											multiline
											rows={2}
											fullWidth
										/>
									)}
								/>

								<Divider>Estudios Secundarios</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="sec_titulo"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Título obtenido"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sec_establecimiento"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Establecimiento"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sec_fecha_egreso"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Fecha de egreso"
												size="small"
												placeholder="AAAA-MM-DD"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="sec_localidad"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Localidad"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sec_provincia"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Provincia"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sec_pais"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="País"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>

								<Divider>Estudios Superiores Previos</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="sup1_titulo"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Título obtenido"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sup1_establecimiento"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Establecimiento"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sup1_fecha_egreso"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Fecha de egreso"
												size="small"
												placeholder="AAAA-MM-DD"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="sup1_localidad"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Localidad"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sup1_provincia"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Provincia"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="sup1_pais"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="País"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>

								<Divider>Situación Laboral</Divider>
								<Stack
									direction={{ xs: "column", md: "row" }}
									spacing={2}
									alignItems="center"
								>
									<Controller
										name="trabaja"
										control={control}
										render={({ field }) => (
											<FormControlLabel
												control={
													<Checkbox
														checked={field.value}
														onChange={(e) => field.onChange(e.target.checked)}
													/>
												}
												label="¿Trabaja actualmente?"
											/>
										)}
									/>
									<Controller
										name="empleador"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Empleador"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="horario_trabajo"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Horario de trabajo"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="domicilio_trabajo"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Domicilio de trabajo"
												size="small"
												fullWidth
											/>
										)}
									/>
								</Stack>
							</Stack>
						</fieldset>
					)}

					{/* TAB 1: SITUACION ACADEMICA */}
					{activeTab === 1 && isAdmin && (
						<>
							<Box mb={2}>
								<Typography variant="subtitle2" gutterBottom>
									Accesos Rápidos
								</Typography>
								<Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
									<Button
										size="small"
										variant="outlined"
										onClick={() =>
											window.open(
												`/estudiantes/trayectoria?dni=${detailData?.dni}`,
												"_blank",
											)
										}
									>
										Trayectoria
									</Button>
									<Button
										size="small"
										variant="outlined"
										onClick={() =>
											window.open(
												`/estudiantes/horarios?dni=${detailData?.dni}`,
												"_blank",
											)
										}
									>
										Horarios
									</Button>
									<Button
										size="small"
										variant="outlined"
										onClick={() =>
											window.open(
												`/estudiantes/inscripcion-materia?dni=${detailData?.dni}`,
												"_blank",
											)
										}
									>
										Inscripción
									</Button>
									<Button
										size="small"
										variant="outlined"
										onClick={() =>
											window.open(
												`/preinscripciones?search=${detailData?.dni}`,
												"_blank",
											)
										}
									>
										Ver Preinscripción
									</Button>
									<Button
										size="small"
										variant="outlined"
										onClick={() =>
											window.open(
												`/api/preinscripciones/estudiante/${detailData?.dni}/pdf`,
												"_blank",
											)
										}
									>
										PDF Preinscripción
									</Button>
								</Stack>
							</Box>

							<Divider sx={{ mb: 1 }}>Gestión de Carreras</Divider>
							{watch("carreras_situacion")?.map((c, index) => (
								<Box
									key={c.profesorado_id}
									sx={{
										p: 2,
										bgcolor: "background.default",
										borderRadius: 1,
										border: "1px solid",
										borderColor: "divider",
										mb: 1,
									}}
								>
									<Typography
										variant="subtitle2"
										color="primary"
										sx={{ mb: 1.5, fontWeight: 700 }}
									>
										{c.nombre}
									</Typography>
									<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
										<Controller
											name={`carreras_situacion.${index}.estado_academico`}
											control={control}
											render={({ field }) => (
												<TextField
													{...field}
													select
													label="Estado Académico"
													size="small"
													fullWidth
												>
													{ESTADO_ACADEMICO_OPTIONS.filter((o) => o.value).map(
														(option) => (
															<MenuItem key={option.value} value={option.value}>
																{option.label}
															</MenuItem>
														),
													)}
												</TextField>
											)}
										/>
									</Stack>
								</Box>
							))}

							{onAgregarCarrera && (
								<Button
									size="small"
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={() => setAgregarCarreraOpen(true)}
									sx={{ mt: 1 }}
								>
									Agregar a otra carrera
								</Button>
							)}

							<Dialog
								open={agregarCarreraOpen}
								onClose={() => setAgregarCarreraOpen(false)}
								maxWidth="xs"
								fullWidth
							>
								<DialogTitle>Agregar a otra carrera</DialogTitle>
								<DialogContent>
									<TextField
										select
										label="Carrera"
										value={nuevaCarreraId}
										onChange={(e) => setNuevaCarreraId(Number(e.target.value))}
										size="small"
										fullWidth
										sx={{ mt: 1 }}
									>
										{profesoradosDisponibles.length === 0 && (
											<MenuItem disabled value="">
												Sin carreras disponibles
											</MenuItem>
										)}
										{profesoradosDisponibles.map((p) => (
											<MenuItem key={p.id} value={p.id}>
												{p.nombre}
											</MenuItem>
										))}
									</TextField>
								</DialogContent>
								<DialogActions>
									<Button
										onClick={() => {
											setAgregarCarreraOpen(false);
											setNuevaCarreraId("");
										}}
									>
										Cancelar
									</Button>
									<Button
										variant="contained"
										onClick={handleConfirmarAgregarCarrera}
										disabled={!nuevaCarreraId || agregarCarreraIsPending}
									>
										{agregarCarreraIsPending ? (
											<CircularProgress size={18} />
										) : (
											"Confirmar"
										)}
									</Button>
								</DialogActions>
							</Dialog>

							<fieldset
								disabled={isAttp}
								style={{ border: "none", margin: 0, padding: 0 }}
							>
								<Divider sx={{ mb: 1 }}>Datos de Sistema</Divider>
								<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
									<Controller
										name="email"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												label="Email registrado"
												size="small"
												fullWidth
											/>
										)}
									/>
									<Controller
										name="anio_ingreso"
										control={control}
										render={({ field }) => (
											<TextField
												{...field}
												select
												label="Año de ingreso"
												size="small"
												fullWidth
											>
												<MenuItem value="">Sin especificar</MenuItem>
												{anioIngresoOptions.map((option) => (
													<MenuItem key={option} value={option}>
														{option}
													</MenuItem>
												))}
											</TextField>
										)}
									/>
								</Stack>
								<Stack direction="row" spacing={2}>
									<Controller
										name="activo"
										control={control}
										render={({ field }) => (
											<FormControlLabel
												control={
													<Checkbox
														checked={field.value}
														onChange={(e) => field.onChange(e.target.checked)}
													/>
												}
												label="Permitir acceso al sistema (Login Cuenta)"
											/>
										)}
									/>
								</Stack>
							</fieldset>
						</>
					)}

					{/* TAB 2: LEGAJO Y DOCUMENTACION */}
					{activeTab === 2 && isAdmin && (
						<fieldset
							disabled={isAttp}
							style={{ border: "none", margin: 0, padding: 0 }}
						>
							<>
								{/* Selector de carrera cuando el estudiante tiene múltiples */}
								{carrerasDetalle && carrerasDetalle.length > 1 && (
									<Controller
										name="legajo_profesorado_id"
										control={control}
										render={({ field }) => (
											<FormControl fullWidth size="small" sx={{ mb: 2 }}>
												<InputLabel>Editando legajo de</InputLabel>
												<Select
													value={
														field.value ??
														carrerasDetalle[0]?.profesorado_id ??
														""
													}
													label="Editando legajo de"
													onChange={(e) => {
														const newId = e.target.value as number;
														field.onChange(newId);
														const carrera = carrerasDetalle.find(
															(c) => c.profesorado_id === newId,
														);
														if (carrera) {
															setValue(
																"documentacion",
																normalizeDoc(carrera.documentacion),
																{ shouldDirty: false },
															);
															setValue(
																"curso_introductorio_aprobado",
																carrera.curso_introductorio_aprobado ?? false,
																{ shouldDirty: false },
															);
															setValue(
																"libreta_entregada",
																carrera.libreta_entregada ?? false,
																{ shouldDirty: false },
															);
															setValue(
																"estado_legajo",
																(carrera.estado_legajo ??
																	"PEN") as EstadoLegajo,
																{ shouldDirty: false },
															);
														}
													}}
												>
													{carrerasDetalle.map((c) => (
														<MenuItem
															key={c.profesorado_id}
															value={c.profesorado_id}
														>
															{c.nombre}
														</MenuItem>
													))}
												</Select>
											</FormControl>
										)}
									/>
								)}
								<Box mb={2}>
									<Stack direction="row" spacing={2}>
										<Controller
											name="curso_introductorio_aprobado"
											control={control}
											render={({ field }) => (
												<FormControlLabel
													control={
														<Checkbox
															checked={Boolean(field.value)}
															onChange={(e) => field.onChange(e.target.checked)}
														/>
													}
													label="Curso introductorio aprobado"
												/>
											)}
										/>
										<Controller
											name="libreta_entregada"
											control={control}
											render={({ field }) => (
												<FormControlLabel
													control={
														<Checkbox
															checked={Boolean(field.value)}
															onChange={(e) => field.onChange(e.target.checked)}
														/>
													}
													label="Libreta entregada"
												/>
											)}
										/>
									</Stack>
								</Box>

								<DocumentacionSection
									docValues={docValues}
									anyMainSelected={anyMainSelected}
									control={control}
									setValue={setValue}
									handleMainDocChange={handleMainDocChange}
									handleAdeudaChange={handleAdeudaChange}
									handleEstudianteRegularChange={handleEstudianteRegularChange}
								/>

								<Divider sx={{ my: 2 }}>Observaciones</Divider>
								<Controller
									name="observaciones"
									control={control}
									render={({ field }) => (
										<TextField
											{...field}
											label="Observaciones Administrativas"
											size="small"
											multiline
											rows={3}
											fullWidth
										/>
									)}
								/>
							</>
						</fieldset>
					)}

					{/* TAB 3: AUTORIZACION ESPECIAL */}
					{activeTab === 3 && isAdmin && (
						<fieldset
							disabled={isAttp}
							style={{ border: "none", margin: 0, padding: 0 }}
						>
							<Box>
								<Paper
									variant="outlined"
									sx={{
										p: 3,
										borderColor: autorizadoSwitch ? "warning.main" : "divider",
										bgcolor: autorizadoSwitch ? "warning.50" : "inherit",
									}}
								>
									<Stack spacing={2.5}>
										<Box>
											<Typography
												variant="subtitle1"
												fontWeight={700}
												display="flex"
												alignItems="center"
												gap={1}
											>
												<VerifiedUserIcon
													color={autorizadoSwitch ? "warning" : "disabled"}
												/>
												Autorización excepcional para rendir finales
											</Typography>
											<Typography variant="body2" color="text.secondary">
												Habilita al estudiante a rendir exámenes finales aunque
												su legajo esté incompleto.
											</Typography>
										</Box>

										<FormControlLabel
											control={
												<Switch
													checked={autorizadoSwitch}
													onChange={(e) =>
														setAutorizadoSwitch(e.target.checked)
													}
													color="warning"
												/>
											}
											label={
												autorizadoSwitch
													? "SISTEMA DE AUTORIZACIÓN ACTIVADO"
													: "Habilitar sistema de autorizaciones"
											}
										/>

										{autorizadoSwitch && (
											<>
												<Divider />
												<Typography variant="subtitle2" sx={{ mb: 1 }}>
													Materias a autorizar (Debe seleccionar al menos una):
												</Typography>
												<Paper
													variant="outlined"
													sx={{
														maxHeight: 300,
														overflow: "auto",
														p: 1,
														bgcolor: "background.paper",
													}}
												>
													<Stack spacing={0.5}>
														{ }
														{detailData?.regularidades
															?.filter((r: any) => !r.aprobada)
															.map((reg: any) => (
																<FormControlLabel
																	key={reg.materia_id}
																	control={
																		<Checkbox
																			size="small"
																			checked={materiasAutorizadas.includes(
																				reg.materia_id,
																			)}
																			onChange={() =>
																				handleMateriaToggle(reg.materia_id)
																			}
																		/>
																	}
																	label={
																		<Typography variant="body2">
																			{reg.materia_nombre}{" "}
																			<span style={{ opacity: 0.6 }}>
																				({reg.situacion_display})
																			</span>
																		</Typography>
																	}
																/>
															))}
														{ }
														{(!detailData?.regularidades ||
															detailData.regularidades.filter(
																(r: any) => !r.nota_final,
															).length === 0) && (
															<Typography
																variant="caption"
																p={2}
																textAlign="center"
															>
																No hay materias pendientes de examen final
																registradas.
															</Typography>
														)}
													</Stack>
												</Paper>

												<TextField
													label="Motivo o Resolución de la autorización"
													value={autorizadoObs}
													onChange={(e) => setAutorizadoObs(e.target.value)}
													size="small"
													placeholder="Ej: Autorizado por disposición interna N°..."
													multiline
													rows={2}
													fullWidth
												/>

												<Box mt={1}>
													<Button
														variant="contained"
														color="warning"
														fullWidth
														onClick={() =>
															onAutorizarRendir?.(
																autorizadoSwitch,
																autorizadoObs,
																materiasAutorizadas,
															)
														}
														disabled={autorizarRendirIsPending}
														startIcon={
															autorizarRendirIsPending ? (
																<CircularProgress size={16} color="inherit" />
															) : (
																<VerifiedUserIcon />
															)
														}
													>
														{autorizarRendirIsPending
															? "Guardando..."
															: "Guardar Autorización de Materias"}
													</Button>
												</Box>
											</>
										)}
									</Stack>
								</Paper>
							</Box>
						</fieldset>
					)}
				</Stack>
			</fieldset>
		</form>
	);
}
