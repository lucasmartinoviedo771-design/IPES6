import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Acompañamiento académico",
		items: [
			{
				...DASHBOARD_ITEMS.STUDENT_MANAGEMENT,
				title: "Consultar estudiantes",
				subtitle: "Búsqueda de legajos, datos de contacto y carreras (solo lectura).",
			},
			DASHBOARD_ITEMS.TRAJECTORY,
			DASHBOARD_ITEMS.CURSO_INTRO_PENDIENTES,
			DASHBOARD_ITEMS.RESGUARDO_MATERIAS,
			{
				...DASHBOARD_ITEMS.ANALYTICOS,
				subtitle: "Revisa el estado para acompañar casos especiales.",
			},
			{
				...DASHBOARD_ITEMS.MENSAJES,
				title: "Mensajes a estudiantes",
				subtitle: "Envío de recordatorios o comunicados institucionales.",
			},
		],
	},
	{
		title: "Estructura y Cursadas",
		items: [
			DASHBOARD_ITEMS.CARRERAS_VIEW,
			DASHBOARD_ITEMS.HORARIO_CURSADA,
		],
	},
	{
		title: "Circuito de equivalencias",
		items: [DASHBOARD_ITEMS.EQUIVALENCIAS_GESTION],
	},
];

export default function TutoriasIndex() {
	return (
		<RoleDashboard
			title="Tutorías"
			subtitle="Panel operativo para documentar y acompañar las trayectorias estudiantiles."
			sections={sections}
		/>
	);
}
