import { useEffect, useMemo, useState } from 'react';
import { Box, Alert, Stack, TextField, MenuItem, Typography } from '@mui/material';

import { CartonViewer } from './CartonViewer';
import { CartonData, StudentInfo, ExamRecord } from '@/types/carton';
import { CartonPlanDTO, TrayectoriaDTO } from '@/api/estudiantes';

interface CartonTabPanelProps {
  trayectoria: TrayectoriaDTO;
  selectedPlanId?: string;
  onSelectPlan?: (planId: string) => void;
}

const getCuatrimestreLabel = (regimen?: string | null, display?: string | null): string => {
  if (!regimen && !display) return 'N/D';
  const code = regimen ?? '';
  switch (code) {
    case 'PCU':
      return '1° Cuat.';
    case 'SCU':
      return '2° Cuat.';
    case 'ANU':
      return 'Anual';
    default:
      if (!display) return 'N/D';
      const normalized = display.toLowerCase();
      if (normalized.includes('primer')) return '1° Cuat.';
      if (normalized.includes('segundo')) return '2° Cuat.';
      if (normalized.includes('anual')) return 'Anual';
      return display;
  }
};

const ORDER_BY_CUATRIMESTRE: Record<string, number> = {
  '1° Cuat.': 1,
  '2° Cuat.': 2,
  Anual: 3,
};

const buildStudentInfo = (trayectoria: TrayectoriaDTO, plan?: CartonPlanDTO): StudentInfo => {
  const estudiante = trayectoria.estudiante;
  const planMateriaIds = plan
    ? new Set(
      plan.materias
        .map((materia) => materia.materia_id)
        .filter((value): value is number => value !== null && value !== undefined),
    )
    : null;

  const totalMaterias = planMateriaIds
    ? planMateriaIds.size
    : estudiante.materias_totales ??
    (plan ? plan.materias.length : trayectoria.regularidades.length || trayectoria.historial.length);

  const planAprobadas = planMateriaIds
    ? trayectoria.aprobadas.filter((id) => planMateriaIds.has(id))
    : [];
  const aprobadasCount = planMateriaIds
    ? planAprobadas.length
    : estudiante.materias_aprobadas ?? trayectoria.aprobadas.length;

  const planRegularizadas = trayectoria.regularizadas.filter(
    (id) => planMateriaIds ? planMateriaIds.has(id) : true
  );
  const planInscriptas = trayectoria.inscriptas_actuales.filter(
    (id) => planMateriaIds ? planMateriaIds.has(id) : true
  );

  const regularizadasCount = planMateriaIds
    ? planRegularizadas.filter(id => !planAprobadas.includes(id)).length
    : estudiante.materias_regularizadas ??
    trayectoria.regularizadas.filter(id => !trayectoria.aprobadas.includes(id)).length;

  const enCursoCount = planMateriaIds
    ? planInscriptas.filter(id => !planRegularizadas.includes(id) && !planAprobadas.includes(id)).length
    : estudiante.materias_en_curso ??
    trayectoria.inscriptas_actuales.filter(id => !trayectoria.regularizadas.includes(id) && !trayectoria.aprobadas.includes(id)).length;

  return {
    apellidoNombre: estudiante.apellido_nombre,
    dni: estudiante.dni,
    telefono: estudiante.telefono ?? undefined,
    email: estudiante.email ?? undefined,
    lugarNacimiento: estudiante.lugar_nacimiento ?? undefined,
    fechaNacimiento: estudiante.fecha_nacimiento ?? undefined,
    cursoIntroductorio: estudiante.curso_introductorio ?? undefined,
    promedioGeneral: estudiante.promedio_general ?? undefined,
    libretaEntregada: estudiante.libreta_entregada ?? undefined,
    legajo: estudiante.legajo ?? null,
    legajoEstado: estudiante.legajo_estado ?? null,
    cohorte: estudiante.cohorte ?? null,
    activo: estudiante.activo ?? null,
    materiasTotales: totalMaterias ?? null,
    materiasAprobadas: aprobadasCount ?? null,
    materiasRegularizadas: regularizadasCount ?? null,
    materiasEnCurso: enCursoCount ?? null,
    fotoUrl: trayectoria.estudiante.fotoUrl ?? undefined,
  };
};

