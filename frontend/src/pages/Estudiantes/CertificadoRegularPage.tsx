/* eslint-disable react-doctor/no-derived-state, react-doctor/no-derived-state-effect, react-doctor/exhaustive-deps, react-doctor/no-event-handler, react-doctor/no-chain-state-updates */

import DownloadIcon from "@mui/icons-material/Download";
import type { SelectChangeEvent } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useSnackbar } from "notistack";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import {
	descargarCertificadoRegular,
	obtenerAnioEstudio,
	obtenerCarrerasActivas,
	type TrayectoriaCarreraDetalleDTO,
} from "@/api/estudiantes";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

type SelectValue = string;

const CertificadoRegularPage: React.FC = () => {
	const { enqueueSnackbar } = useSnackbar();
	const { user } = useAuth();

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const roles = user?.roles ?? [];
	const isOnlyStudent =
		hasAnyRole(user, ["estudiante"]) &&
		!hasAnyRole(user, ["admin", "secretaria", "bedel"]);
	const canGestionar = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

	const [profesoradoId, setProfesoradoId] = useState<SelectValue>("");
	const [planId, setPlanId] = useState<SelectValue>("");
	const [dniManual, setDniManual] = useState<string>("");
	const [anioOverride, setAnioOverride] = useState<SelectValue>("");
	const [descargando, setDescargando] = useState(false);

	const dniObjetivo = isOnlyStudent ? (user?.dni ?? "") : dniManual.trim();

	const { data: carrerasData, isLoading: carrerasIsLoading } = useQuery({
		queryKey: ["estudiantes", "carreras-activas", dniObjetivo || null],
		queryFn: () =>
			obtenerCarrerasActivas(dniObjetivo ? { dni: dniObjetivo } : {}),
		enabled:
			(isOnlyStudent || Boolean(dniObjetivo)) &&
			(canGestionar || isOnlyStudent),
	});

	const carreras = carrerasData?.carreras ?? []; // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!carreras.length) {
			setProfesoradoId("");
			return;
		}
		const existe = carreras.some(
			(item) => String(item.profesorado_id) === profesoradoId,
		);
		if (!existe) {
			setProfesoradoId(String(carreras[0].profesorado_id));
		}
	}, [carreras, profesoradoId]);

	const planesDisponibles = useMemo(() => {
		const carrera = carreras.find(
			(item) => item.profesorado_id === Number(profesoradoId),
		);
		return carrera?.planes ?? [];
	}, [carreras, profesoradoId]);

	useEffect(() => {
		if (!planesDisponibles.length) {
			setPlanId("");
			return;
		}
		const existe = planesDisponibles.some((plan) => String(plan.id) === planId);
		if (!existe) {
			const planPreferido =
				planesDisponibles.find((plan) => plan.vigente) ?? planesDisponibles[0];
			setPlanId(String(planPreferido.id));
		}
	}, [planesDisponibles, planId]);

	const puedeCambiarDni = canGestionar;

	const { data: anioData, isLoading: anioIsLoading } = useQuery({
		queryKey: [
			"estudiantes",
			"anio-estudio",
			dniObjetivo,
			profesoradoId,
			planId,
		],
		queryFn: () =>
			obtenerAnioEstudio({
				profesorado_id: Number(profesoradoId),
				plan_id: Number(planId),
				dni: puedeCambiarDni ? dniObjetivo : undefined,
			}),
		enabled: Boolean(profesoradoId) && Boolean(planId) && Boolean(dniObjetivo),
	});

	const anioMax = anioData?.anio_estudio ?? 4;

	useEffect(() => {
		setAnioOverride(String(anioMax));
	}, [anioMax]);
	const handleDescargar = async () => {
		if (!profesoradoId || !planId) {
			enqueueSnackbar("Selecciona un profesorado y un plan de estudio.", {
				variant: "warning",
			});
			return;
		}
		if (!dniObjetivo) {
			enqueueSnackbar("Ingresa un DNI valido.", { variant: "warning" });
			return;
		}

		setDescargando(true);
		try {
			const blob = await descargarCertificadoRegular({
				profesorado_id: Number(profesoradoId),
				plan_id: Number(planId),
				dni: puedeCambiarDni ? dniObjetivo : undefined,
				anio_override: anioOverride ? Number(anioOverride) : undefined,
			});

			if (blob.type && blob.type.includes("application/json")) {
				const text = await blob.text();
				try {
					const parsed = JSON.parse(text);
					throw new Error(
						parsed?.message ||
							parsed?.detail ||
							"No se pudo generar la constancia.",
					);
				} catch (_err) {
					throw new Error("No se pudo generar la constancia.");
				}
			}

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `constancia_regular_${dniObjetivo}.pdf`;
			link.click();
			window.URL.revokeObjectURL(url);
			enqueueSnackbar("Constancia generada correctamente.", {
				variant: "success",
			});
		} catch (error) {
			let mensaje = "No se pudo generar la constancia.";
			if (isAxiosError(error)) {
				const data = error.response?.data;
				if (data instanceof Blob) {
					try {
						const texto = await data.text();
						const parsed = JSON.parse(texto);
						mensaje = parsed?.message || parsed?.detail || mensaje;
					} catch {
						mensaje = error.message || mensaje;
					}
				} else {
					mensaje =
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(error.response?.data as any)?.message ||
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(error.response?.data as any)?.detail ||
						error.message ||
						mensaje;
				}
			} else if (error instanceof Error) {
				mensaje = error.message || mensaje;
			}
			enqueueSnackbar(mensaje, { variant: "error" });
		} finally {
			setDescargando(false);
		}
	};

	return (
		<Box sx={{ p: 3 }}>
			<BackButton fallbackPath="/estudiantes" />
			<PageHero
				title="Constancia de estudiante regular"
				subtitle="Descargá el certificado oficial del ciclo vigente según tu cohorte"
			/>
			<Alert severity="warning" sx={{ mb: 2 }}>
				Registro académico sin validez administrativa. No tomar como documento
				definitivo de notas.
			</Alert>

			<Grid container spacing={2} sx={{ mb: 2 }}>
				<Grid item xs={12} md={4}>
					<FormControl fullWidth size="small">
						<InputLabel id="profesorado-select-label">Profesorado</InputLabel>
						<Select
							labelId="profesorado-select-label"
							label="Profesorado"
							value={profesoradoId}
							onChange={(event: SelectChangeEvent<string>) =>
								setProfesoradoId(event.target.value)
							}
							disabled={
								carrerasIsLoading ||
								(!isOnlyStudent && !dniObjetivo) ||
								(!isOnlyStudent && !carreras.length)
							}
						>
							{carreras.map((carrera: TrayectoriaCarreraDetalleDTO) => (
								<MenuItem
									key={carrera.profesorado_id}
									value={String(carrera.profesorado_id)}
								>
									{carrera.nombre}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</Grid>
				<Grid item xs={12} md={4}>
					<FormControl
						fullWidth
						size="small"
						disabled={
							!planesDisponibles.length ||
							carrerasIsLoading ||
							(!isOnlyStudent && !dniObjetivo)
						}
					>
						<InputLabel id="plan-select-label">Plan</InputLabel>
						<Select
							labelId="plan-select-label"
							label="Plan"
							value={planId}
							onChange={(event: SelectChangeEvent<string>) =>
								setPlanId(event.target.value)
							}
						>
							{planesDisponibles.map((plan) => (
								<MenuItem key={plan.id} value={String(plan.id)}>
									{plan.resolucion || `Plan ${plan.id}`}
									{plan.vigente ? " - Vigente" : ""}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</Grid>
				<Grid item xs={12} md={4}>
					<FormControl
						fullWidth
						size="small"
						disabled={!planId || anioIsLoading}
					>
						<InputLabel id="anio-select-label">Año a certificar</InputLabel>
						<Select
							labelId="anio-select-label"
							label="Año a certificar"
							value={anioOverride}
							onChange={(event: SelectChangeEvent<string>) =>
								setAnioOverride(event.target.value)
							}
						>
							{Array.from({ length: anioMax }, (_, i) => i + 1).map((anio) => (
								<MenuItem key={anio} value={String(anio)}>
									{anio}° Año{anio === anioMax ? " (calculado)" : ""}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</Grid>
				<Grid item xs={12}>
					<Stack direction="row" spacing={1} justifyContent="flex-end">
						<Button
							variant="contained"
							startIcon={
								descargando ? (
									<CircularProgress size={18} color="inherit" />
								) : (
									<DownloadIcon />
								)
							}
							onClick={handleDescargar}
							disabled={
								!profesoradoId || !planId || !dniObjetivo || descargando
							}
						>
							Descargar constancia
						</Button>
					</Stack>
				</Grid>
			</Grid>

			{puedeCambiarDni && (
				<Box sx={{ maxWidth: 400, mb: 3 }}>
					<TextField
						label="DNI del estudiante"
						value={dniManual}
						onChange={(event) => setDniManual(event.target.value)}
						fullWidth
						size="small"
						helperText="Ingresa el DNI del estudiante para generar la constancia."
					/>
					{!dniObjetivo && (
						<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
							Ingresar un DNI permite cargar los profesorados y planes asociados
							a ese estudiante.
						</Typography>
					)}
				</Box>
			)}

			<Typography variant="subtitle1" fontWeight={700} sx={{ mt: 4 }}>
				Condiciones consideradas
			</Typography>
			<Typography variant="body2" color="text.secondary">
				Una vez impresa la constancia, deberá ser firmada y sellada por la
				institucion para tener validez oficial.
			</Typography>
		</Box>
	);
};

export default CertificadoRegularPage;
