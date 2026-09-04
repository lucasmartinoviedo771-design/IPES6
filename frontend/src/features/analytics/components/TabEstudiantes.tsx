import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchCarreras } from "@/api/carreras";
import AnalyticsFilters, { type FactorRiesgo } from "./AnalyticsFilters";
import AnalyticsHeader from "./AnalyticsHeader";
import EstudiantesRiesgoTable from "./EstudiantesRiesgoTable";
import SemaforoCards from "./SemaforoCards";
import CorrelativasCaidasPanel from "./CorrelativasCaidasPanel";
import {
	useAnalyticsSummary,
	useEstudiantesAtRisk,
} from "../hooks/useAnalytics";

interface TabEstudiantesProps {
	anio: number;
	profesoradoId?: number;
	onAnioChange: (anio: number) => void;
	onProfesoradoChange: (profesoradoId?: number) => void;
}

export default function TabEstudiantes({
	anio,
	profesoradoId,
	onAnioChange,
	onProfesoradoChange,
}: TabEstudiantesProps) {
	const [nivel, setNivel] = useState<string>("rojo");
	const [factor, setFactor] = useState<FactorRiesgo>("todos");
	const [page, setPage] = useState<number>(1);

	// Carreras para el selector
	const { data: carreras = [] } = useQuery({
		queryKey: ["carreras", "activas"],
		queryFn: () => fetchCarreras(),
	});

	// Resumen y Semáforo
	const {
		data: summary,
		isLoading: loadingSummary,
		error: errorSummary,
		refetch: refetchSummary,
	} = useAnalyticsSummary({
		anio,
		profesorado_id: profesoradoId,
	});

	// Listado de Estudiantes en riesgo filtrado por nivel y por factor académico
	const {
		data: estudiantes,
		isLoading: loadingEstudiantes,
		error: errorEstudiantes,
		refetch: refetchEstudiantes,
	} = useEstudiantesAtRisk({
		nivel,
		profesorado_id: profesoradoId,
		motivo: factor !== "todos" ? factor : undefined,
		page,
	});

	const handleNivelSelect = (newNivel: string) => {
		setNivel(newNivel);
		setPage(1);
	};

	return (
		<Stack spacing={3}>
			<AnalyticsHeader fechaActualizacion={summary?.fecha_actualizacion || null} />

			<AnalyticsFilters
				anio={anio}
				onAnioChange={(y) => {
					onAnioChange(y);
					setPage(1);
				}}
				profesoradoId={profesoradoId}
				onProfesoradoChange={(p) => {
					onProfesoradoChange(p);
					setPage(1);
				}}
				carreras={carreras}
				factor={factor}
				onFactorChange={(f) => {
					setFactor(f);
					setPage(1);
				}}
			/>

			{errorSummary ? (
				<Alert
					severity="error"
					sx={{ mb: 2 }}
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
					sx={{ mb: 2 }}
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
					estudiantes={estudiantes?.items}
					totalCount={estudiantes?.count}
					nivel={nivel}
					loading={loadingEstudiantes}
					page={page}
					onPageChange={(p) => setPage(p)}
					profesoradoId={profesoradoId}
					factor={factor}
				/>
			)}

			<CorrelativasCaidasPanel anio={anio} />
		</Stack>
	);
}
