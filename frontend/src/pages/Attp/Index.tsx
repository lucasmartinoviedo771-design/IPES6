import LockResetIcon from "@mui/icons-material/LockReset";
import Grid from "@mui/material/Grid";
import { ForcedResetWidget } from "@/components/dashboard/ForcedResetWidget";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Inscripciones (escritura)",
		items: [
			{
				...DASHBOARD_ITEMS.FORMALIZAR_INSCRIPCION,
				title: "Inscripción a carreras",
				subtitle:
					"Formalizá y confirmá inscripciones de aspirantes a profesorados.",
			},
			{
				...DASHBOARD_ITEMS.REGULARIDAD_CARGA,
				title: "Inscripción a E.C.",
				subtitle:
					"Gestioná la inscripción de estudiantes a espacios curriculares.",
			},
		],
	},
	{
		title: "Horarios",
		items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
	},
	{
		title: "Estudiantes",
		items: [
			{
				title: "Resetear contraseña estudiante",
				subtitle: "Restablecé la contraseña de un estudiante usando su DNI.",
				icon: <LockResetIcon />,
				path: "/attp/resetear-password",
			},
		],
	},
	{
		title: "Consulta y supervisión (solo lectura)",
		items: [
			DASHBOARD_ITEMS.STUDENT_MANAGEMENT,
			DASHBOARD_ITEMS.ACTAS_Y_NOTAS_GENERAL,
			DASHBOARD_ITEMS.REPORTES,
			DASHBOARD_ITEMS.MENSAJES,
		],
	},
];

export default function AttpIndex() {
	return (
		<RoleDashboard
			title="A.T.T.P."
			subtitle="Gestión de inscripciones a carreras y espacios curriculares. Consulta en modo solo lectura para el resto."
			sections={sections}
		>
			<Grid container spacing={3} mb={1}>
				<Grid item xs={12} md={6} lg={4}>
					<ForcedResetWidget />
				</Grid>
			</Grid>
		</RoleDashboard>
	);
}
