import { Box, Grid, Stack, Typography } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import SectionCard, {
  SectionCardProps,
} from "@/components/secretaria/SectionCard";
import { DASHBOARD_ITEMS } from "@/components/roles/dashboardItems";

type Section = {
  title: string;
  items: SectionCardProps[];
};

export default function SecretariaIndex() {
  const { user } = useAuth();

  const canManageDocentes = hasAnyRole(user, ["admin", "secretaria"]);
  const canAssignRoles = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageHorarios = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageMesas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canManageCatDoc = hasAnyRole(user, ["admin", "secretaria"]);
  const canManageVentanas = hasAnyRole(user, [
    "admin",
    "secretaria",
    "jefa_aaee",
  ]);
  const canManageNotas = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const sections: Section[] = [
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
          ]
          : []),
      ],
    },
    {
      title: "Gestión académica - Secretaría",
      items: [
        ...(canManageHorarios
          ? [
            {
              title: "Cargar horario",
              subtitle: "Armar y publicar horarios de cursada.",
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
  ];

  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <Stack gap={4}>
      <PageHero
        title="Secretaría"
        subtitle="Centro de operaciones agrupado por módulos"
      />

      {visibleSections.map((section) => (
        <Box key={section.title}>
          <Typography variant="h6" mb={2} fontWeight={600}>
            {section.title}
          </Typography>
          <Grid container spacing={2}>
            {section.items.map((item) => (
              <SectionCard key={item.title} {...item} />
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}
