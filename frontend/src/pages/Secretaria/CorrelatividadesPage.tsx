import React, { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

import BackButton from '@/components/ui/BackButton';
import { PageHero } from '@/components/ui/GradientTitles';
import { client as axios } from '@/api/client';

import type { MatrixRow, CorrSet, MateriaOption, Profesorado, Plan } from './correlatividades/types';
import { useVersiones } from './correlatividades/hooks/useVersiones';
import { useMatrix } from './correlatividades/hooks/useMatrix';
import { useMateriaOptions } from './correlatividades/hooks/useMateriaOptions';
import { useVersionForm } from './correlatividades/hooks/useVersionForm';

import { FilterBar } from './correlatividades/components/FilterBar';
import { VersionSelector } from './correlatividades/components/VersionSelector';
import { VersionBadges } from './correlatividades/components/VersionBadges';
import { CorrelativitiesTable } from './correlatividades/components/CorrelativitiesTable';
import { CorrelativitiesEditor } from './correlatividades/components/CorrelativitiesEditor';
import { VersionModal } from './correlatividades/components/VersionModal';
import { PendingChangesBar } from './correlatividades/components/PendingChangesBar';

export default function CorrelatividadesPage() {
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | ''>('');
  const [profId, setProfId] = useState<number | ''>('');

  // Editor modal
  const [open, setOpen] = useState(false);
  const [rowEdit, setRowEdit] = useState<MatrixRow | null>(null);
  const [editSet, setEditSet] = useState<CorrSet>({ regular_para_cursar: [], aprobada_para_cursar: [], aprobada_para_rendir: [] });

  // Ediciones en lote (pendientes de guardar)
  const [pending, setPending] = useState<Record<number, CorrSet>>({});
  const pendingCount = useMemo(() => Object.keys(pending).length, [pending]);

  const {
    versiones,
    versionId,
    setVersionId,
    versionLoading,
    loadVersiones,
    selectedVersion,
  } = useVersiones(planId);

  const {
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
  } = useMatrix(planId, versionId);

  const { materiaOptions, resolveIdsFromOptions, resolveMateriaNombre } = useMateriaOptions(
    matrix,
    allRows,
    rowEdit,
  );

  const {
    versionForm,
    setVersionForm,
    versionModalOpen,
    setVersionModalOpen,
    versionModalMode,
    handleVersionFieldChange,
    openVersionModalHandler,
    submitVersionForm,
  } = useVersionForm(planId, versionId, versiones, selectedVersion, loadVersiones);

  // Load profesorados on mount
  useEffect(() => {
    axios.get<Profesorado[]>('/profesorados/').then(r => setProfesorados(r.data));
  }, []);

  // Load planes when profesorado changes
  useEffect(() => {
    if (profId) {
      axios.get<Plan[]>(`/profesorados/${profId}/planes`).then(r => setPlanes(r.data));
    } else {
      setPlanes([]); setPlanId('');
    }
  }, [profId]);

  // When plan changes: reset and reload versiones
  useEffect(() => {
    setPending({});
    setMatrix([]);
    if (planId) {
      loadVersiones();
    } else {
      setVersionId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // Reset pending when version changes
  useEffect(() => { setPending({}); }, [versionId]);

  const handleFieldChange = (field: keyof CorrSet) => (_: React.SyntheticEvent, vals: MateriaOption[]) => {
    const ids = resolveIdsFromOptions(vals);
    setEditSet((prev) => ({ ...prev, [field]: ids }));
  };

  const openEditor = async (row: MatrixRow) => {
    setRowEdit(row);
    setEditSet({
      regular_para_cursar: row.regular_para_cursar || [],
      aprobada_para_cursar: row.aprobada_para_cursar || [],
      aprobada_para_rendir: row.aprobada_para_rendir || [],
    });

    // Cargar todas las materias del plan (sin filtros) para ofrecer opciones del mismo año y anteriores
    try {
      if (planId) {
        const params = typeof versionId === 'number' ? `?version_id=${versionId}` : '';
        const { data } = await axios.get<MatrixRow[]>(`/planes/${planId}/correlatividades_matrix${params}`);
        setAllRows(data);
      } else {
        setAllRows(null);
      }
    } catch {
      // Si falla, seguimos con las filas ya cargadas
      setAllRows(null);
    }

    setOpen(true);
  };

  const saveEditor = async () => {
    if (!rowEdit) return;

    // Guardado diferido: actualizamos la matriz local y marcamos pendiente
    setMatrix(prev => prev.map(m => m.id === rowEdit.id ? ({
      ...m,
      regular_para_cursar: [...editSet.regular_para_cursar],
      aprobada_para_cursar: [...editSet.aprobada_para_cursar],
      aprobada_para_rendir: [...editSet.aprobada_para_rendir],
    }) : m));
    setPending(prev => ({ ...prev, [rowEdit.id]: { ...editSet } }));
    setOpen(false); setRowEdit(null);
  };

  const saveBatch = async () => {
    const ids = Object.keys(pending).map(Number);
    if (!ids.length) return;

    if (typeof versionId !== 'number') {
      alert('Seleccioná una versión de correlatividades antes de guardar.');
      return;
    }

    setLoading(true);

    try {
      // Guardar en serie para simplificar manejo de errores
      for (const id of ids) {
        await axios.post(`/materias/${id}/correlatividades?version_id=${versionId}`, pending[id]);
      }

      setPending({});
      await loadMatrix();
    } finally {
      setLoading(false);
    }
  };

  const discardBatch = () => setPending({});

  const resolveNombre = (id: number) => resolveMateriaNombre(id, matrix, allRows);

  return (
    <div className="center-page">
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Correlatividades"
        subtitle="Definí las correlatividades y requisitos entre materias."
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <FilterBar
          profesorados={profesorados}
          profId={profId}
          setProfId={setProfId}
          planes={planes}
          planId={planId}
          setPlanId={setPlanId}
          anio={anio}
          setAnio={setAnio}
          filter={filter}
          setFilter={setFilter}
          regimen={regimen}
          setRegimen={setRegimen}
          formato={formato}
          setFormato={setFormato}
        />

        <VersionSelector
          planId={planId}
          versiones={versiones}
          versionId={versionId}
          setVersionId={setVersionId}
          versionLoading={versionLoading}
          selectedVersion={selectedVersion}
          openVersionModalHandler={openVersionModalHandler}
        />

        <PendingChangesBar
          pendingCount={pendingCount}
          loading={loading}
          onDiscard={discardBatch}
          onSave={saveBatch}
        />
      </Grid>

      {planId && typeof versionId !== 'number' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Todavía no hay una versión de correlatividades definida para este plan. Creá una para comenzar a editar.
        </Alert>
      )}

      <VersionBadges selectedVersion={selectedVersion} />

      <CorrelativitiesTable
        matrix={matrix}
        loading={loading}
        filter={filter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        setSortDir={setSortDir}
        pending={pending}
        resolveMateriaNombre={resolveNombre}
        openEditor={openEditor}
      />

      <CorrelativitiesEditor
        open={open}
        onClose={() => setOpen(false)}
        rowEdit={rowEdit}
        editSet={editSet}
        materiaOptions={materiaOptions}
        handleFieldChange={handleFieldChange}
        onSave={saveEditor}
      />

      <VersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        versionModalMode={versionModalMode}
        versionForm={versionForm}
        setVersionForm={setVersionForm}
        handleVersionFieldChange={handleVersionFieldChange}
        onSubmit={submitVersionForm}
      />
    </div>
  );
}
