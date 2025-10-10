import React, { useState, useEffect } from 'react';
import HorarioFilters from '../../components/horarios/HorarioFilters';
import TimetableGrid from '../../components/horarios/TimetableGrid';
import { client as axios } from '@/api/client';

interface Materia {
  id: number;
  nombre: string;
  horas_semana: number;
  regimen: string;
}

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

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setSelectedMateriaId(null);
    setHorasRequeridas(0);
    setHorasAsignadas(0);
    setSelectedBlocks(new Set());
  };

  const handleMateriaChange = (materiaId: number | null) => {
    setSelectedMateriaId(materiaId);
  };

  const handleBlocksSelected = (count: number, blocks: Set<number>) => {
    setHorasAsignadas(count);
    setSelectedBlocks(blocks);
  };

  const handleClearSelection = () => {
    setSelectedBlocks(new Set());
    setHorasAsignadas(0);
  };

  const handleDuplicateToOtherCuatri = () => {
    alert('Funcionalidad "Duplicar al otro cuatri" pendiente de implementación. Necesito más detalles sobre su comportamiento para cursos anuales.');
  };

  const handleSave = async () => {
    if (!selectedMateriaId || !filters.turnoId || !filters.anioCarrera) {
      alert('Por favor, selecciona una materia, turno y año de cursada.');
      return;
    }

    if (horasAsignadas !== horasRequeridas) {
      alert(`Debes asignar exactamente ${horasRequeridas} horas. Actualmente tienes ${horasAsignadas} asignadas.`);
      return;
    }

    try {
      const materiaResponse = await axios.get<Materia>(`/materias/${selectedMateriaId}`);
      const materiaRegimen = materiaResponse.data.regimen;

      let cuatrimestreValue: string | null = null;
      if (materiaRegimen === 'PCU' || materiaRegimen === 'SCU') {
        cuatrimestreValue = materiaRegimen;
      }

      const horarioCatedraPayload = {
        espacio_id: selectedMateriaId,
        turno_id: filters.turnoId,
        anio_cursada: filters.anioCarrera,
        cuatrimestre: cuatrimestreValue,
      };
      const horarioCatedraResponse = await axios.post('/horarios_catedra', horarioCatedraPayload);
      const horarioCatedraId = horarioCatedraResponse.data.id;

      for (const bloqueId of selectedBlocks) {
        await axios.post(`/horarios_catedra/${horarioCatedraId}/detalles`, { bloque_id: bloqueId });
      }

      alert('Horario guardado exitosamente!');
      handleClearSelection();
    } catch (error: any) {
      console.error('Error al guardar horario:', error);
      alert(`Error al guardar horario: ${error.response?.data?.detail || error.message}`);
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

      {/* Nuevo div para el layout de dos columnas */}
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
