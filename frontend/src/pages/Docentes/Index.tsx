import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";

const sections: RoleDashboardSection[] = [
	{
		title: "Actas y calificaciones",
		items: [
			{
				...DASHBOARD_ITEMS.ACTAS_FINALES,
				subtitle:
					"Carga las notas finales de la mesa en la que integrás el tribunal.",
			},
		],
	},
	{
		title: "Horarios",
		items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
	},
	{
		title: "Operativa diaria",
		items: [
			{
				title: "Mi asistencia diaria",
				subtitle: "Consultá tu historial y estado de asistencia registrada.",
				icon: DASHBOARD_ITEMS.DOCENTE_ASISTENCIA.icon,
				path: "/docentes/mis-asistencias",
			},
			{
				...DASHBOARD_ITEMS.MENSAJES,
				subtitle: "Comunicate con Secretaría o con tus estudiantes.",
			},
			{
				title: "Mis comisiones",
				subtitle: "Consulta las materias asignadas y los inscriptos.",
				icon: DASHBOARD_ITEMS.MATERIAS_ABM.icon,
				path: "/docentes/mis-materias",
			},
		],
	},
];

export default function DocentesIndex() {
	return (
		<RoleDashboard
			title="Docentes"
			subtitle="Accesos rápidos para el tribunal y la gestión diaria del cuerpo docente."
			sections={sections}
		/>
	);
}
