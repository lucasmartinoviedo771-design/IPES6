import React from 'react';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { client as api } from '@/api/client';
import { obtenerMesaPlanilla, actualizarMesaPlanilla } from '@/api/estudiantes';
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { useMesasState } from './mesas/useMesasState';
import { NuevaMesaForm } from './mesas/NuevaMesaForm';
import { FiltrosMesas } from './mesas/FiltrosMesas';
import { MesaCard } from './mesas/MesaCard';
import { PlanillaModal } from './mesas/PlanillaModal';
import { Mesa } from './mesas/types';

export default function MesasPage() {
  const state = useMesasState();

  const guardar = async () => {
    if (!state.form.materia_id) {
      alert('Selecciona la materia de la mesa.');
      return;
    }
    if (!state.mesaEspecial && !state.ventanaNueva) {
      alert('Selecciona un periodo para la mesa.');
      return;
    }
    const tipo = state.mesaTipoSeleccionado;
    if (!tipo) {
      alert('No se pudo determinar el tipo de mesa.');
      return;
    }
    const modalidadesAcrear = state.modalidadesSeleccionadas.length ? state.modalidadesSeleccionadas : ['REG'];
    const payloadBase: any = {
      materia_id: state.form.materia_id,
      fecha: state.form.fecha,
      hora_desde: state.form.hora_desde || null,
      hora_hasta: state.form.hora_hasta || null,
      aula: state.form.aula || null,
      cupo: typeof state.form.cupo === 'number' ? state.form.cupo : Number(state.form.cupo ?? 0),
      docente_presidente_id: state.tribunalDocentes.presidente?.id ?? null,
      docente_vocal1_id: state.tribunalDocentes.vocal1?.id ?? null,
      docente_vocal2_id: state.tribunalDocentes.vocal2?.id ?? null,
      ventana_id: state.mesaEspecial ? null : Number(state.ventanaNueva),
    };
    try {
      for (const modalidad of modalidadesAcrear) {
        const payload = { ...payloadBase, tipo, modalidad };
        await api.post(`/mesas`, payload);
      }
      state.setForm({ tipo: 'FIN', fecha: new Date().toISOString().slice(0, 10), cupo: 0 });
      state.handleToggleModalidad('REG', true);
      state.resetTribunalDocentes();
      await state.loadMesas();
    } catch (error) {
      console.error('No se pudieron crear las mesas', error);
      alert('No se pudieron crear las mesas.');
    }
  };

  const eliminar = async (id: number) => {
    await api.delete(`/mesas/${id}`);
    await state.loadMesas();
  };

  const fetchPlanilla = async (mesaId: number) => {
    state.setPlanillaLoading(true);
    state.setPlanillaError(null);
    try {
      const data = await obtenerMesaPlanilla(mesaId);
      state.setPlanillaCondiciones(data.condiciones);
      state.setPlanillaEstudiantes(data.estudiantes);
    } catch (error) {
      console.error('No se pudieron cargar los datos de la planilla', error);
      state.setPlanillaCondiciones([]);
      state.setPlanillaEstudiantes([]);
      state.setPlanillaError('No se pudieron cargar los resultados de la mesa.');
    } finally {
      state.setPlanillaLoading(false);
    }
  };

  const handleVerPlanilla = (mesa: Mesa) => {
    state.setPlanillaMesa(mesa);
    state.setPlanillaModalOpen(true);
    state.setPlanillaError(null);
    state.setPlanillaSuccess(null);
    fetchPlanilla(mesa.id);
  };

  const handleCerrarPlanilla = () => {
    state.setPlanillaModalOpen(false);
    state.setPlanillaMesa(null);
    state.setPlanillaCondiciones([]);
    state.setPlanillaEstudiantes([]);
    state.setPlanillaError(null);
    state.setPlanillaSuccess(null);
    state.setPlanillaLoading(false);
    state.setPlanillaSaving(false);
  };

  const updatePlanillaEstudiante = (
    inscripcionId: number,
    updater: (prev: any) => any,
  ) => {
    state.setPlanillaEstudiantes((prev) =>
      prev.map((estudiante) => (estudiante.inscripcion_id === inscripcionId ? updater(estudiante) : estudiante))
    );
  };

  const handlePlanillaFechaChange = (inscripcionId: number, value: string) => {
    updatePlanillaEstudiante(inscripcionId, (estudiante) => ({
      ...estudiante,
      fecha_resultado: value ? value : null,
    }));
  };

  const handlePlanillaCondicionChange = (inscripcionId: number, value: string) => {
    const condicion = value || null;
    const condInfo = condicion ? state.condicionPorValor.get(condicion) : undefined;
    updatePlanillaEstudiante(inscripcionId, (estudiante) => ({
      ...estudiante,
      condicion,
      condicion_display: condInfo?.label ?? null,
      cuenta_para_intentos: condInfo ? condInfo.cuenta_para_intentos : estudiante.cuenta_para_intentos,
    }));
  };

  const handlePlanillaNotaChange = (inscripcionId: number, value: string) => {
    let nextValue: number | null = null;
    if (value !== '') {
      const parsed = Number(value);
      nextValue = Number.isNaN(parsed) ? null : parsed;
    }
    updatePlanillaEstudiante(inscripcionId, (estudiante) => ({
      ...estudiante,
      nota: nextValue,
    }));
  };

  const handlePlanillaTextoChange = (
    inscripcionId: number,
    field: 'folio' | 'libro' | 'observaciones',
    value: string,
  ) => {
    const sanitized = value.trim();
    updatePlanillaEstudiante(inscripcionId, (estudiante) => {
      const next = { ...estudiante };
      next[field] = sanitized ? sanitized : null;
      return next;
    });
  };

  const handlePlanillaCuentaIntentosChange = (inscripcionId: number, checked: boolean) => {
    updatePlanillaEstudiante(inscripcionId, (estudiante) => ({
      ...estudiante,
      cuenta_para_intentos: checked,
    }));
  };

  const handlePlanillaGuardar = async () => {
    if (!state.planillaMesa) return;
    state.setPlanillaSaving(true);
    state.setPlanillaError(null);
    state.setPlanillaSuccess(null);
    try {
      const payload = {
        estudiantes: state.planillaEstudiantes.map((estudiante) => ({
          inscripcion_id: estudiante.inscripcion_id,
          fecha_resultado: estudiante.fecha_resultado || null,
          condicion: estudiante.condicion || null,
          nota: estudiante.nota ?? null,
          folio: estudiante.folio || null,
          libro: estudiante.libro || null,
          observaciones: estudiante.observaciones || null,
          cuenta_para_intentos: estudiante.cuenta_para_intentos,
        })),
      };
      await actualizarMesaPlanilla(state.planillaMesa.id, payload);
      state.setPlanillaSuccess('Planilla guardada correctamente.');
      await fetchPlanilla(state.planillaMesa.id);
    } catch (error) {
      console.error('No se pudieron guardar los cambios de la planilla', error);
      state.setPlanillaError('No se pudieron guardar los cambios.');
    } finally {
      state.setPlanillaSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Mesas de examen"
        subtitle="ABM de mesas ordinarias, extraordinarias y especiales"
      />

      <Typography variant="h6" mb={1} mt={2}>
        Nueva mesa
      </Typography>
      <NuevaMesaForm
        ventanas={state.ventanas}
        ventanaNueva={state.ventanaNueva}
        setVentanaNueva={state.setVentanaNueva}
        profesorados={state.profesorados}
        profesoradoNueva={state.profesoradoNueva}
        setProfesoradoNueva={state.setProfesoradoNueva}
        planesNueva={state.planesNueva}
        planNueva={state.planNueva}
        setPlanNueva={state.setPlanNueva}
        anioNueva={state.anioNueva}
        setAnioNueva={state.setAnioNueva}
        cuatrimestreNueva={state.cuatrimestreNueva}
        setCuatrimestreNueva={state.setCuatrimestreNueva}
        cuatrimestreOptionsNueva={state.cuatrimestreOptionsNueva}
        availableAniosNueva={state.availableAniosNueva}
        materiasFiltradas={state.materiasFiltradas}
        form={state.form}
        setForm={state.setForm}
        mesaEspecial={state.mesaEspecial}
        mesaTipoLabel={state.mesaTipoLabel}
        handleMesaEspecialChange={state.handleMesaEspecialChange}
        modalidadesSeleccionadas={state.modalidadesSeleccionadas}
        handleToggleModalidad={state.handleToggleModalidad}
        docentesLista={state.docentesLista}
        docentesLoading={state.docentesLoading}
        tribunalDocentes={state.tribunalDocentes}
        handleTribunalChange={state.handleTribunalChange}
        onGuardar={guardar}
      />

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 4 }}>Filtros</Typography>
      <FiltrosMesas
        ventanas={state.ventanas}
        ventanaId={state.ventanaId}
        setVentanaId={state.setVentanaId}
        tipo={state.tipo}
        setTipo={state.setTipo}
        modalidadFiltro={state.modalidadFiltro}
        setModalidadFiltro={state.setModalidadFiltro}
        codigoFiltro={state.codigoFiltro}
        setCodigoFiltro={state.setCodigoFiltro}
        profesorados={state.profesorados}
        profesoradoFiltro={state.profesoradoFiltro}
        setProfesoradoFiltro={state.setProfesoradoFiltro}
        setPlanFiltro={state.setPlanFiltro}
        setMateriaFiltro={state.setMateriaFiltro}
        planesFiltro={state.planesFiltro}
        planFiltro={state.planFiltro}
        anioFiltro={state.anioFiltro}
        setAnioFiltro={state.setAnioFiltro}
        cuatrimestreFiltro={state.cuatrimestreFiltro}
        setCuatrimestreFiltro={state.setCuatrimestreFiltro}
        cuatrimestreOptionsFiltro={state.cuatrimestreOptionsFiltro}
        availableAniosFiltro={state.availableAniosFiltro}
        materiasFiltroFiltradas={state.materiasFiltroFiltradas}
        materiaFiltro={state.materiaFiltro}
      />

      <Grid container spacing={1.5} sx={{ mt: 2 }}>
        {state.mesas.map(m => (
          <Grid item xs={12} md={6} lg={4} key={m.id}>
            <MesaCard
              mesa={m}
              planillaSaving={state.planillaSaving}
              planillaMesaId={state.planillaMesa?.id}
              onVerPlanilla={handleVerPlanilla}
              onEliminar={eliminar}
            />
          </Grid>
        ))}
      </Grid>

      <PlanillaModal
        open={state.planillaModalOpen}
        planillaMesa={state.planillaMesa}
        planillaCondiciones={state.planillaCondiciones}
        planillaEstudiantes={state.planillaEstudiantes}
        planillaLoading={state.planillaLoading}
        planillaSaving={state.planillaSaving}
        planillaError={state.planillaError}
        planillaSuccess={state.planillaSuccess}
        onCerrar={handleCerrarPlanilla}
        onGuardar={handlePlanillaGuardar}
        onCondicionChange={handlePlanillaCondicionChange}
        onNotaChange={handlePlanillaNotaChange}
        onFechaChange={handlePlanillaFechaChange}
        onCuentaIntentosChange={handlePlanillaCuentaIntentosChange}
        onTextoChange={handlePlanillaTextoChange}
      />
    </Box>
  );
}
