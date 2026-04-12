import React from 'react';
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Mesa } from './types';
import { CUATRIMESTRE_LABEL, TRIBUNAL_ROL_LABEL } from './constants';
import { getTipoLabel, getModalidadLabel } from './utils';
import { formatDate } from '@/utils/date';

interface MesaCardProps {
  mesa: Mesa;
  planillaSaving: boolean;
  planillaMesaId: number | undefined;
  onVerPlanilla: (mesa: Mesa) => void;
  onEliminar?: (id: number) => void;
}

export function MesaCard({ mesa: m, planillaSaving, planillaMesaId, onVerPlanilla, onEliminar }: MesaCardProps) {
  const horaDesde = m.hora_desde ? m.hora_desde.slice(0, 5) : '';
  const horaHasta = m.hora_hasta ? m.hora_hasta.slice(0, 5) : '';
  const regimenLabel = m.regimen ? (CUATRIMESTRE_LABEL[m.regimen] || m.regimen) : '-';
  const tipoLabel = getTipoLabel(m.tipo);
  const modalidadLabel = getModalidadLabel(m.modalidad);
  const fechaLabel = formatDate(m.fecha);

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack gap={0.5}>
        <Typography variant="subtitle2">#{m.id} - {tipoLabel} ({modalidadLabel}) - {fechaLabel}</Typography>
        <Typography variant="body2" color="text.secondary">
          Código: {m.codigo || '—'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {m.materia_nombre} (#{m.materia_id}) | {m.profesorado_nombre ?? 'Sin profesorado'} | Plan {m.plan_resolucion ?? '-'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Año {m.anio_cursada ?? '-'} | {regimenLabel} | {`${horaDesde}${horaHasta ? ` - ${horaHasta}` : ''}${m.aula ? ` | ${m.aula}` : ''}`} | Cupo: {m.cupo}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: (m.inscriptos_count ?? 0) === 0 ? 'error.main' : 'success.main' }}>
          Inscriptos: {m.inscriptos_count ?? 0}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tribunal: {m.docentes && m.docentes.length
            ? m.docentes.map((doc) => `${TRIBUNAL_ROL_LABEL[doc.rol] ?? doc.rol}: ${doc.nombre || 'Sin asignar'}`).join(' | ')
            : 'Sin designar'}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onVerPlanilla(m)}
            disabled={planillaSaving && planillaMesaId === m.id}
          >
            Planilla
          </Button>
          {onEliminar && (
            <Button size="small" color="error" onClick={() => onEliminar(m.id)}>Eliminar</Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
