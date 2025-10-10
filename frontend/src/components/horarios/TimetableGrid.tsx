import React, { useState, useEffect } from 'react';
import { client as axios } from '@/api/client';

// ---- Port de "GRILLAS" del horarios_pack (40 min + recreos) ----
type Grilla = {
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  breaks: Array<{ from: string; to: string }>;
};
const GRILLAS: Record<string, Grilla> = {
  manana: {
    start: "07:45",
    end:   "12:45",
    breaks: [
      { from: "09:05", to: "09:15" },
      { from: "10:35", to: "10:45" },
    ],
  },
  tarde: {
    start: "13:00",
    end:   "18:00",
    breaks: [
      { from: "14:20", to: "14:30" },
      { from: "15:50", to: "16:00" },
    ],
  },
  vespertino: {
    start: "18:10",
    end:   "23:10",
    breaks: [
      { from: "19:30", to: "19:40" },
      { from: "21:00", to: "21:10" },
    ],
  },
  sabado: {
    start: "09:00",
    end:   "14:00",
    breaks: [
      { from: "10:20", to: "10:30" },
      { from: "11:50", to: "12:00" },
    ],
  },
};

const BLOCK_MIN = 40;

function parseHM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
// Normaliza strings de hora del backend ("HH:MM[:SS]") a "HH:MM"
function toHMString(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t;
}
function inBreak(startMin: number, endMin: number, brks: {from: string; to: string}[]) {
  return brks.some(b => {
    const s = parseHM(b.from);
    const e = parseHM(b.to);
    return startMin >= s && endMin <= e;
  });
}

interface Bloque {
  id: number;
  dia: number;
  hora_desde: string;
  hora_hasta: string;
  es_recreo: boolean;
  turno_id: number;
  dia_display: string;
  turno_nombre: string;
}

interface Materia {
  id: number;
  nombre: string;
  horas_semana: number;
  regimen: string;
}

interface TimetableGridProps {
  profesoradoId: number | null;
  planId: number | null;
  anioCarrera: number | null;
  cuatrimestre: 1 | 2 | null;
  turnoId: number | null;
  onMateriaChange: (materiaId: number | null) => void;
  selectedMateriaId: number | null;
  onBlocksSelected: (count: number, blocks: Set<number>) => void;
  selectedBlocks: Set<number>;
  onClear: () => void;
  onDuplicar: () => void;
  onGuardar: () => void;
  onExportar: () => void;
  setHorasRequeridas: (horas: number) => void;
}

