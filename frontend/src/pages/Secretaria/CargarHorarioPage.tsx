import React, { useState, useCallback, useEffect } from 'react';
import { Box } from "@mui/material";
import { client as api } from '@/api/client';
import HorarioFilters from '@/components/horarios/HorarioFilters';
import TimetableGrid from '@/components/horarios/TimetableGrid';
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";

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

  const handleFilterChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setSelectedMateriaId(null);
    setHorasRequeridas(0);
    setHorasAsignadas(0);
    setSelectedBlocks(new Set());
    setHorarioCatedra(null);
  }, []);

  const handleMateriaChange = useCallback((materiaId: number | null) => {
    setSelectedMateriaId(materiaId);
    setSelectedBlocks(new Set());
    setHorasAsignadas(0);
    setHorarioCatedra(null);
  }, []);

  const handleBlocksSelected = useCallback((count: number, blocks: Set<number>) => {
    setHorasAsignadas(count);
    setSelectedBlocks(blocks);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedBlocks(new Set());
    setHorasAsignadas(0);
  }, []);

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
        } else if (filters.cuatrimestre) {
          // Si es ANU o cualquier otro caso con cuatrimestre seleccionado, lo usamos
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
  }, [selectedMateriaId, filters.turnoId, filters.anioLectivo, filters.cuatrimestre]);

  useEffect(() => {
    fetchHorario();
  }, [fetchHorario]);

  const handleDuplicateToOtherCuatri = () => {
    alert('Funcionalidad "Duplicar al otro cuatrimestre" pendiente de implementación. Necesito más detalles sobre su comportamiento para cursos anuales.');
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
      } else if (filters.cuatrimestre) {
        cuatrimestreValue = filters.cuatrimestre === 1 ? 'PCU' : 'SCU';
      }

      const saveToCuatri = async (cuatri: string | null) => {
        const payload = {
          espacio_id: selectedMateriaId,
          turno_id: filters.turnoId,
          anio_cursada: filters.anioLectivo,
          cuatrimestre: cuatri,
        };
        const response = await api.post<HorarioCatedraDTO>('/horarios_catedra', payload);
        const hcId = response.data.id;

        const extDetRes = await api.get<HorarioCatedraDetalleOut[]>(`/horarios_catedra/${hcId}/detalles`);
        const extIds = new Set(extDetRes.data.map((d) => d.bloque_id));
        const extMap = new Map(extDetRes.data.map((d) => [d.bloque_id, d.id]));

        const toAdd = [...selectedBlocks].filter(x => !extIds.has(x));
        const toDel = [...extIds].filter(x => !selectedBlocks.has(x));

        for (const bId of toAdd) {
          await api.post(`/horarios_catedra/${hcId}/detalles`, { bloque_id: bId });
        }
        for (const bId of toDel) {
          const detId = extMap.get(bId);
          if (detId) await api.delete(`/horarios_catedra_detalles/${detId}`);
        }
        return hcId;
      };

      await saveToCuatri(cuatrimestreValue);

      // Duplicación automática para Anuales si se guarda en el primer cuatrimestre
      if (materiaRegimen === 'ANU' && filters.cuatrimestre === 1) {
        console.log('Duplicando horario anual al segundo cuatrimestre...');
        await saveToCuatri('SCU');
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
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" sx={{ mb: 2 }} />
      <PageHero
        title="Armar Horarios de Cátedra"
        subtitle="Seleccioná una materia y un turno para definir los bloques horarios que ocupará la cátedra."
      />

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
    </Box>
  );
};

export default CargarHorarioPage;
