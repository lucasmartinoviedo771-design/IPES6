import { useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";
import { fetchCarreras, Carrera } from "@/api/carreras";
import CalendarioEventosPanel from "@/components/asistencia/CalendarioEventosPanel";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

import { Option, ordenarPorLabel } from "./asistencia-reportes/types";
import { useEstudiantesAsistencia } from "./asistencia-reportes/useEstudiantesAsistencia";
import { useDocentesAsistencia } from "./asistencia-reportes/useDocentesAsistencia";
import { EstudiantesPanel } from "./asistencia-reportes/EstudiantesPanel";
import { DocentesPanel } from "./asistencia-reportes/DocentesPanel";

dayjs.locale("es");

const AsistenciaReportesPage = () => {
  const { user } = useAuth();

  const puedeGestionarDocentes = hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const puedeVerDocentes =
    puedeGestionarDocentes || hasAnyRole(user, ["coordinador", "bedel", "jefes", "jefa_aaee", "docente"]);

  const puedeGestionarEstudiantes = hasAnyRole(user, ["admin", "secretaria", "bedel", "profesor"]);
  const puedeVerEstudiantes =
    puedeGestionarEstudiantes || hasAnyRole(user, ["docente", "coordinador", "jefes", "tutor", "jefa_aaee"]);

  const esDocenteSolo =
    hasAnyRole(user, ["docente"]) && !hasAnyRole(user, ["admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee"]);

  useEffect(() => {
    document.title = "Reportes de asistencia";
  }, []);

  const { data: profesoradosData, isLoading: profesoradosLoading } = useQuery<Carrera[]>({
    queryKey: ["asistencia", "profesorados"],
    queryFn: () => fetchCarreras(),
    enabled: puedeVerEstudiantes || puedeVerDocentes,
    staleTime: 5 * 60 * 1000,
  });

  const profesoradoOptions = useMemo<Option[]>(() => {
    if (!profesoradosData) return [];
    return profesoradosData
      .map((prof) => ({ id: prof.id, label: prof.nombre }))
      .sort(ordenarPorLabel);
  }, [profesoradosData]);

  const estudiantesAsistencia = useEstudiantesAsistencia({
    profesoradoOptions,
    puedeVerEstudiantes,
  });

  const docentesAsistencia = useDocentesAsistencia({
    puedeVerDocentes,
    esDocenteSolo,
    userDni: user?.dni,
  });

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, py: 1 }}>
      <Stack spacing={3}>
        <BackButton fallbackPath="/secretaria" />
        <PageHero
          title="Reportes de asistencia"
          subtitle="Filtros rápidos para acompañar el seguimiento diario de estudiantes y docentes"
        />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <EstudiantesPanel
              puedeGestionarEstudiantes={puedeGestionarEstudiantes}
              puedeVerEstudiantes={puedeVerEstudiantes}
              profesoradoOptions={profesoradoOptions}
              profesoradosLoading={profesoradosLoading}
              estudianteProfesorado={estudiantesAsistencia.estudianteProfesorado}
              setEstudianteProfesorado={estudiantesAsistencia.setEstudianteProfesorado}
              estudiantePlan={estudiantesAsistencia.estudiantePlan}
              setEstudiantePlan={estudiantesAsistencia.setEstudiantePlan}
              estudianteMateria={estudiantesAsistencia.estudianteMateria}
              setEstudianteMateria={estudiantesAsistencia.setEstudianteMateria}
              estudianteComision={estudiantesAsistencia.estudianteComision}
              setEstudianteComision={estudiantesAsistencia.setEstudianteComision}
              estudianteDesde={estudiantesAsistencia.estudianteDesde}
              setEstudianteDesde={estudiantesAsistencia.setEstudianteDesde}
              estudianteHasta={estudiantesAsistencia.estudianteHasta}
              setEstudianteHasta={estudiantesAsistencia.setEstudianteHasta}
              estudianteResultados={estudiantesAsistencia.estudianteResultados}
              cargandoEstudiantes={estudiantesAsistencia.cargandoEstudiantes}
              estudiantePlanOptions={estudiantesAsistencia.estudiantePlanOptions}
              estudiantePlanesLoading={estudiantesAsistencia.estudiantePlanesLoading}
              estudianteMateriaOptions={estudiantesAsistencia.estudianteMateriaOptions}
              estudianteMateriasLoading={estudiantesAsistencia.estudianteMateriasLoading}
              estudianteComisionOptions={estudiantesAsistencia.estudianteComisionOptions}
              estudianteComisionesLoading={estudiantesAsistencia.estudianteComisionesLoading}
              handleBuscarEstudiantes={estudiantesAsistencia.handleBuscarEstudiantes}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <DocentesPanel
              puedeGestionarDocentes={puedeGestionarDocentes}
              puedeVerDocentes={puedeVerDocentes}
              esDocenteSolo={esDocenteSolo}
              docenteDni={docentesAsistencia.docenteDni}
              setDocenteDni={docentesAsistencia.setDocenteDni}
              docenteDesde={docentesAsistencia.docenteDesde}
              setDocenteDesde={docentesAsistencia.setDocenteDesde}
              docenteHasta={docentesAsistencia.docenteHasta}
              setDocenteHasta={docentesAsistencia.setDocenteHasta}
              docenteDiaSemana={docentesAsistencia.docenteDiaSemana}
              setDocenteDiaSemana={docentesAsistencia.setDocenteDiaSemana}
              docenteClases={docentesAsistencia.docenteClases}
              docenteInfo={docentesAsistencia.docenteInfo}
              cargandoDocente={docentesAsistencia.cargandoDocente}
              docenteProfesorado={docentesAsistencia.docenteProfesorado}
              setDocenteProfesorado={docentesAsistencia.setDocenteProfesorado}
              docentePlan={docentesAsistencia.docentePlan}
              setDocentePlan={docentesAsistencia.setDocentePlan}
              docenteMateria={docentesAsistencia.docenteMateria}
              setDocenteMateria={docentesAsistencia.setDocenteMateria}
              docenteComision={docentesAsistencia.docenteComision}
              setDocenteComision={docentesAsistencia.setDocenteComision}
              docenteFecha={docentesAsistencia.docenteFecha}
              setDocenteFecha={docentesAsistencia.setDocenteFecha}
              docenteProfesOptions={docentesAsistencia.docenteProfesOptions}
              docentePlanOptions={docentesAsistencia.docentePlanOptions}
              docenteMateriaOptions={docentesAsistencia.docenteMateriaOptions}
              docenteComisionOptions={docentesAsistencia.docenteComisionOptions}
              docenteFechaOptions={docentesAsistencia.docenteFechaOptions}
              docenteClasesFiltradas={docentesAsistencia.docenteClasesFiltradas}
              handleBuscarDocente={docentesAsistencia.handleBuscarDocente}
            />
          </Grid>
        </Grid>

        <CalendarioEventosPanel canManage={puedeGestionarDocentes} />
      </Stack>
    </Box>
  );
};

export default AsistenciaReportesPage;
