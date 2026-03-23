import React, { useState } from 'react';
import { client as axios } from '@/api/client';
import type { CorrelatividadVersion } from '../types';

type VersionFormState = {
  nombre: string;
  descripcion: string;
  cohorteDesde: string;
  cohorteHasta: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
};

const defaultForm: VersionFormState = {
  nombre: '',
  descripcion: '',
  cohorteDesde: '',
  cohorteHasta: '',
  vigenciaDesde: '',
  vigenciaHasta: '',
  activo: true,
};

export function useVersionForm(
  planId: number | '',
  versionId: number | '',
  versiones: CorrelatividadVersion[],
  selectedVersion: CorrelatividadVersion | undefined,
  loadVersiones: (preferredId?: number) => Promise<void>,
) {
  const [versionForm, setVersionForm] = useState<VersionFormState>(defaultForm);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionModalMode, setVersionModalMode] = useState<'create' | 'duplicate' | 'edit'>('create');

  const handleVersionFieldChange =
    (field: keyof VersionFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setVersionForm((prev) => ({ ...prev, [field]: value }));
    };

  const openVersionModalHandler = (mode: 'create' | 'duplicate' | 'edit') => {
    setVersionModalMode(mode);

    const last = versiones.length ? versiones[versiones.length - 1] : undefined;

    let nombre = '';
    let descripcion = '';
    let cohorteDesde = '';
    let cohorteHasta = '';
    let vigenciaDesde = '';
    let vigenciaHasta = '';
    let activo = true;

    if (mode === 'create') {
      if (last) {
        const nextStart =
          last.cohorte_hasta !== null && last.cohorte_hasta !== undefined
            ? last.cohorte_hasta + 1
            : last.cohorte_desde + 1;

        cohorteDesde = String(nextStart);
      }
    } else if (mode === 'duplicate' && selectedVersion) {
      nombre = `${selectedVersion.nombre} (nuevo)`;

      const nextStart =
        selectedVersion.cohorte_hasta !== null && selectedVersion.cohorte_hasta !== undefined
          ? selectedVersion.cohorte_hasta + 1
          : selectedVersion.cohorte_desde + 1;

      cohorteDesde = String(nextStart);
    } else if (mode === 'edit' && selectedVersion) {
      nombre = selectedVersion.nombre;
      descripcion = selectedVersion.descripcion || '';
      cohorteDesde = String(selectedVersion.cohorte_desde);
      cohorteHasta = selectedVersion.cohorte_hasta ? String(selectedVersion.cohorte_hasta) : '';
      vigenciaDesde = selectedVersion.vigencia_desde || '';
      vigenciaHasta = selectedVersion.vigencia_hasta || '';
      activo = selectedVersion.activo;
    }

    setVersionForm({
      nombre,
      descripcion,
      cohorteDesde,
      cohorteHasta,
      vigenciaDesde,
      vigenciaHasta,
      activo,
    });

    setVersionModalOpen(true);
  };

  const submitVersionForm = async () => {
    if (!planId) {
      alert('Seleccioná un plan de estudio.');
      return;
    }

    const nombre = versionForm.nombre.trim();

    if (!nombre) {
      alert('Ingresá un nombre para la versión.');
      return;
    }

    const parsedDesde = Number(versionForm.cohorteDesde);

    if (!Number.isFinite(parsedDesde)) {
      alert('Ingresá el año inicial de cohorte.');
      return;
    }

    const parsedHasta =
      versionForm.cohorteHasta !== ''
        ? Number(versionForm.cohorteHasta)
        : null;

    if (versionForm.cohorteHasta !== '' && !Number.isFinite(parsedHasta)) {
      alert('El año final de cohorte no es válido.');
      return;
    }

    const payload = {
      nombre,
      descripcion: versionForm.descripcion.trim() || undefined,
      cohorte_desde: parsedDesde,
      cohorte_hasta: parsedHasta,
      vigencia_desde: versionForm.vigenciaDesde || null,
      vigencia_hasta: versionForm.vigenciaHasta || null,
      activo: versionForm.activo,
    };

    try {
      if (versionModalMode === 'edit' && selectedVersion) {
        await axios.put(`/correlatividades/versiones/${selectedVersion.id}`, payload);
        await loadVersiones(selectedVersion.id);
      } else {
        const body = {
          ...payload,
          duplicar_version_id:
            versionModalMode === 'duplicate' && typeof versionId === 'number'
              ? versionId
              : undefined,
        };

        const { data } = await axios.post(`/planes/${planId}/correlatividades/versiones`, body);

        await loadVersiones(data.id);
      }

      setVersionModalOpen(false);
    } catch (error: unknown) {
      const message =
        (error as any)?.response?.data?.message || (error as any)?.response?.data?.detail || 'No se pudo guardar la versión.';

      alert(message);
    }
  };

  return {
    versionForm,
    setVersionForm,
    versionModalOpen,
    setVersionModalOpen,
    versionModalMode,
    handleVersionFieldChange,
    openVersionModalHandler,
    submitVersionForm,
  };
}