const TimetableGrid: React.FC<TimetableGridProps> = (props) => {
  const { 
    profesoradoId, planId, anioCarrera, cuatrimestre, turnoId, 
    onMateriaChange, selectedMateriaId, onBlocksSelected, 
    selectedBlocks, setHorasRequeridas, onClear, onDuplicar, onGuardar, onExportar 
  } = props;

  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  // Ocupación separada para L-V y Sábado, y combinada
  const [occupiedBlocksLV, setOccupiedBlocksLV] = useState<Set<number>>(new Set());
  const [occupiedBlocksSab, setOccupiedBlocksSab] = useState<Set<number>>(new Set());
  const [occupiedBlocks, setOccupiedBlocks] = useState<Set<number>>(new Set());
  // Turno y bloques de Sábado (independiente del turno seleccionado)
  const [sabadoTurnoId, setSabadoTurnoId] = useState<number | null>(null);
  const [sabadoBloques, setSabadoBloques] = useState<Bloque[]>([]);

  const daysOfWeek = [
    { id: 1, name: 'Lunes' },
    { id: 2, name: 'Martes' },
    { id: 3, name: 'Miércoles' },
    { id: 4, name: 'Jueves' },
    { id: 5, name: 'Viernes' },
  ];

  useEffect(() => {
    if (turnoId) {
      axios.get<Bloque[]>(`/turnos/${turnoId}/bloques`)
        .then(response => setBloques(response.data))
        .catch(error => console.error('Error fetching bloques:', error));
    } else {
      setBloques([]);
    }
  }, [turnoId]);

  // Cargar turno Sábado y sus bloques una sola vez
  useEffect(() => {
    axios.get<{ id: number; nombre: string }[]>(`/turnos`)
      .then(({ data }) => {
        const findSab = (s: string) => {
          const n = s.toLowerCase();
          return n.includes('sábado') || n.includes('sabado') || n.includes('sab');
        };
        const sab = data.find(t => findSab(t.nombre));
        if (sab) {
          setSabadoTurnoId(sab.id);
          return axios.get<Bloque[]>(`/turnos/${sab.id}/bloques`).then(r => setSabadoBloques(r.data));
        }
        return Promise.resolve();
      })
      .catch(e => console.error('Error fetching turno/bloques sábado:', e));
  }, []);

  useEffect(() => {
    if (planId && anioCarrera) {
      // 1. Fetch all materias for the given plan and year.
      axios.get<Materia[]>(`/planes/${planId}/materias`, { params: { anio_cursada: anioCarrera } })
        .then(({ data }) => {
          console.log('Materias recibidas de la API:', data); // Diagnostic log

          // 2. Filter on the client-side based on the selected cuatrimestre.
          const normalizeRegimen = (s: string) => (s || '').toUpperCase().trim();
          
          const filteredMaterias = cuatrimestre
            ? data.filter(materia => {
                const regimen = normalizeRegimen(materia.regimen);
                // Corregir los valores de regimen para que coincidan con el backend ('ANU', 'PCU', 'SCU')
                const regimenCuatrimestre = cuatrimestre === 1 ? 'PCU' : 'SCU';
                return regimen === 'ANU' || regimen === regimenCuatrimestre;
              })
            : data; // If no cuatrimestre is selected, show all.
          
          console.log('Materias después del filtro:', filteredMaterias); // Diagnostic log
          setMaterias(filteredMaterias);
        })
        .catch(e => {
          console.error('Error fetching materias:', e);
          setMaterias([]); // Ensure we clear materias on error
        });
    } else {
      // If required filters are not set, clear the list.
      setMaterias([]);
      onMateriaChange(null);
    }
  }, [planId, anioCarrera, cuatrimestre, onMateriaChange]);

  useEffect(() => {
    if (anioCarrera && turnoId) {
      axios.get<Bloque[]>(`/horarios/ocupacion`, { params: { anio_cursada: anioCarrera, turno_id: turnoId, cuatrimestre } })
      .then(({data}) => setOccupiedBlocksLV(new Set(data.map(b => b.id))))
      .catch(e => console.error('Error fetching ocupacion (L-V):', e));
    } else {
      setOccupiedBlocksLV(new Set());
    }
  }, [anioCarrera, turnoId, cuatrimestre]);

  useEffect(() => {
    if (anioCarrera && sabadoTurnoId) {
      axios.get<Bloque[]>(`/horarios/ocupacion`, { params: { anio_cursada: anioCarrera, turno_id: sabadoTurnoId, cuatrimestre } })
      .then(({data}) => setOccupiedBlocksSab(new Set(data.map(b => b.id))))
      .catch(e => console.error('Error fetching ocupacion (Sábado):', e));
    } else {
      setOccupiedBlocksSab(new Set());
    }
  }, [anioCarrera, sabadoTurnoId, cuatrimestre]);

  useEffect(() => {
    const merged = new Set<number>([...Array.from(occupiedBlocksLV), ...Array.from(occupiedBlocksSab)]);
    setOccupiedBlocks(merged);
  }, [occupiedBlocksLV, occupiedBlocksSab]);

  const selectedMateria = materias.find(m => m.id === selectedMateriaId) || null;
  const selectedCount = selectedBlocks.size;

  useEffect(() => {
    setHorasRequeridas(selectedMateria?.horas_semana ?? 0);
  }, [selectedMateria, setHorasRequeridas]);

  const handleBlockClick = (bloqueId: number) => {
    if (!selectedMateriaId) {
      alert('Por favor, selecciona una materia primero.');
      return;
    }
    const newSelection = new Set(selectedBlocks);
    if (newSelection.has(bloqueId)) {
      newSelection.delete(bloqueId);
    } else {
      if (selectedCount < (selectedMateria?.horas_semana ?? 0)) {
        newSelection.add(bloqueId);
      } else {
        alert('Ya has asignado el número requerido de horas.');
      }
    }
    onBlocksSelected(newSelection.size, newSelection);
  };

  // Mapear tu turnoId → clave de GRILLAS (ajustá según tus IDs reales)
function turnoKeyFromId(tid: number | null | undefined): "manana"|"tarde"|"vespertino"|"sabado"|null {
  if (!tid) return null;
  // ejemplo: 1=mañana, 2=tarde, 3=vespertino, 4=sábado
  return tid === 1 ? "manana" : tid === 2 ? "tarde" : tid === 3 ? "vespertino" : tid === 4 ? "sabado" : null;
}
const turnoKey = turnoKeyFromId(turnoId);

// Si el backend envía `bloques`, seguimos usándolos; si no, generamos la grilla del turno
const hasBloques = bloques.length > 0;

// L–V (usa grilla del turno M/T/V si no hay datos del backend)
let timeSlotsLV: string[] = [];
  if (hasBloques) {
  timeSlotsLV = Array.from(new Set(
    bloques
      .filter(b => b.dia >= 1 && b.dia <= 5)
      .map(b => `${toHMString(b.hora_desde)}-${toHMString(b.hora_hasta)}`)
  )).sort();
} else if (turnoKey && GRILLAS[turnoKey] && turnoKey !== "sabado") {
  const meta = GRILLAS[turnoKey];
  let cur = parseHM(meta.start);
  const end = parseHM(meta.end);
  const brks = meta.breaks;
  const acc: string[] = [];
  while (cur < end) {
    const nx = Math.min(cur + BLOCK_MIN, end);
    const isBreak = inBreak(cur, nx, brks);
    acc.push(`${fmtHM(cur)}-${fmtHM(nx)}${isBreak ? "" : ""}`);
    cur = nx;
  }
  timeSlotsLV = acc;
}

// Sábado (si no hay backend, usamos su propia grilla)
let timeSlotsSab: string[] = [];
if (hasBloques) {
  timeSlotsSab = Array.from(new Set(
    bloques.filter(b => b.dia === 6).map(b => `${b.hora_desde}-${b.hora_hasta}`)
  )).sort();
} else {
  const meta = GRILLAS.sabado;
  let cur = parseHM(meta.start);
  const end = parseHM(meta.end);
  const brks = meta.breaks;
  const acc: string[] = [];
  while (cur < end) {
    const nx = Math.min(cur + BLOCK_MIN, end);
    acc.push(`${fmtHM(cur)}-${fmtHM(nx)}`);
    cur = nx;
  }
  timeSlotsSab = acc;
}

  // Sábado visible (independiente del turno seleccionado)
  const timeSlotsSabDisplay: string[] = (sabadoBloques.length > 0)
    ? Array.from(new Set(
        sabadoBloques
          .filter(b => b.dia === 6)
          .map(b => `${toHMString(b.hora_desde)}-${toHMString(b.hora_hasta)}`)
      )).sort()
    : (() => {
        const meta = GRILLAS.sabado;
        let cur = parseHM(meta.start);
        const end = parseHM(meta.end);
        const acc: string[] = [];
        while (cur < end) {
          const nx = Math.min(cur + BLOCK_MIN, end);
          acc.push(`${fmtHM(cur)}-${fmtHM(nx)}`);
          cur = nx;
        }
        return acc;
      })();

  // Cantidad de filas a mostrar (máximo entre L-V y Sábado)
  const rowCount = Math.max(timeSlotsLV.length, timeSlotsSabDisplay.length);

  return (
    <div>
      <div className="mb-4">
        <select
          className="w-full rounded-md border-gray-300 focus:border-amber-600 focus:ring-amber-600"
          value={selectedMateriaId ?? ''}
          onChange={(e) => onMateriaChange(Number(e.target.value) || null)}
        >
          <option value="">Seleccione Materia</option>
          {materias.map(m => (
            <option key={m.id} value={m.id}>
              {m.nombre} ({m.regimen}) - {m.horas_semana} hs
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="timetable w-full">
          <thead>
            <tr>
              <th className="w-28">Hora (L–V)</th>
              {daysOfWeek.map(d => <th key={d.id}>{d.name}</th>)}
              <th>Sábado</th>
              <th className="w-28">Hora (Sábado)</th>
            </tr>
          </thead>
          <tbody>
  {timeSlotsLV.map((slot, idx) => (
    <tr key={slot}>
      {/* Hora (L–V) */}
      <td className="timetable__hour">{slot}</td>

      {/* Lunes a Viernes */}
      {daysOfWeek.map((d) => {
        const bloque = bloques.find(
          b => b.dia === d.id && `${toHMString(b.hora_desde)}-${toHMString(b.hora_hasta)}` === slot
        );

        // Detectar recreo: si viene marcado en backend o por hora exacta del turno
        const recreoRanges = turnoKey && GRILLAS[turnoKey] ? GRILLAS[turnoKey].breaks : [];
        const [from, to] = slot.split("-");
        const isBreakByTime = recreoRanges.some(r => r.from === from && r.to === to);
        const isRecreo = !!bloque?.es_recreo || isBreakByTime;

        const isOccupied = bloque ? occupiedBlocks.has(bloque.id) : false;
        const isSelected = bloque ? selectedBlocks.has(bloque.id) : false;

        const className = [
          "timetable__cell",
          isRecreo ? "timetable__cell--recreo" : "",
          isOccupied ? "timetable__cell--ocupado" : "",
          isSelected ? "timetable__cell--selected" : "",
        ].join(" ");

        return (
          <td
            key={`${slot}-${d.id}`}
            className={className}
            onClick={() => {
              if (!bloque || isRecreo || isOccupied) return;
              handleBlockClick(bloque.id);
            }}
            title={isRecreo ? "Recreo" : (isOccupied ? "Ocupado" : "Disponible")}
            aria-disabled={!!(isRecreo || isOccupied)}
          >
            {isRecreo ? "Recreo" : (isOccupied ? "Ocupado" : "")}
          </td>
        );
      })}

      {/* Sábado (celdas) */}
      {(() => {
        const slotSab = timeSlotsSabDisplay[idx];
        if (!slotSab) return <td className="timetable__cell timetable__cell--empty" />;
        const bloqueSab = sabadoBloques.find(
          b => b.dia === 6 && `${toHMString(b.hora_desde)}-${toHMString(b.hora_hasta)}` === slotSab
        );
        const [fromS, toS] = slotSab.split("-");
        const isBreakSab = !!bloqueSab?.es_recreo || GRILLAS.sabado.breaks.some(r => r.from === fromS && r.to === toS);
        const isOccupiedSab = bloqueSab ? occupiedBlocks.has(bloqueSab.id) : false;
        const isSelectedSab = bloqueSab ? selectedBlocks.has(bloqueSab.id) : false;
        const classNameSab = [
          "timetable__cell",
          isBreakSab ? "timetable__cell--recreo" : "",
          isOccupiedSab ? "timetable__cell--ocupado" : "",
          isSelectedSab ? "timetable__cell--selected" : "",
        ].join(" ");
        return (
          <td
            className={classNameSab}
            onClick={() => { if (!bloqueSab || isBreakSab || isOccupiedSab) return; handleBlockClick(bloqueSab.id); }}
            title={isBreakSab ? "Recreo" : (isOccupiedSab ? "Ocupado" : "Disponible")}
            aria-disabled={!!(isBreakSab || isOccupiedSab)}
          >
            {isBreakSab ? "Recreo" : (isOccupiedSab ? "Ocupado" : "")}
          </td>
        );
      })()}

      {/* Hora (Sábado) */}
      <td className="timetable__hour">
        {timeSlotsSabDisplay[idx] ?? ""}
      </td>
    </tr>
  ))}
</tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="text-sm">
          Horas asignadas: <b>{selectedCount}</b> / Horas requeridas:{" "}
          <b>{selectedMateria?.horas_semana ?? 0}</b>
        </div>
        <div className="ml-auto flex gap-8">
          <button type="button" className="btn secondary" onClick={onClear}>Limpiar selección</button>
          <button type="button" className="btn secondary" onClick={onDuplicar}>Duplicar al otro cuatr.</button>
          <button
            type="button"
            className="btn"
            disabled={!selectedMateria || selectedCount !== (selectedMateria?.horas_semana ?? 0)}
            onClick={onGuardar}
            title={!selectedMateria ? "Seleccione materia" : selectedCount !== (selectedMateria?.horas_semana ?? 0) ? "Debe asignar exactamente las horas requeridas" : "Guardar"}
          >
            Guardar
          </button>
          <button type="button" className="btn secondary" onClick={onExportar}>Imprimir / Exportar</button>
        </div>
      </div>
    </div>
  );
};

export default TimetableGrid;
