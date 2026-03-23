import { useMemo } from 'react';
import type { MatrixRow, MateriaOption } from '../types';

export function useMateriaOptions(
  matrix: MatrixRow[],
  allRows: MatrixRow[] | null,
  rowEdit: MatrixRow | null,
) {
  const materiaOptions = useMemo<MateriaOption[]>(() => {
    const src = allRows && allRows.length ? allRows : matrix;

    const maxYear = rowEdit?.anio_cursada ?? Infinity;

    const baseOptions: MateriaOption[] = src
      .filter(m => m.anio_cursada <= maxYear)
      .map(m => ({
        label: `${m.nombre} (${m.anio_cursada}º)`,
        id: m.id,
        anio_cursada: m.anio_cursada,
      }));

    const extras: MateriaOption[] = [];

    const years = [1, 2, 3].filter(y => y < maxYear);

    years.forEach(year => {
      const matches = baseOptions.filter(opt => opt.anio_cursada === year);

      if (matches.length) {
        extras.push({
          label: `Todo ${year}º año`,
          id: `year-${year}`,
          anio_cursada: year,
          aggregateIds: matches.map(opt => opt.id as number),
        });
      }
    });

    return [...extras, ...baseOptions];
  }, [matrix, allRows, rowEdit]);

  const resolveIdsFromOptions = (vals: MateriaOption[]) => {
    const ids = new Set<number>();

    vals.forEach((v) => {
      if (typeof v.id === 'number') ids.add(v.id);
      if (Array.isArray(v.aggregateIds)) v.aggregateIds.forEach((id) => ids.add(id));
    });

    return Array.from(ids);
  };

  const resolveMateriaNombre = (id: number, matrixRows: MatrixRow[], allRowsSrc: MatrixRow[] | null): string => {
    const materia = matrixRows.find(m => m.id === id) || (allRowsSrc?.find(m => m.id === id));
    return materia?.nombre || `[Materia ID: ${id}]`;
  };

  return { materiaOptions, resolveIdsFromOptions, resolveMateriaNombre };
}
