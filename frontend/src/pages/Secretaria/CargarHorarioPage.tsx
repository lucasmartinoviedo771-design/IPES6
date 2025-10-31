import React, { useState, useCallback, useEffect } from 'react';
import { client as api } from '@/api/client';
import HorarioFilters from '@/components/horarios/HorarioFilters';
import TimetableGrid from '@/components/horarios/TimetableGrid';

type MateriaDTO = {
  id: number;
  nombre: string;
  regimen: string;
  formato?: string | null;
  horas_semana: number;
  anio_cursada?: number;
};

type HorarioCatedraDTO = {
  id: number;
};

type HorarioCatedraDetalleOut = {
  id: number;
  bloque_id: number;
};

const CargarHorarioPage: React.FC = () => {
  const [filters, setFilters] = useState({
    profesoradoId: null as number | null,
    planId: null as number | null,
    anioLectivo: new Date().getFullYear() as number | null,
    anioCarrera: null as number | null,
    cuatrimestre: null as 1 | 2 | null,
    turnoId: null as number | null,
  });
  const [selectedMateriaId, setSelectedMateriaId] = useState<number | null>(null);
  const [horasRequeridas, setHorasRequeridas] = useState<number>(0);
  const [horasAsignadas, setHorasAsignadas] = useState<number>(0);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const [horarioCatedra, setHorarioCatedra] = useState<HorarioCatedraDTO | null>(null);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setSelectedMateriaId(null);
    setHorasRequeridas(0);
    setHorasAsignadas(0);
    setSelectedBlocks(new Set());
    setHorarioCatedra(null);
  };

  const handleMateriaChange = (materiaId: number | null) => {
    setSelectedMateriaId(materiaId);
    setSelectedBlocks(new Set());
    setHorasAsignadas(0);
    setHorarioCatedra(null);
  };

  const handleBlocksSelected = (count: number, blocks: Set<number>) => {
    setHorasAsignadas(count);
    setSelectedBlocks(blocks);
  };

  const handleClearSelection = () => {
    setSelectedBlocks(new Set());
    setHorasAsignadas(0);
  };

  const fetchHorario = useCallback(async () => {
    if (selectedMateriaId && filters.turnoId && filters.anioLectivo) {
      try {
        const materiaResponse = await api.get<MateriaDTO>(`/materias/${selectedMateriaId}`);
        const materiaRegimen = (materiaResponse.data.regimen || '').toUpperCase();

        const params: any = {
          espacio_id: selectedMateriaId,
          turno_id: filters.turnoId,
          anio_cursada: filters.anioLectivo,
        };
        if (materiaRegimen === 'PCU' || materiaRegimen === 'SCU') {
          params.cuatrimestre = materiaRegimen;
        } else if (materiaRegimen !== 'ANU' && filters.cuatrimestre) {
          params.cuatrimestre = filters.cuatrimestre === 1 ? 'PCU' : 'SCU';
        }

        const response = await api.get<HorarioCatedraDTO[]>('/horarios_catedra', { params });

        if (response.data && response.data.length > 0) {
          const loadedHorario = response.data[0];
          setHorarioCatedra(loadedHorario);

          const detallesResponse = await api.get<HorarioCatedraDetalleOut[]>(`/horarios_catedra/${loadedHorario.id}/detalles`);
          if (detallesResponse.data) {
            const blockIds = new Set(detallesResponse.data.map((d) => d.bloque_id));
            setSelectedBlocks(blockIds);
            setHorasAsignadas(blockIds.size);
          }
        } else {
          setHorarioCatedra(null);
          setSelectedBlocks(new Set());
          setHorasAsignadas(0);
        }
      } catch (error) {
        console.error("CargarHorarioPage: Error fetching horario:", error);
        setHorarioCatedra(null);
        setSelectedBlocks(new Set());
        setHorasAsignadas(0);
      }
    }
  }, [selectedMateriaId, filters.turnoId, filters.anioLectivo]);

  useEffect(() => {
    fetchHorario();
  }, [fetchHorario]);

  const handleDuplicateToOtherCuatri = () => {
    alert('Funcionalidad "Duplicar al otro cuatri" pendiente de implementación. Necesito más detalles sobre su comportamiento para cursos anuales.');
  };

  const handleSave = async () => {
    if (!selectedMateriaId || !filters.turnoId || !filters.anioCarrera || !filters.anioLectivo) {
      alert('Por favor, selecciona una materia, turno, año de cursada y año lectivo.');
      return;
    }

    try {
      const materiaResponse = await api.get<MateriaDTO>(`/materias/${selectedMateriaId}`);
      const materia = materiaResponse.data;
      const materiaRegimen = (materia.regimen || '').toUpperCase();
      const materiaFormato = materia.formato ? materia.formato.toUpperCase() : undefined;
      const materiaAnio = materia.anio_cursada ?? null;
      const nombreNormalizado = materia.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
      const esTallerCuarto = nombreNormalizado.includes('taller') && materiaAnio === 4;
      const esTallerResidencia = nombreNormalizado.includes('taller') && nombreNormalizado.includes('residencia');
      const esFlexible = 
        materiaFormato === 'PRA' || 
        materiaFormato === 'TAL' || 
        materiaFormato === 'TALLER' || 
        nombreNormalizado.includes('practica') || 
        nombreNormalizado.includes('residencia') || 
        nombreNormalizado.includes('campo de la practica') || 
        esTallerCuarto || 
        esTallerResidencia;

      if (!esFlexible && horasAsignadas !== horasRequeridas) {
        alert(`Debes asignar exactamente ${horasRequeridas} horas. Actualmente tienes ${horasAsignadas} asignadas.`);
        return;
      }
      if (esFlexible && horasAsignadas > horasRequeridas) {
        alert(`No puedes asignar más de ${horasRequeridas} horas para esta práctica/residencia/taller flexible.`);
        return;
      }

      let cuatrimestreValue: string | null = null;
      if (materiaRegimen === 'PCU' || materiaRegimen === 'SCU') {
        cuatrimestreValue = materiaRegimen;
      } else if (materiaRegimen !== 'ANU' && filters.cuatrimestre) {
        cuatrimestreValue = filters.cuatrimestre === 1 ? 'PCU' : 'SCU';
      }

      const horarioCatedraPayload = {
        espacio_id: selectedMateriaId,
        turno_id: filters.turnoId,
        anio_cursada: filters.anioLectivo,
        cuatrimestre: cuatrimestreValue,
      };

      const response = await api.post<HorarioCatedraDTO>('/horarios_catedra', horarioCatedraPayload);
      const horarioCatedraId = response.data.id;

      const existingDetallesResponse = await api.get<HorarioCatedraDetalleOut[]>(`/horarios_catedra/${horarioCatedraId}/detalles`);
      const existingBlockIds = new Set(existingDetallesResponse.data.map((d) => d.bloque_id));
      const existingDetalleMap = new Map(existingDetallesResponse.data.map((d) => [d.bloque_id, d.id]));

      const blocksToAdd = new Set([...selectedBlocks].filter(x => !existingBlockIds.has(x)));
      const blocksToDelete = new Set([...existingBlockIds].filter(x => !selectedBlocks.has(x)));

      for (const bloqueId of blocksToAdd) {
        await api.post(`/horarios_catedra/${horarioCatedraId}/detalles`, { bloque_id: bloqueId });
      }

      for (const bloqueId of blocksToDelete) {
        const detalleId = existingDetalleMap.get(bloqueId);
        if (detalleId) {
          await api.delete(`/horarios_catedra_detalles/${detalleId}`);
        }
      }

      alert('Horario guardado exitosamente!');
      fetchHorario(); // Recargar el horario
    } catch (error: any) {
      console.error('CargarHorarioPage: Error al guardar horario:', error);
      const data = error.response?.data;
      const conflictData = data?.conflict || data?.data?.conflict;
      let message = data?.message || data?.detail || error.message;
      if (conflictData) {
        const conflict = conflictData;
        const bloque = conflict.bloque;
        const detalleBloque = bloque
          ? `Bloque ${bloque.dia} ${bloque.hora_desde}-${bloque.hora_hasta}`
          : '';
        message += `\nConflicto con ${conflict.materia_nombre || 'otra materia'} (${conflict.turno || 'Turno'}) - ${detalleBloque}`;
      }
      alert(`Error al guardar horario: ${message}`);
    }
  };

  const handleExport = () => {
    alert('Funcionalidad "Imprimir / Exportar" pendiente de implementación.');
  };

  return (
    <div className="center-page">
      <h1 className="text-3xl font-extrabold mb-1">Armar Horarios de Cátedra</h1>
      <p className="text-gray-600 mb-6">
        Seleccioná una materia y un turno para definir los bloques horarios que ocupará la cátedra.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="card md:col-span-1">
          <h2 className="mb-2 font-bold">Filtros</h2>
          <HorarioFilters
            profesoradoId={filters.profesoradoId}
            planId={filters.planId}
            anioLectivo={filters.anioLectivo}
            anioCarrera={filters.anioCarrera}
            cuatrimestre={filters.cuatrimestre}
            turnoId={filters.turnoId}
            selectedMateriaId={selectedMateriaId}
            onChange={handleFilterChange}
            onMateriaChange={handleMateriaChange}
          />
        </section>

        <section className="card md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">Grilla de Horarios</h2>
            <div className="text-sm text-gray-600">Bloques: <b>{horasAsignadas}</b> / <b>{horasRequeridas}</b></div>
          </div>

          <TimetableGrid
            profesoradoId={filters.profesoradoId}
            planId={filters.planId}
            anioCarrera={filters.anioCarrera}
            cuatrimestre={filters.cuatrimestre}
            turnoId={filters.turnoId}
            onMateriaChange={handleMateriaChange}
            selectedMateriaId={selectedMateriaId}
            onBlocksSelected={handleBlocksSelected}
            selectedBlocks={selectedBlocks}
            setHorasRequeridas={setHorasRequeridas}
            onClear={handleClearSelection}
            onDuplicar={handleDuplicateToOtherCuatri}
            onGuardar={handleSave}
            onExportar={handleExport}
          />
        </section>
      </div>
    </div>
  );
};

export default CargarHorarioPage;
