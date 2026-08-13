import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DateRangeIcon from "@mui/icons-material/DateRange";
import EventIcon from "@mui/icons-material/Event";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";
import RoleDashboard, {
	type RoleDashboardSection,
} from "@/components/roles/RoleDashboard";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

export default function SecretariaIndex() {
	const { user } = useAuth();

	const canManageDocentes = hasAnyRole(user, [
		"admin",
		"secretaria",
		"rectorado",
		"attp",
	]);
	const canAssignRoles = hasAnyRole(user, ["admin", "secretaria"]);
	const canManageHorarios = hasAnyRole(user, ["admin", "secretaria"]);
	const canManageMesas = hasAnyRole(user, [
		"admin",
		"secretaria",
		"bedel",
		"rectorado",
		"attp",
	]);
	const canManageCatDoc = hasAnyRole(user, [
		"admin",
		"secretaria",
		"rectorado",
		"attp",
	]);
	const canManageVentanas = hasAnyRole(user, [
		"admin",
		"secretaria",
		"jefa_aaee",
		"rectorado",
		"attp",
	]);
	const canManageNotas = hasAnyRole(user, [
		"admin",
		"secretaria",
		"bedel",
		"rectorado",
		"attp",
	]);
	const canManagePreins = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

	const sections: RoleDashboardSection[] = [
		{
			title: "Usuarios y roles",
			items: [
				...(canManageDocentes
					? [
							{
								title: "Cargar docentes",
								subtitle: "Alta y edición de docentes del sistema.",
								icon: <PersonAddIcon />,
								path: "/secretaria/docentes",
							},
							{
								title: "Gestión de Cargos",
								subtitle: "Administrar cargos y asignar horarios a docentes.",
								icon: <BusinessCenterIcon />,
								path: "/secretaria/cargos",
							},
						]
					: []),
				...(canAssignRoles
					? [
							{
								title: "Asignar roles",
								subtitle: "Gestioná permisos y roles de usuarios.",
								icon: <AssignmentIndIcon />,
								path: "/secretaria/asignar-rol",
							},
							DASHBOARD_ITEMS.STUDENT_DOCUMENTATION,
							DASHBOARD_ITEMS.PREINSCRIPCION_REPRINT,
						]
					: []),
			],
		},
		{
			title: "Gestión académica - Secretaría",
			items: [
				...(canManagePreins ? [DASHBOARD_ITEMS.PREINSCRIPCIONES] : []),
				...(canManageHorarios
					? [
							{
								title: "Armar Horarios de Cátedra",
								subtitle:
									"Definí los bloques horarios que ocupará cada cátedra.",
								icon: <EventIcon />,
								path: "/secretaria/horarios",
							},
						]
					: []),
				...(canManageMesas
					? [
							{
								title: "Mesas de examen",
								subtitle: "Crear y gestionar mesas según el período.",
								icon: <CalendarMonthIcon />,
								path: "/secretaria/mesas",
							},
						]
					: []),
				...(canManageCatDoc
					? [
							{
								title: "Cátedra - Docente",
								subtitle: "Asignar docentes a cátedras y comisiones.",
								icon: <RecordVoiceOverIcon />,
								path: "/secretaria/catedra-docente",
							},
						]
					: []),
				...(canManageNotas
					? [
							DASHBOARD_ITEMS.ACTAS_Y_NOTAS_GENERAL,
							DASHBOARD_ITEMS.ACTA_MANUAL,
							{
								...DASHBOARD_ITEMS.DOCENTE_MIS_COMISIONES,
								subtitle: "Consulta comisiones asignadas (vista docente).",
							},
						]
					: []),
				...(canManageVentanas
					? [
							{
								title: "Habilitar fechas",
								subtitle: "Configurar períodos y fechas clave.",
								icon: <DateRangeIcon />,
								path: "/secretaria/habilitar-fechas",
							},
						]
					: []),
			],
		},
		{
			title: "Horarios",
			items: [DASHBOARD_ITEMS.HORARIO_CURSADA],
		},
	];

	return (
		<RoleDashboard
			title="Secretaría"
			subtitle="Centro de operaciones agrupado por módulos"
			sections={sections}
		/>
	);
}
