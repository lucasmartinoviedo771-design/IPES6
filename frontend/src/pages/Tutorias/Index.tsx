import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Acompañamiento académico",
		items: [
			DASHBOARD_ITEMS.TRAJECTORY,
			DASHBOARD_ITEMS.CURSO_INTRO_PENDIENTES,
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
		title: "Circuito de equivalencias",
		items: [DASHBOARD_ITEMS.EQUIVALENCIAS_GESTION],
	},
	{
		title: "Horarios",
		items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
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
