import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Evaluación y dictamen",
		items: [DASHBOARD_ITEMS.EQUIVALENCIAS_GESTION],
	},
	{
		title: "Horarios",
		items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
	},
];

export default function EquivalenciasIndex() {
	return (
		<RoleDashboard
			title="Equipo de equivalencias"
			subtitle="Accesos directos para evaluar pedidos y emitir disposiciones."
			sections={sections}
		/>
	);
}
