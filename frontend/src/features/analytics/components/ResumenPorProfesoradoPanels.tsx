import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import {
	obtenerResumenAcademico,
	obtenerResumenAsistencia,
} from "@/api/metrics";
import {
	INSTITUTIONAL_GREEN,
	INSTITUTIONAL_TERRACOTTA,
} from "@/styles/institutionalColors";

/** Barra horizontal simple, sin dependencias de charting. */
function BarraProfesorado({
	nombre,
	valor,
	color,
}: {
	nombre: string;
	valor: number;
	color: string;
}) {
	return (
		<Box>
			<Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, gap: 2 }}>
				<Typography variant="body2" sx={{ fontWeight: 500 }} noWrap title={nombre}>
					{nombre}
				</Typography>
				<Typography variant="body2" sx={{ fontWeight: 700, color, whiteSpace: "nowrap" }}>
					{valor.toFixed(1)}%
				</Typography>
			</Box>
			<Box sx={{ height: 8, borderRadius: 4, backgroundColor: "#e0e0e0", overflow: "hidden" }}>
				<Box
					sx={{
						height: "100%",
						width: `${Math.min(Math.max(valor, 0), 100)}%`,
						backgroundColor: color,
						transition: "width .3s",
					}}
				/>
			</Box>
		</Box>
	);
}

function PanelBase({
	titulo,
	aclaracion,
	color,
	isLoading,
	isError,
	vacio,
	children,
}: {
	titulo: string;
	aclaracion: string;
	color: string;
	isLoading: boolean;
	isError: boolean;
	vacio: boolean;
	children: React.ReactNode;
}) {
	return (
		<Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
			<Box sx={{ backgroundColor: color, p: 2 }}>
				<Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
					{titulo}
				</Typography>
				<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
					{aclaracion}
				</Typography>
			</Box>
			<Box sx={{ p: 2 }}>
				{isLoading ? (
					<LinearProgress />
				) : isError ? (
					<Alert severity="error">No se pudo cargar el resumen.</Alert>
				) : vacio ? (
					<Typography variant="body2" color="textSecondary">
						Sin datos disponibles
					</Typography>
				) : (
					<Stack spacing={1.5}>{children}</Stack>
				)}
			</Box>
		</Paper>
	);
}

/**
 * Regularizacion de cursada por profesorado.
 * OJO: mide algo distinto de la aprobacion en mesas de final. La base es
 * Regularidad.situacion (promocionado / regular / aprobado), es decir el
 * resultado de la CURSADA, no del examen final.
 */
export function RegularizacionCursadaPanel() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ["resumenAcademicoPorProfesorado"],
		queryFn: obtenerResumenAcademico,
	});

	return (
		<PanelBase
			titulo="Regularización de cursada por profesorado"
			aclaracion="Porcentaje de cursadas que terminaron promocionadas, regulares o aprobadas. No incluye exámenes finales."
			color={INSTITUTIONAL_GREEN}
			isLoading={isLoading}
			isError={isError}
			vacio={!data || data.length === 0}
		>
			{(data ?? []).map((r) => (
				<BarraProfesorado
					key={r.profesorado}
					nombre={r.profesorado}
					valor={r.tasa_aprobacion}
					color={INSTITUTIONAL_GREEN}
				/>
			))}
		</PanelBase>
	);
}

/** Asistencia efectivamente marcada, por profesorado. */
export function AsistenciaPorProfesoradoPanel() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ["resumenAsistenciaPorProfesorado"],
		queryFn: obtenerResumenAsistencia,
	});

	return (
		<PanelBase
			titulo="Asistencia por profesorado"
			aclaracion="Porcentaje de registros marcados como presente sobre el total de registros de asistencia."
			color={INSTITUTIONAL_TERRACOTTA}
			isLoading={isLoading}
			isError={isError}
			vacio={!data || data.length === 0}
		>
			{(data ?? []).map((r) => (
				<BarraProfesorado
					key={r.profesorado}
					nombre={r.profesorado}
					valor={r.tasa_asistencia}
					color={INSTITUTIONAL_TERRACOTTA}
				/>
			))}
		</PanelBase>
	);
}
