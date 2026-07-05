import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import {
	completarPerfil,
	type EstudianteAdminDetailDTO,
	type EstudianteAdminDocumentacionDTO,
	type EstudianteAdminUpdatePayload,
	fetchPerfilCompletar,
} from "@/api/estudiantes";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import FotoPerfilEditor from "@/components/ui/FotoPerfilEditor";
import { PageHero } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";

type DocumentacionForm = {
	dni_legalizado: boolean;
	fotos_4x4: boolean;
	certificado_salud: boolean;
	folios_oficio: boolean;
	titulo_secundario_legalizado: boolean;
	certificado_titulo_en_tramite: boolean;
	analitico_legalizado: boolean;
	certificado_alumno_regular_sec: boolean;
	adeuda_materias: boolean;
	adeuda_materias_detalle: string;
	escuela_secundaria: string;
	es_certificacion_docente: boolean;
	titulo_terciario_univ: boolean;
	incumbencia: boolean;
};

type PerfilFormValues = {
	// Identificación
	nombre: string;
	apellido: string;
	// Contacto
	email: string;
	telefono: string;
	domicilio: string;
	// Información personal
	fecha_nacimiento: string;
	genero: string;
	nacionalidad: string;
	estado_civil: string;
	// Lugar de nacimiento
	lugar_nacimiento: string;
	localidad_nac: string;
	provincia_nac: string;
	pais_nac: string;
	// Contacto de emergencia
	emergencia_telefono: string;
	emergencia_parentesco: string;
	// Salud y accesibilidad
	cud_informado: boolean;
	condicion_salud_informada: boolean;
	condicion_salud_detalle: string;
	// Estudios secundarios
	sec_titulo: string;
	sec_establecimiento: string;
	sec_fecha_egreso: string;
	sec_localidad: string;
	sec_provincia: string;
	sec_pais: string;
	// Estudios superiores previos
	sup1_titulo: string;
	sup1_establecimiento: string;
	sup1_fecha_egreso: string;
	sup1_localidad: string;
	sup1_provincia: string;
	sup1_pais: string;
	// Situación laboral
	trabaja: boolean;
	empleador: string;
	horario_trabajo: string;
	domicilio_trabajo: string;
	// Documentación (solo lectura para el estudiante)
	documentacion: DocumentacionForm;
};

