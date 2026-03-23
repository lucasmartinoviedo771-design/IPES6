import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  listarHistorialRegularidades,
  obtenerPlanillaRegularidadDetalle,
} from '@/api/primeraCarga';
import { PlanillaFilaFormValues } from '../types';
import { buildDefaultRow } from '../constants';

interface UsePlanillaHistorialOptions {
  open: boolean;
  replaceFilas: (filas: PlanillaFilaFormValues[]) => void;
}

export function usePlanillaHistorial({ open, replaceFilas }: UsePlanillaHistorialOptions) {
  const historyQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'historial'],
    queryFn: () => listarHistorialRegularidades(),
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  const [historyMenuAnchor, setHistoryMenuAnchor] = React.useState<null | HTMLElement>(null);
  const isHistoryOpen = Boolean(historyMenuAnchor);

  const handleOpenHistory = (event: React.MouseEvent<HTMLButtonElement>) => {
    setHistoryMenuAnchor(event.currentTarget);
  };

  const handleCloseHistory = () => {
    setHistoryMenuAnchor(null);
  };

  const handleImportFromPlanilla = async (prevPlanillaId: number) => {
    handleCloseHistory();
    try {
      const resp = await obtenerPlanillaRegularidadDetalle(prevPlanillaId);
      if (resp.ok && resp.data.filas) {
        // En Primera Carga, reemplazamos las filas por las de la planilla previa.
        const nuevasFilas = resp.data.filas.map((f, idx) => ({
          ...buildDefaultRow(idx),
          dni: f.dni,
          apellido_nombre: f.apellido_nombre,
          orden: idx + 1
        }));
        replaceFilas(nuevasFilas);
        enqueueSnackbar(`Se importaron ${nuevasFilas.length} estudiantes de la planilla ${resp.data.codigo}`, { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar('Error al importar estudiantes', { variant: 'error' });
    }
  };

  return {
    historyQuery,
    historyMenuAnchor,
    isHistoryOpen,
    handleOpenHistory,
    handleCloseHistory,
    handleImportFromPlanilla,
  };
}
