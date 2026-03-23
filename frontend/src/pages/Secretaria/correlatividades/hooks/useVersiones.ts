import { useMemo, useState } from 'react';
import { client as axios } from '@/api/client';
import type { CorrelatividadVersion } from '../types';

export function useVersiones(planId: number | '') {
  const [versiones, setVersiones] = useState<CorrelatividadVersion[]>([]);
  const [versionId, setVersionId] = useState<number | ''>('');
  const [versionLoading, setVersionLoading] = useState(false);

  const selectedVersion = useMemo(
    () => (typeof versionId === 'number' ? versiones.find(v => v.id === versionId) : undefined),
    [versiones, versionId],
  );

  const loadVersiones = async (preferredId?: number) => {
    if (!planId) {
      setVersiones([]);
      setVersionId('');
      return;
    }

    setVersionLoading(true);

    try {
      const { data } = await axios.get<CorrelatividadVersion[]>(`/planes/${planId}/correlatividades/versiones`);

      setVersiones(data);
      setVersiones(data);

      if (!data.length) {
        setVersionId('');
        return;
      }

      setVersionId((prev) => {
        if (preferredId && data.some((v) => v.id === preferredId)) {
          return preferredId;
        }

        if (typeof prev === 'number' && data.some((v) => v.id === prev)) {
          return prev;
        }

        return data[data.length - 1].id;
      });
    } catch (error) {
      console.error('Error fetching versiones de correlatividades:', error);
      setVersiones([]);
      setVersionId('');
    } finally {
      setVersionLoading(false);
    }
  };

  return {
    versiones,
    setVersiones,
    versionId,
    setVersionId,
    versionLoading,
    loadVersiones,
    selectedVersion,
  };
}