function normalizeDocumentacion(
	detail?: EstudianteAdminDocumentacionDTO | null,
): DocumentacionForm {
	return {
		dni_legalizado: Boolean(detail?.dni_legalizado),
		fotos_4x4: Boolean(detail?.fotos_4x4),
		certificado_salud: Boolean(detail?.certificado_salud),
		folios_oficio: Boolean(
			detail?.folios_oficio && Number(detail.folios_oficio) > 0,
		),
		titulo_secundario_legalizado: Boolean(detail?.titulo_secundario_legalizado),
		certificado_titulo_en_tramite: Boolean(
			detail?.certificado_titulo_en_tramite,
		),
		analitico_legalizado: Boolean(detail?.analitico_legalizado),
		certificado_alumno_regular_sec: Boolean(
			detail?.certificado_alumno_regular_sec,
		),
		adeuda_materias: Boolean(detail?.adeuda_materias),
		adeuda_materias_detalle: detail?.adeuda_materias_detalle ?? "",
		escuela_secundaria: detail?.escuela_secundaria ?? "",
		es_certificacion_docente: Boolean(detail?.es_certificacion_docente),
		titulo_terciario_univ: Boolean(detail?.titulo_terciario_univ),
		incumbencia: Boolean(detail?.incumbencia),
	};
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function CompletarPerfilPage() {
	const { refreshProfile } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [pendingValues, setPendingValues] = useState<PerfilFormValues | null>(
		null,
	);

	const generoOptions = [
		{ value: "", label: "Sin especificar" },
		{ value: "F", label: "Femenino" },
		{ value: "M", label: "Masculino" },
		{ value: "X", label: "X" },
	];

	const estadoCivilOptions = [
		{ value: "", label: "Sin especificar" },
		{ value: "SOL", label: "Soltero/a" },
		{ value: "CAS", label: "Casado/a" },
		{ value: "DIV", label: "Divorciado/a" },
		{ value: "VIU", label: "Viudo/a" },
		{ value: "CON", label: "Conviviente" },
		{ value: "OTR", label: "Otro" },
	];

	const redirectTo =
				(location.state as any)?.from?.pathname &&
				(location.state as any)?.from?.pathname !== "/estudiantes/completar-perfil"
			? 				(location.state as any)?.from?.pathname
			: "/estudiantes";

	const form = useForm<PerfilFormValues>({
		defaultValues: {
			nombre: "",
			apellido: "",
			email: "",
			telefono: "",
			domicilio: "",
			fecha_nacimiento: "",
			genero: "",
			nacionalidad: "",
			estado_civil: "",
			lugar_nacimiento: "",
			localidad_nac: "",
			provincia_nac: "",
			pais_nac: "",
			emergencia_telefono: "",
			emergencia_parentesco: "",
			cud_informado: false,
			condicion_salud_informada: false,
			condicion_salud_detalle: "",
			sec_titulo: "",
			sec_establecimiento: "",
			sec_fecha_egreso: "",
			sec_localidad: "",
			sec_provincia: "",
			sec_pais: "",
			sup1_titulo: "",
			sup1_establecimiento: "",
			sup1_fecha_egreso: "",
			sup1_localidad: "",
			sup1_provincia: "",
			sup1_pais: "",
			trabaja: false,
			empleador: "",
			horario_trabajo: "",
			domicilio_trabajo: "",
			documentacion: normalizeDocumentacion(),
		},
	});

	const { control, handleSubmit, reset, watch } = form;
	// eslint-disable-next-line react-hooks/incompatible-library
	const trabaja = watch("trabaja");
	const condicionSalud = watch("condicion_salud_informada");

	const {
		data: detailData,
		isLoading: detailIsLoading,
		isError: detailIsError,
	} = useQuery({
		queryKey: ["perfil-completar"],
		queryFn: fetchPerfilCompletar,
	});

	useEffect(() => {
		if (detailData) {
			const detail = detailData;
			const extra = detail.datos_extra ?? {};
			const fb = (direct: unknown, key: string) =>
				direct !== null && direct !== undefined && direct !== ""
					? direct
					: extra[key];

			reset({
				nombre: str(detail.nombre),
				apellido: str(detail.apellido),
				email: str(detail.email),
				telefono: str(detail.telefono),
				domicilio: str(detail.domicilio),
				fecha_nacimiento: detail.fecha_nacimiento
					? detail.fecha_nacimiento.slice(0, 10)
					: "",
				genero: str(fb(detail.genero, "genero")),
				nacionalidad: str(fb(detail.nacionalidad, "nacionalidad")),
				estado_civil: str(fb(detail.estado_civil, "estado_civil")),
				lugar_nacimiento: str(fb(detail.lugar_nacimiento, "lugar_nacimiento")),
				localidad_nac: str(fb(detail.localidad_nac, "localidad_nac")),
				provincia_nac: str(fb(detail.provincia_nac, "provincia_nac")),
				pais_nac: str(fb(detail.pais_nac, "pais_nac")),
				emergencia_telefono: str(
					fb(detail.emergencia_telefono, "emergencia_telefono"),
				),
				emergencia_parentesco: str(
					fb(detail.emergencia_parentesco, "emergencia_parentesco"),
				),
				cud_informado: Boolean(fb(detail.cud_informado, "cud_informado")),
				condicion_salud_informada: Boolean(
					fb(detail.condicion_salud_informada, "condicion_salud_informada"),
				),
				condicion_salud_detalle: str(
					fb(detail.condicion_salud_detalle, "condicion_salud_detalle"),
				),
				sec_titulo: str(fb(detail.sec_titulo, "sec_titulo")),
				sec_establecimiento: str(
					fb(detail.sec_establecimiento, "sec_establecimiento"),
				),
				sec_fecha_egreso: str(fb(detail.sec_fecha_egreso, "sec_fecha_egreso")),
				sec_localidad: str(fb(detail.sec_localidad, "sec_localidad")),
				sec_provincia: str(fb(detail.sec_provincia, "sec_provincia")),
				sec_pais: str(fb(detail.sec_pais, "sec_pais")),
				sup1_titulo: str(fb(detail.sup1_titulo, "sup1_titulo")),
				sup1_establecimiento: str(
					fb(detail.sup1_establecimiento, "sup1_establecimiento"),
				),
				sup1_fecha_egreso: str(
					fb(detail.sup1_fecha_egreso, "sup1_fecha_egreso"),
				),
				sup1_localidad: str(fb(detail.sup1_localidad, "sup1_localidad")),
				sup1_provincia: str(fb(detail.sup1_provincia, "sup1_provincia")),
				sup1_pais: str(fb(detail.sup1_pais, "sup1_pais")),
				trabaja: Boolean(fb(detail.trabaja, "trabaja")),
				empleador: str(fb(detail.empleador, "empleador")),
				horario_trabajo: str(fb(detail.horario_trabajo, "horario_trabajo")),
				domicilio_trabajo: str(
					fb(detail.domicilio_trabajo, "domicilio_trabajo"),
				),
				documentacion: normalizeDocumentacion(detail.documentacion),
			});
		}
	}, [detailData, reset]);

	const mutation = useMutation({
		mutationFn: async (values: PerfilFormValues) => {
			const payload: EstudianteAdminUpdatePayload = {
				nombre: values.nombre.trim() || undefined,
				apellido: values.apellido.trim() || undefined,
				email: values.email.trim() || undefined,
				telefono: values.telefono.trim() || undefined,
				domicilio: values.domicilio.trim() || undefined,
				fecha_nacimiento: values.fecha_nacimiento.trim() || undefined,
				genero: values.genero.trim() || undefined,
				nacionalidad: values.nacionalidad.trim() || undefined,
				estado_civil: values.estado_civil.trim() || undefined,
				lugar_nacimiento: values.lugar_nacimiento.trim() || undefined,
				localidad_nac: values.localidad_nac.trim() || undefined,
				provincia_nac: values.provincia_nac.trim() || undefined,
				pais_nac: values.pais_nac.trim() || undefined,
				emergencia_telefono: values.emergencia_telefono.trim() || undefined,
				emergencia_parentesco: values.emergencia_parentesco.trim() || undefined,
				cud_informado: values.cud_informado,
				condicion_salud_informada: values.condicion_salud_informada,
				condicion_salud_detalle:
					values.condicion_salud_detalle.trim() || undefined,
				sec_titulo: values.sec_titulo.trim() || undefined,
				sec_establecimiento: values.sec_establecimiento.trim() || undefined,
				sec_fecha_egreso: values.sec_fecha_egreso.trim() || undefined,
				sec_localidad: values.sec_localidad.trim() || undefined,
				sec_provincia: values.sec_provincia.trim() || undefined,
				sec_pais: values.sec_pais.trim() || undefined,
				sup1_titulo: values.sup1_titulo.trim() || undefined,
				sup1_establecimiento: values.sup1_establecimiento.trim() || undefined,
				sup1_fecha_egreso: values.sup1_fecha_egreso.trim() || undefined,
				sup1_localidad: values.sup1_localidad.trim() || undefined,
				sup1_provincia: values.sup1_provincia.trim() || undefined,
				sup1_pais: values.sup1_pais.trim() || undefined,
				trabaja: values.trabaja,
				empleador: values.empleador.trim() || undefined,
				horario_trabajo: values.horario_trabajo.trim() || undefined,
				domicilio_trabajo: values.domicilio_trabajo.trim() || undefined,
			};
			return await completarPerfil(payload);
		},
		onSuccess: async () => {
			await refreshProfile();
			await queryClient.invalidateQueries({ queryKey: ["perfil-completar"] });
			enqueueSnackbar("Datos actualizados correctamente.", {
				variant: "success",
			});
			navigate(redirectTo, { replace: true });
		},
		onError: (error: unknown) => {
			const err = error as {
				response?: { data?: { message?: string; detail?: string } };
			};
			const message =
				err?.response?.data?.message ||
				err?.response?.data?.detail ||
				(error instanceof Error
					? error.message
					: "No se pudo guardar la información.");
			enqueueSnackbar(message, { variant: "error" });
		},
	});

	const onSubmit = (values: PerfilFormValues) => {
		setPendingValues(values);
		setConfirmOpen(true);
	};

	const handleConfirmSave = () => {
		if (!pendingValues) return;
		mutation.mutate(pendingValues, {
			onSettled: () => {
				setConfirmOpen(false);
				setPendingValues(null);
			},
		});
	};

	const handleCancelConfirm = () => {
		if (mutation.isPending) return;
		setConfirmOpen(false);
		setPendingValues(null);
	};

	const detail: EstudianteAdminDetailDTO | undefined = detailData;
	const docDetail = detail?.documentacion;
	const docSummary = [
		{ label: "DNI legalizado", value: Boolean(docDetail?.dni_legalizado) },
		{ label: "Fotos 4x4", value: Boolean(docDetail?.fotos_4x4) },
		{
			label: "Certificado de salud",
			value: Boolean(docDetail?.certificado_salud),
		},
		{
			label: "Folios de oficio",
			value: Boolean(
				docDetail?.folios_oficio && Number(docDetail.folios_oficio) > 0,
			),
		},
		{
			label: "Título secundario legalizado",
			value: Boolean(docDetail?.titulo_secundario_legalizado),
		},
		{
			label: "Certificado título en trámite",
			value: Boolean(docDetail?.certificado_titulo_en_tramite),
		},
		{
			label: "Analítico legalizado",
			value: Boolean(docDetail?.analitico_legalizado),
		},
		{
			label: "Constancia estudiante regular",
			value: Boolean(docDetail?.certificado_alumno_regular_sec),
		},
		{
			label: "Trayecto certificación docente",
			value: Boolean(docDetail?.es_certificacion_docente),
		},
		{
			label: "Título terciario/universitario",
			value: Boolean(docDetail?.titulo_terciario_univ),
		},
		{ label: "Incumbencia", value: Boolean(docDetail?.incumbencia) },
	];

	return (
		<Box py={3} px={{ xs: 1, md: 4 }}>
			<Paper
				elevation={1}
				sx={{ maxWidth: 960, margin: "0 auto", p: { xs: 2, md: 4 } }}
			>
				<Stack spacing={3}>
					<PageHero
						title="Mis Datos Personales"
						subtitle="Mantené tu información actualizada. El DNI y CUIL solo pueden ser modificados por Bedelía."
					/>

					{detailIsLoading && (
						<Box display="flex" justifyContent="center" py={6}>
							<CircularProgress />
						</Box>
					)}

					{detailIsError && (
						<Alert severity="error">
							No se pudo cargar la información del estudiante. Intentá
							nuevamente más tarde.
						</Alert>
					)}

					{detail && (
						<Stack spacing={2}>
							<Divider />
							<Stack
								direction="row"
								spacing={2}
								alignItems="center"
								flexWrap="wrap"
							>
								<FotoPerfilEditor
									fotoUrl={detail.foto_url}
									nombre={detail.nombre}
								/>
								<Stack spacing={0.5}>
									<Stack direction="row" spacing={1} alignItems="center">
										<Typography variant="h6" fontWeight={600}>
											DNI: {detail.dni}
										</Typography>
										<Chip
											label={detail.estado_legajo_display}
											size="small"
											color={
												detail.estado_legajo === "COM" ? "success" : "warning"
											}
										/>
									</Stack>
									<Typography variant="caption" color="text.secondary">
										Hacé clic en la foto para actualizarla
									</Typography>
								</Stack>
							</Stack>

							{detail.condicion_calculada && (
								<Typography variant="body2" color="text.secondary">
									Condición administrativa calculada:{" "}
									{detail.condicion_calculada}.
								</Typography>
							)}

							<Box component="form" onSubmit={handleSubmit(onSubmit)}>
								<Stack spacing={4} sx={{ mt: 2 }}>
									{/* ── IDENTIFICACIÓN ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Identificación
										</Typography>
										<Stack spacing={2}>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
											</Stack>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
												<Controller
													name="fecha_nacimiento"
													control={control}
													render={({ field }) => (
														<TextField
															{...field}
															label="Fecha de nacimiento"
															size="small"
															type="date"
															InputLabelProps={{ shrink: true }}
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
															label="Género"
															size="small"
															fullWidth
														>
															{generoOptions.map((o) => (
																<MenuItem key={o.value} value={o.value}>
																	{o.label}
																</MenuItem>
															))}
														</TextField>
													)}
												/>
												<Controller
													name="estado_civil"
													control={control}
													render={({ field }) => (
														<TextField
															{...field}
															select
															label="Estado Civil"
															size="small"
															fullWidth
														>
															{estadoCivilOptions.map((o) => (
																<MenuItem key={o.value} value={o.value}>
																	{o.label}
																</MenuItem>
															))}
														</TextField>
													)}
												/>
											</Stack>
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
										</Stack>
									</Box>

									<Divider />

									{/* ── LUGAR DE NACIMIENTO ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Lugar de Nacimiento
										</Typography>
										<Stack spacing={2}>
											<Controller
												name="lugar_nacimiento"
												control={control}
												render={({ field }) => (
													<TextField
														{...field}
														label="Lugar de nacimiento (general)"
														size="small"
														fullWidth
													/>
												)}
											/>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
												<Controller
													name="localidad_nac"
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
													name="provincia_nac"
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
													name="pais_nac"
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
										</Stack>
									</Box>

									<Divider />

									{/* ── CONTACTO Y DOMICILIO ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Contacto y Domicilio
										</Typography>
										<Stack spacing={2}>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
												<Controller
													name="email"
													control={control}
													render={({ field }) => (
														<TextField
															{...field}
															label="Correo electrónico"
															size="small"
															fullWidth
														/>
													)}
												/>
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
											</Stack>
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
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
										</Stack>
									</Box>

									<Divider />

									{/* ── SALUD Y ACCESIBILIDAD ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Salud y Accesibilidad
										</Typography>
										<Stack spacing={2}>
											<Stack direction="row" spacing={2}>
												<Controller
													name="cud_informado"
													control={control}
													render={({ field }) => (
														<FormControlLabel
															control={
																<Checkbox
																	checked={field.value}
																	onChange={(e) =>
																		field.onChange(e.target.checked)
																	}
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
																	onChange={(e) =>
																		field.onChange(e.target.checked)
																	}
																/>
															}
															label="Informa condición de salud"
														/>
													)}
												/>
											</Stack>
											{condicionSalud && (
												<Controller
													name="condicion_salud_detalle"
													control={control}
													render={({ field }) => (
														<TextField
															{...field}
															label="Detalle de salud / Apoyo necesario"
															size="small"
															fullWidth
															multiline
															rows={3}
														/>
													)}
												/>
											)}
										</Stack>
									</Box>

									<Divider />

									{/* ── ESTUDIOS SECUNDARIOS ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Estudios Secundarios
										</Typography>
										<Stack spacing={2}>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
															fullWidth
														/>
													)}
												/>
											</Stack>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
										</Stack>
									</Box>

									<Divider />

									{/* ── ESTUDIOS SUPERIORES PREVIOS ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Estudios Superiores Previos
										</Typography>
										<Stack spacing={2}>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
															fullWidth
														/>
													)}
												/>
											</Stack>
											<Stack
												direction={{ xs: "column", md: "row" }}
												spacing={2}
											>
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
										</Stack>
									</Box>

									<Divider />

									{/* ── SITUACIÓN LABORAL ── */}
									<Box>
										<Typography
											variant="subtitle1"
											fontWeight={700}
											gutterBottom
										>
											Situación Laboral
										</Typography>
										<Stack spacing={2}>
											<Controller
												name="trabaja"
												control={control}
												render={({ field }) => (
													<FormControlLabel
														control={
															<Checkbox
																checked={field.value}
																onChange={(e) =>
																	field.onChange(e.target.checked)
																}
															/>
														}
														label="¿Trabaja actualmente?"
													/>
												)}
											/>
											{trabaja && (
												<>
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
													<Stack
														direction={{ xs: "column", md: "row" }}
														spacing={2}
													>
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
												</>
											)}
										</Stack>
									</Box>

									<Divider />

									{/* ── DOCUMENTACIÓN (solo lectura) ── */}
									<Box>
										<Typography
											variant="subtitle2"
											fontWeight={700}
											gutterBottom
										>
											Documentación registrada (Solo lectura)
										</Typography>
										<Stack
											spacing={1}
											sx={{
												border: "1px solid",
												borderColor: "divider",
												borderRadius: 1,
												p: 2,
												bgcolor: "action.hover",
											}}
										>
											{docSummary.map((item) => (
												<Stack
													key={item.label}
													direction="row"
													alignItems="center"
													justifyContent="space-between"
												>
													<Typography variant="body2">{item.label}</Typography>
													<Chip
														size="small"
														color={item.value ? "success" : "default"}
														label={item.value ? "Presentado" : "Pendiente"}
													/>
												</Stack>
											))}
										</Stack>
										<Alert severity="info" sx={{ mt: 1 }}>
											Para añadir o corregir documentación, por favor acercate a
											Bedelía.
										</Alert>
									</Box>

									{/* ── BOTÓN GUARDAR ── */}
									<Stack direction="row" spacing={2} justifyContent="flex-end">
										<Button
											type="submit"
											variant="contained"
											disabled={mutation.isPending}
										>
											{mutation.isPending
												? "Guardando..."
												: "Guardar mis datos"}
										</Button>
									</Stack>
								</Stack>
							</Box>
						</Stack>
					)}
				</Stack>
			</Paper>

			<FinalConfirmationDialog
				open={confirmOpen}
				onConfirm={handleConfirmSave}
				onCancel={handleCancelConfirm}
				contextText="Cambios"
				loading={mutation.isPending}
			/>
		</Box>
	);
}
