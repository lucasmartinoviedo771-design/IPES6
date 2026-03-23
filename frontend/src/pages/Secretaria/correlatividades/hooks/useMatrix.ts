import { useEffect, useState } from 'react';
import { client as axios } from '@/api/client';
import type { MatrixRow } from '../types';

export function useMatrix(planId: number | '', versionId: number | '') {
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [allRows, setAllRows] = useState<MatrixRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [anio, setAnio] = useState<number | ''>('');
  const [filter, setFilter] = useState('');
  const [regimen, setRegimen] = useState<string | ''>('');
  const [formato, setFormato] = useState<string | ''>('');
  const [sortBy, setSortBy] = useState<'nombre' | 'anio' | 'regimen'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const loadMatrix = async () => {
    if (!planId || typeof versionId !== 'number') { setMatrix([]); return; }

    setLoading(true);

    try {
      const params: string[] = [];

      if (anio) params.push(`anio_cursada=${anio}`);
      if (filter) params.push(`nombre=${encodeURIComponent(filter)}`);
      if (regimen) params.push(`regimen=${encodeURIComponent(regimen)}`);
      if (formato) params.push(`formato=${encodeURIComponent(formato)}`);

      params.push(`version_id=${versionId}`);

      const qs = params.length ? `?${params.join('&')}` : '';
      const url = `/planes/${planId}/correlatividades_matrix${qs}`;
      const { data } = await axios.get<MatrixRow[]>(url);

      setMatrix(data);
    } finally {
      setLoading(false);
    }
  };

  const loadAllMaterias = async () => {
    if (!planId || typeof versionId !== 'number') {
      setAllRows(null);
      return;
    }
    try {
      const params = `?version_id=${versionId}`;
      const { data } = await axios.get<MatrixRow[]>(`/planes/${planId}/correlatividades_matrix${params}`);
      setAllRows(data);
    } catch (error) {
      console.error('Error loading all materias:', error);
      setAllRows(null);
    }
  };

  // Cargar todas las materias cuando se selecciona una versión, para poder resolver nombres
  useEffect(() => {
    if (typeof versionId === 'number') {
      loadAllMaterias();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, planId]);

  useEffect(() => { loadMatrix(); }, [planId, anio, regimen, formato, filter, versionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar fuente completa al cambiar plan o versión
  useEffect(() => { setAllRows(null); }, [planId, versionId]);

  return {
    matrix,
    setMatrix,
    allRows,
    setAllRows,
    loading,
    setLoading,
    anio,
    setAnio,
    filter,
    setFilter,
    regimen,
    setRegimen,
    formato,
    setFormato,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    loadMatrix,
    loadAllMaterias,
  };
}
