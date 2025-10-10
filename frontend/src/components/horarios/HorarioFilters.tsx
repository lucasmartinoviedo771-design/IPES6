import React, { useState, useEffect } from 'react';
import { client as axios } from '@/api/client';

interface Profesorado {
  id: number;
  nombre: string;
}

interface Plan {
  id: number;
  resolucion: string;
}

interface Turno {
  id: number;
  nombre: string;
}

interface HorarioFiltersProps {
  profesoradoId: number | null;
  planId: number | null;
  anioLectivo: number | null;
  anioCarrera: number | null;
  cuatrimestre: 1 | 2 | null;
  turnoId: number | null;
  onChange: (filters: {
    profesoradoId: number | null;
    planId: number | null;
    anioLectivo: number | null;
    anioCarrera: number | null;
    cuatrimestre: 1 | 2 | null;
    turnoId: number | null;
  }) => void;
}

const HorarioFilters: React.FC<HorarioFiltersProps> = (props) => {
  const { profesoradoId, planId, anioLectivo, anioCarrera, cuatrimestre, turnoId, onChange } = props;
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);

  const aniosLectivos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    axios.get<Profesorado[]>('/profesorados/').then(response => setProfesorados(response.data));
    axios.get<Turno[]>('/turnos').then(response => setTurnos(response.data));
  }, []);

  useEffect(() => {
    if (profesoradoId) {
      axios.get<Plan[]>(`/profesorados/${profesoradoId}/planes`).then(response => setPlanes(response.data));
    } else {
      setPlanes([]);
    }
  }, [profesoradoId]);

  const handleChange = (field: string, value: any) => {
    const newFilters = { ...props, [field]: value };
    if (field === 'profesoradoId') {
      newFilters.planId = null;
    }
    onChange(newFilters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Profesorado</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={profesoradoId ?? ''} onChange={(e) => handleChange('profesoradoId', Number(e.target.value) || null)}>
          <option value="">Seleccione</option>
          {profesorados.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Plan de Estudio</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={planId ?? ''} onChange={(e) => handleChange('planId', Number(e.target.value) || null)} disabled={!profesoradoId}>
          <option value="">Seleccione</option>
          {planes.map(p => <option key={p.id} value={p.id}>{p.resolucion}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Año Lectivo</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={anioLectivo ?? ''} onChange={(e) => handleChange('anioLectivo', Number(e.target.value) || null)}>
          <option value="">Seleccione</option>
          {aniosLectivos.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Año (carrera)</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={anioCarrera ?? ''} onChange={(e) => handleChange('anioCarrera', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Seleccione año</option>
          <option value="1">1.º año</option>
          <option value="2">2.º año</option>
          <option value="3">3.º año</option>
          <option value="4">4.º año</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Cuatrimestre</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={cuatrimestre ?? ''} onChange={(e) => handleChange('cuatrimestre', e.target.value ? Number(e.target.value) as 1 | 2 : null)}>
          <option value="">Seleccione</option>
          <option value="1">1.º cuatrimestre</option>
          <option value="2">2.º cuatrimestre</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="block text-sm font-medium text-gray-700">Turno</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" value={turnoId ?? ''} onChange={(e) => handleChange('turnoId', Number(e.target.value) || null)}>
          <option value="">Seleccione</option>
          {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
    </div>
  );
};

export default HorarioFilters;