const transformData = (trayectoria: TrayectoriaDTO, plan: CartonPlanDTO): CartonData => {
  const studentInfo = buildStudentInfo(trayectoria, plan);
  const registros: ExamRecord[] = [];

  plan.materias.forEach((materia) => {
    const commonData = {
      anio: materia.anio !== null && materia.anio !== undefined ? String(materia.anio) : '—',
      cuatrimestre: getCuatrimestreLabel(materia.regimen, materia.regimen_display),
      espacioCurricular: materia.materia_nombre,
    };

    const hasRegularidad = Boolean(materia.regularidad);
    const hasFinal = Boolean(materia.final);

    if (!hasRegularidad && !hasFinal) {
      registros.push({
        ...commonData,
        tipo: 'placeholder',
      });
      return;
    }

    if (materia.regularidad) {
      registros.push({
        ...commonData,
        tipo: 'regularidad',
        fecha: materia.regularidad.fecha || undefined,
        condicion: materia.regularidad.condicion || undefined,
        nota: materia.regularidad.nota || undefined,
      });
    }

    const finalesList = materia.finales && materia.finales.length > 0 ? materia.finales : (materia.final ? [materia.final] : []);

    // Debug log to check if finales are coming through
    if (materia.finales && materia.finales.length > 1) {
      console.log(`Materia ${materia.materia_nombre} tiene ${materia.finales.length} finales`, materia.finales);
    }

    if (finalesList.length > 0) {
      finalesList.forEach((fin) => {
        registros.push({
          ...commonData,
          tipo: 'final',
          fecha: fin.fecha || undefined,
          condicion: fin.condicion || undefined,
          nota: fin.nota || undefined,
          folio: fin.folio || undefined,
          libro: fin.libro || undefined,
          idFila: fin.id_fila || undefined,
        });
      });
    }
  });

  registros.sort((a, b) => {
    const yearA = parseInt(a.anio, 10);
    const yearB = parseInt(b.anio, 10);
    if (!Number.isNaN(yearA) && !Number.isNaN(yearB) && yearA !== yearB) {
      return yearA - yearB;
    }

    const orderA = ORDER_BY_CUATRIMESTRE[a.cuatrimestre] ?? 99;
    const orderB = ORDER_BY_CUATRIMESTRE[b.cuatrimestre] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    if (a.espacioCurricular !== b.espacioCurricular) {
      return a.espacioCurricular.localeCompare(b.espacioCurricular);
    }

    const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
    const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;

    if (a.tipo !== b.tipo) {
      if (a.tipo === 'regularidad') return -1;
      if (b.tipo === 'regularidad') return 1;
    }

    return 0;
  });

  return {
    id: trayectoria.estudiante.dni,
    studentInfo,
    registros,
    edis: [],
    profesoradoNombre: plan.profesorado_nombre,
    planResolucion: plan.plan_resolucion,
    createdAt: trayectoria.updated_at,
    updatedAt: trayectoria.updated_at,
  };
};

export const CartonTabPanel = ({ trayectoria, selectedPlanId: controlledSelectedId, onSelectPlan }: CartonTabPanelProps) => {
  const planes = trayectoria.carton ?? [];
  const [internalSelectedId, setInternalSelectedId] = useState(() => {
    if (!planes.length) return '';
    const initialId = planes[0] ? String(planes[0].plan_id) : '';
    return initialId;
  });

  const handleSelect = (value: string) => {
    if (onSelectPlan) {
      onSelectPlan(value);
    }
    if (controlledSelectedId === undefined) {
      setInternalSelectedId(value);
    }
  };

  const selectedPlanId = controlledSelectedId ?? internalSelectedId;

  const selectedPlan = useMemo(() => {
    if (!planes.length) return undefined;
    if (!selectedPlanId) return planes[0];
    return planes.find((plan) => String(plan.plan_id) === selectedPlanId) ?? planes[0];
  }, [planes, selectedPlanId]);

  const transformedData = useMemo(() => {
    if (!selectedPlan) return null;
    return transformData(trayectoria, selectedPlan);
  }, [trayectoria, selectedPlan]);

  if (!planes.length || !transformedData) {
    return (
      <Box p={3}>
        <Alert severity="info">No hay datos del cartón disponibles para este estudiante.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {planes.length > 1 && (
        <TextField
          select
          size="small"
          label="Plan de estudio"
          value={selectedPlanId}
          onChange={(event) => handleSelect(event.target.value)}
          sx={{ maxWidth: 320 }}
        >
          {planes.map((plan) => (
            <MenuItem key={plan.plan_id} value={String(plan.plan_id)}>
              <Typography variant="body2">
                {plan.profesorado_nombre} — Plan {plan.plan_resolucion}
              </Typography>
            </MenuItem>
          ))}
        </TextField>
      )}

      <CartonViewer data={transformedData} />
    </Stack>
  );
};
