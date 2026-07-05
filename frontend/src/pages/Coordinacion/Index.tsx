import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Seguimiento de cohortes",
		items: [
			DASHBOARD_ITEMS.TRAJECTORY,
			DASHBOARD_ITEMS.CURSO_INTRO_PENDIENTES,
			{
				...DASHBOARD_ITEMS.ANALYTICOS,
				subtitle: "Seguimiento de solicitudes sin intervenir en la carga.",
			},
		],
	},
	{
		title: "Herramientas de apoyo",
		items: [
			DASHBOARD_ITEMS.HORARIO_CURSADA,
			DASHBOARD_ITEMS.REPORTES,
			DASHBOARD_ITEMS.MENSAJES,
		],
	},
];

export default function CoordinacionIndex() {
	return (
		<RoleDashboard
			title="Coordinación académica"
			subtitle="Accesos diarios para la planificación de carreras y el seguimiento institucional."
			sections={sections}
		/>
	);
}
