import { useMemo } from 'react';
import { UseFormSetValue, UseFormGetValues } from 'react-hook-form';
import { PlanillaFormValues, SituacionDisponible, PlanillaDetalleData } from '../types';
import {
  RegularidadMetadataMateria,
  RegularidadMetadataPlantilla,
  RegularidadMetadataProfesorado,
} from '@/api/primeraCarga';

interface UsePlanillaCalculationsOptions {
  selectedProfesorado?: RegularidadMetadataProfesorado;
  selectedMateria?: RegularidadMetadataMateria;
  selectedPlantilla?: RegularidadMetadataPlantilla;
  localSituacionesDisponibles: SituacionDisponible[];
  getValues: UseFormGetValues<PlanillaFormValues>;
  setValue: UseFormSetValue<PlanillaFormValues>;
  detailData?: PlanillaDetalleData;
}

export function usePlanillaCalculations({
  selectedProfesorado,
  selectedMateria,
  selectedPlantilla,
  localSituacionesDisponibles,
  getValues,
  setValue,
  detailData,
}: UsePlanillaCalculationsOptions) {
  
  const previewCodigo = useMemo(() => {
    // Escuchamos fechaSeleccionada vía getValues en lugar de watch en este hook 
    // para evitar re-renders excesivos del hook maestro, se asume que si la UI necesita 
    // reactividad al código, debe hacerlo el componente, acá solo la generamos.
    const fechaSeleccionada = getValues('fecha');
    if (!selectedProfesorado || !fechaSeleccionada) {
      return null;
    }
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(selectedProfesorado.id).padStart(2, '0')}${selectedProfesorado.acronimo}${day}XXX`;
  }, [selectedProfesorado, getValues]); // getValues reference won't change

  const calculateSituacionForRow = (index: number) => {
    const row = getValues(`filas.${index}`);
    if (!selectedMateria && !detailData) return;
 
    // Parsers
    const parseVal = (v: string | number | null | undefined) => {
      if (!v || v === '---') return 0;
      return Number(String(v).replace(',', '.'));
    };
 
    const asistencia = row.asistencia ? parseInt(row.asistencia, 10) : 0;
    const notaVal = row.nota_final === '---' || !row.nota_final ? 0 : parseVal(row.nota_final);
 
    let newSit = '';
    const dictado = selectedPlantilla?.dictado || selectedMateria?.dictado || detailData?.regimen || '';
    let formato = selectedMateria?.formato?.toUpperCase() || detailData?.formato?.toUpperCase() || '';

    // Fallback if materia has no format but template does
    if (!formato && selectedPlantilla) {
      const pName = selectedPlantilla.nombre.toUpperCase();
      if (pName.includes('TALLER')) formato = 'TALLER';
      else if (pName.includes('SEMINARIO')) formato = 'SEMINARIO';
      else if (pName.includes('ASIGNATURA')) formato = 'ASIGNATURA';
      else if (pName.includes('MODULO')) formato = 'MODULO';
      else if (pName.includes('LABORATORIO')) formato = 'LABORATORIO';
    }

    const isAnual = dictado === 'ANUAL';
    const is1C = dictado === '1C' || dictado === '1° Cuatrimestre';
    const is2C = dictado === '2C' || dictado === '2° Cuatrimestre';

    // Logic groups
    const isTallerGroup = ['TAL', 'TALLER', 'SEM', 'SEMINARIO', 'LAB', 'LABORATORIO', 'PRA', 'PRACTICA'].includes(formato || '');
    const isAsignaturaGroup = ['ASI', 'ASIGNATURA'].includes(formato || '');
    const isModuloGroup = ['MOD', 'MODULO'].includes(formato || '');

    // LÓGICA STRICTA PARA MODULO/ASIGNATURA/TALLER
    let thresholdRegular = 65;
    if (isTallerGroup || isModuloGroup) {
      thresholdRegular = row.excepcion ? 65 : 80;
    }

    if (isModuloGroup || isAsignaturaGroup || isTallerGroup) {
      if (asistencia < 30) {
        newSit = 'LIBRE-AT';
      } else if (asistencia < thresholdRegular) {
        newSit = 'LIBRE-I';
      } else {
        // Attendance OK -> Check Grades
        let desaprobado = false;

        if (isAnual) {
          const tpFinal = parseVal(row.datos?.tp_final);
          const tp1 = parseVal(row.datos?.tp_1c);
          const tp2 = parseVal(row.datos?.tp_2c);

          const hasTpFinal = row.datos && 'tp_final' in row.datos;
          const hasTp1 = row.datos && 'tp_1c' in row.datos;
          const hasTp2 = row.datos && 'tp_2c' in row.datos;

          if (hasTpFinal && tpFinal < 6) desaprobado = true;
          if (hasTp1 && tp1 < 6) desaprobado = true;
          if (hasTp2 && tp2 < 6) desaprobado = true;

          const p1 = parseVal(row.datos?.parcial_1p);
          const r1 = parseVal(row.datos?.parcial_1r);
          const p2 = parseVal(row.datos?.parcial_2p);
          const r2 = parseVal(row.datos?.parcial_2r);

          if (!isTallerGroup) {
            if (Math.max(p1, r1) < 6) desaprobado = true;
            if (Math.max(p2, r2) < 6) desaprobado = true;
          }
        } else if (is1C) {
          const tp = parseVal(row.datos?.tp_1c);
          const p = parseVal(row.datos?.parcial_1p);
          const r = parseVal(row.datos?.parcial_1r);

          if (tp < 6) desaprobado = true;
          if (!isTallerGroup && Math.max(p, r) < 6) desaprobado = true;
        } else if (is2C) {
          const tp = parseVal(row.datos?.tp_2c);
          const p = parseVal(row.datos?.parcial_2p);
          const r = parseVal(row.datos?.parcial_2r);

          if (tp < 6) desaprobado = true;
          if (!isTallerGroup && Math.max(p, r) < 6) desaprobado = true;
        }

        // Global Final Note Check
        if (notaVal < 6) desaprobado = true;

        if (desaprobado) {
          let specificStatus = 'DESAPROBADO_PA';

          const tp1 = parseVal(row.datos?.tp_1c);
          const tp2 = parseVal(row.datos?.tp_2c);
          const tpFinal = parseVal(row.datos?.tp_final);

          if (is1C && tp1 < 6) specificStatus = 'DESAPROBADO_TP';
          else if (is2C && tp2 < 6) specificStatus = 'DESAPROBADO_TP';
          else if (isAnual) {
            if ((row.datos && 'tp_final' in row.datos && tpFinal < 6) ||
              (row.datos && 'tp_1c' in row.datos && tp1 < 6) ||
              (row.datos && 'tp_2c' in row.datos && tp2 < 6)) {
              specificStatus = 'DESAPROBADO_TP';
            }
          }

          if (isTallerGroup) specificStatus = 'DESAPROBADO_TP';

          newSit = specificStatus;
        } else {
          // Passed
          if (isTallerGroup) {
            newSit = 'APROBADO';
          } else if (isModuloGroup) {
            let promo = false;
            if (asistencia >= 80) {
              if (isAnual) {
                const p1 = parseVal(row.datos?.parcial_1p);
                const p2 = parseVal(row.datos?.parcial_2p);
                if (p1 >= 8 && p2 >= 8) promo = true;
              } else if (is1C) {
                const p = parseVal(row.datos?.parcial_1p);
                if (p >= 8) promo = true;
              } else if (is2C) {
                const p = parseVal(row.datos?.parcial_2p);
                if (p >= 8) promo = true;
              }
            }

            newSit = promo ? 'PROMOCION' : 'REGULAR';
          } else {
            newSit = 'REGULAR';
          }
        }
      }
    }

    const validCodes = localSituacionesDisponibles.map((s) => s.codigo);

    const findCode = (search: string) => {
      const found = localSituacionesDisponibles.find((s) =>
        s.codigo === search ||
        s.label?.toUpperCase() === search ||
        s.label?.toUpperCase().includes(search)
      );
      return found ? found.codigo : search;
    };

    if (newSit === 'APROBADO') {
      newSit = findCode('APROBADO'); 
    }

    const mapCode = (short: string, long: string) => {
      if (newSit === short && !validCodes.includes(short) && validCodes.includes(long)) {
        newSit = long;
      } else if (newSit === long && !validCodes.includes(long) && validCodes.includes(short)) {
        newSit = short;
      }
    }

    mapCode('PRO', 'PROMOCIONADO');
    mapCode('REG', 'REGULAR');
    mapCode('LIBRE', 'LIBRE-I');
    mapCode('APR', 'APROBADO');

    if (!validCodes.includes(newSit)) {
      const similar = localSituacionesDisponibles.find((s) => s.label?.toUpperCase().includes(newSit.replace(/_/g, ' ')));
      if (similar) newSit = similar.codigo;
    }

    if (newSit !== row.situacion) {
      setValue(`filas.${index}.situacion`, newSit, { shouldDirty: true });
    }
  };

  return { previewCodigo, calculateSituacionForRow };
}
