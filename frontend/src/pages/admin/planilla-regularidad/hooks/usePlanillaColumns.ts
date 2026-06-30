import { useMemo } from 'react';
import { ColumnaDinamica, SituacionDisponible, PlanillaDetalleData } from '../types';

export function usePlanillaColumns({
  scope,
  detailData,
  columnasDinamicas,
  situacionesDisponibles,
}: {
  scope: 'primera_carga' | 'standard';
  detailData: PlanillaDetalleData | undefined;
  columnasDinamicas: ColumnaDinamica[];
  situacionesDisponibles: SituacionDisponible[];
}) {
  const localColumnasDinamicas = useMemo(() => {
    if (scope === 'standard' && detailData) {
      const d = detailData;
      const formato = (d.formato || '').toUpperCase();
      const regimen = (d.regimen || '').toUpperCase();
      const isAnual = regimen === 'ANU' || regimen === 'ANUAL';
      const is1C = regimen === 'PCU' || regimen === '1C' || regimen === '1° CUATRIMESTRE';
      const is2C = regimen === 'SCU' || regimen === '2C' || regimen === '2° CUATRIMESTRE';

      // Asignatura / Módulo
      if (formato === 'ASI' || formato === 'ASIGNATURA' || formato === 'MOD' || formato === 'MODULO') {
        if (isAnual) {
          return [
            { key: 'tp_1c', label: 'Nota TP 1C', type: 'number', optional: true },
            { key: 'parcial_1p', label: 'Parcial 1P', type: 'number', optional: true },
            { key: 'parcial_1r', label: 'Recup. 1P', type: 'number', optional: true },
            { key: 'tp_2c', label: 'Nota TP 2C', type: 'number', optional: true },
            { key: 'parcial_2p', label: 'Parcial 2P', type: 'number', optional: true },
            { key: 'parcial_2r', label: 'Recup. 2P', type: 'number', optional: true },
          ];
        } else if (is1C) {
          return [
            { key: 'tp_1c', label: 'Nota TP', type: 'number', optional: true },
            { key: 'parcial_1p', label: 'Parcial 1P', type: 'number', optional: true },
            { key: 'parcial_1r', label: 'Recup. 1P', type: 'number', optional: true },
          ];
        } else if (is2C) {
          return [
            { key: 'tp_2c', label: 'Nota TP', type: 'number', optional: true },
            { key: 'parcial_2p', label: 'Parcial 2P', type: 'number', optional: true },
            { key: 'parcial_2r', label: 'Recup. 2P', type: 'number', optional: true },
          ];
        }
      }

      // Taller / Práctica / Laboratorio / Seminario
      return [{ key: 'tp_final', label: 'Nota TP', type: 'number', optional: true }];
    }
    return columnasDinamicas;
  }, [scope, detailData, columnasDinamicas]);

  const localSituacionesDisponibles = useMemo(() => {
    if (scope === 'standard') {
      return (detailData?.situaciones ?? []).map(s => ({
        ...s,
        label: s.alias || s.codigo,
        codigo: s.alias || s.codigo,
      }));
    }
    return situacionesDisponibles;
  }, [scope, detailData?.situaciones, situacionesDisponibles]);

  return {
    localColumnasDinamicas,
    localSituacionesDisponibles,
  };
}
