import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCarreras } from "@/api/carreras";
import { PageHero } from "@/components/ui/GradientTitles";
import AnalyticsFilters from "@/features/analytics/components/AnalyticsFilters";
import AnalyticsHeader from "@/features/analytics/components/AnalyticsHeader";
import EstudiantesRiesgoTable from "@/features/analytics/components/EstudiantesRiesgoTable";
import SemaforoCards from "@/features/analytics/components/SemaforoCards";
import {
	useAnalyticsSummary,
	useEstudiantesAtRisk,
} from "@/features/analytics/hooks/useAnalytics";

export default function AnalyticsDashboardPage() {
	const [searchParams, setSearchParams] = useSearchParams();

	// 1. Estado sincronizado con URL SearchParams
	const anioParam = Number(searchParams.get("anio")) || 2026;
	const profParam = searchParams.get("profesorado_id")
		? Number(searchParams.get("profesorado_id"))
		: undefined;
	const nivelParam = searchParams.get("nivel") || "rojo";
	const pageParam = Number(searchParams.get("page")) || 1;

	const [anio, setAnio] = useState<number>(anioParam);
	const [profesoradoId, setProfesoradoId] = useState<number | undefined>(profParam);
	const [nivel, setNivel] = useState<string>(nivelParam);
	const [page, setPage] = useState<number>(pageParam);

	// Actualizar URL cuando cambian los filtros
	const updateUrlParams = useCallback(
		(newAnio: number, newProf?: number, newNivel?: string, newPage?: number) => {
			const params: Record<string, string> = {
				anio: String(newAnio),
				nivel: newNivel || nivel,
				page: String(newPage || 1),
			};
			if (newProf) {
				params.profesorado_id = String(newProf);
			}
			setSearchParams(params);
		},
		[nivel, setSearchParams],
	);

	const handleAnioChange = (newAnio: number) => {
		setAnio(newAnio);
		setPage(1);
		updateUrlParams(newAnio, profesoradoId, nivel, 1);
	};

	const handleProfesoradoChange = (newProf?: number) => {
		setProfesoradoId(newProf);
		setPage(1);
		updateUrlParams(anio, newProf, nivel, 1);
	};

	const handleNivelSelect = (newNivel: string) => {
		setNivel(newNivel);
		setPage(1);
		updateUrlParams(anio, profesoradoId, newNivel, 1);
	};

	const handlePageChange = (newPage: number) => {
		setPage(newPage);
		updateUrlParams(anio, profesoradoId, nivel, newPage);
	};

	// 2. Carreras para el selector
	const { data: carreras = [] } = useQuery({
		queryKey: ["carreras", "activas"],
		queryFn: () => fetchCarreras(),
	});

	// 3. Resumen y Semáforo
	const {
		data: summary,
		isLoading: loadingSummary,
		error: errorSummary,
		refetch: refetchSummary,
	} = useAnalyticsSummary({
		anio,
		profesorado_id: profesoradoId,
	});

	// 4. Listado de Estudiantes en riesgo
	const {
		data: estudiantes,
		isLoading: loadingEstudiantes,
		error: errorEstudiantes,
		refetch: refetchEstudiantes,
	} = useEstudiantesAtRisk({
		nivel,
		profesorado_id: profesoradoId,
		page,
	});

	return (
		<Container maxWidth="xl" sx={{ py: 3 }}>
			<PageHero
				title="Panel de Alerta Temprana y Riesgo Académico"
				subtitle="Monitoreo analítico de trayectorias, retención estudiantil e intervención pedagógica"
			/>

			<AnalyticsHeader fechaActualizacion={summary?.fecha_actualizacion || null} />

			<AnalyticsFilters
				anio={anio}
				onAnioChange={handleAnioChange}
				profesoradoId={profesoradoId}
				onProfesoradoChange={handleProfesoradoChange}
				carreras={carreras}
			/>

			{errorSummary ? (
				<Alert
					severity="error"
					sx={{ mb: 3 }}
					action={
						<Button color="inherit" size="small" onClick={() => refetchSummary()}>
							Reintentar
						</Button>
					}
				>
					Error al cargar el resumen del semáforo. Verifique su conexión o intente nuevamente.
				</Alert>
			) : (
				<SemaforoCards
					semaforo={summary?.semaforo}
					nivelSeleccionado={nivel}
					onSelectNivel={handleNivelSelect}
					loading={loadingSummary}
				/>
			)}

			{errorEstudiantes ? (
				<Alert
					severity="error"
					sx={{ mb: 3 }}
					action={
						<Button color="inherit" size="small" onClick={() => refetchEstudiantes()}>
							Reintentar
						</Button>
					}
				>
					Error al cargar el listado de estudiantes en riesgo.
				</Alert>
			) : (
				<EstudiantesRiesgoTable
					estudiantes={estudiantes}
					nivel={nivel}
					loading={loadingEstudiantes}
					page={page}
					onPageChange={handlePageChange}
					profesoradoId={profesoradoId}
				/>
			)}
		</Container>
	);
}
