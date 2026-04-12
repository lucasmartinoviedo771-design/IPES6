import { useEffect, useMemo, useState } from 'react';
import { VentanaDto, fetchVentanas } from '@/api/ventanas';
import { listarPlanes, PlanDTO } from '@/api/cargaNotas';
import { useCarreras } from '@/hooks/useCarreras';
import { MesaPlanillaCondicionDTO, MesaPlanillaEstudianteDTO } from '@/api/estudiantes';
import { listarMaterias } from '@/api/comisiones';
import { listarDocentes, DocenteDTO } from '@/api/docentes';
import { client as api } from '@/api/client';
import { Mesa, MateriaOption, MesaTipo, MesaModalidad } from './types';
import { BASE_CUATRIMESTRE_OPTIONS, CUATRIMESTRE_LABEL, DEFAULT_ANIO_OPTIONS } from './constants';
import { ventanaTipoToMesaTipo, getTipoLabel } from './utils';

export function useMesasState() {
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [tipo, setTipo] = useState('');
  const [modalidadFiltro, setModalidadFiltro] = useState('');
  const { data: profesorados = [] } = useCarreras();
  const [planesFiltro, setPlanesFiltro] = useState<PlanDTO[]>([]);
  const [planesNueva, setPlanesNueva] = useState<PlanDTO[]>([]);
  const [profesoradoFiltro, setProfesoradoFiltro] = useState<string>('');
  const [planFiltro, setPlanFiltro] = useState<string>('');
  const [anioFiltro, setAnioFiltro] = useState<string>('');
  const [cuatrimestreFiltro, setCuatrimestreFiltro] = useState<string>('');
  const [materiaFiltro, setMateriaFiltro] = useState<string>('');
  const [codigoFiltro, setCodigoFiltro] = useState<string>('');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [form, setForm] = useState<Partial<Mesa> & { ventana_id?: number; fecha2?: string }>({ 
    tipo: 'FIN', 
    fecha: new Date().toISOString().slice(0, 10), 
    fecha2: '',
    cupo: 0 
  });
  const [ventanaNueva, setVentanaNueva] = useState<string>('');
  const [profesoradoNueva, setProfesoradoNueva] = useState<string>('');
  const [planNueva, setPlanNueva] = useState<string>('');
  const [anioNueva, setAnioNueva] = useState<string>('');
  const [cuatrimestreNueva, setCuatrimestreNueva] = useState<string>('');
  const [materias, setMaterias] = useState<MateriaOption[]>([]);
  const [materiasFiltro, setMateriasFiltro] = useState<MateriaOption[]>([]);
  const [docentesLista, setDocentesLista] = useState<DocenteDTO[]>([]);
  const [docentesLoading, setDocentesLoading] = useState(false);
  const [mesaEspecial, setMesaEspecial] = useState(false);
  const [tribunalDocentes, setTribunalDocentes] = useState<{ presidente: DocenteDTO | null; vocal1: DocenteDTO | null; vocal2: DocenteDTO | null }>({
    presidente: null,
    vocal1: null,
    vocal2: null,
  });
  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<MesaModalidad[]>(['REG', 'LIB']);
  const [planillaModalOpen, setPlanillaModalOpen] = useState(false);
  const [planillaMesa, setPlanillaMesa] = useState<Mesa | null>(null);
  const [planillaCondiciones, setPlanillaCondiciones] = useState<MesaPlanillaCondicionDTO[]>([]);
  const [planillaEstudiantes, setPlanillaEstudiantes] = useState<MesaPlanillaEstudianteDTO[]>([]);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSaving, setPlanillaSaving] = useState(false);
  const [planillaError, setPlanillaError] = useState<string | null>(null);
  const [planillaSuccess, setPlanillaSuccess] = useState<string | null>(null);

  const condicionPorValor = useMemo(() => {
    const map = new Map<string, MesaPlanillaCondicionDTO>();
    planillaCondiciones.forEach((cond) => map.set(cond.value, cond));
    return map;
  }, [planillaCondiciones]);

  const loadVentanas = async () => {
    const data = await fetchVentanas();
    const filtradas = (data || []).filter(v => ['MESAS_FINALES', 'MESAS_EXTRA'].includes(v.tipo));
    setVentanas(filtradas);
    if (filtradas.length) {
      setVentanaId((prev) => (prev ? prev : String(filtradas[0].id)));
      setVentanaNueva((prev) => (prev ? prev : String(filtradas[0].id)));
    }
  };

  const loadMesas = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (ventanaId) params.ventana_id = Number(ventanaId);
      if (tipo) params.tipo = tipo;
      if (materiaFiltro) params.materia_id = Number(materiaFiltro);
      if (profesoradoFiltro) params.profesorado_id = Number(profesoradoFiltro);
      if (planFiltro) params.plan_id = Number(planFiltro);
      if (anioFiltro) params.anio = Number(anioFiltro);
      if (cuatrimestreFiltro) params.cuatrimestre = cuatrimestreFiltro;
      if (codigoFiltro.trim()) params.codigo = codigoFiltro.trim();
      const { data } = await api.get<Mesa[]>(`/mesas`, { params });
      const mesasObtenidas = data || [];
      const mesasFiltradas = modalidadFiltro ? mesasObtenidas.filter((m) => m.modalidad === modalidadFiltro) : mesasObtenidas;
      setMesas(mesasFiltradas);
    } catch (error) {
      console.error('No se pudieron obtener las mesas', error);
      setMesas([]);
    }
  };

  useEffect(() => { loadVentanas(); }, []);
  useEffect(() => {
    const loadDocentesLista = async () => {
      setDocentesLoading(true);
      try {
        const data = await listarDocentes();
        setDocentesLista(data);
      } catch {
        setDocentesLista([]);
      } finally {
        setDocentesLoading(false);
      }
    };
    loadDocentesLista();
  }, []);

  useEffect(() => {
    if (ventanaId) {
      setVentanaNueva(ventanaId);
    } else {
      setVentanaNueva('');
    }
  }, [ventanaId]);

  const ventanaSeleccionada = useMemo(() => {
    return ventanas.find((v) => String(v.id) === ventanaNueva) || null;
  }, [ventanas, ventanaNueva]);

  const tipoVentanaSeleccionada = ventanaTipoToMesaTipo(ventanaSeleccionada || undefined);
  const mesaTipoSeleccionado: MesaTipo | null = mesaEspecial ? 'ESP' : tipoVentanaSeleccionada;
  const mesaTipoLabel = mesaTipoSeleccionado ? getTipoLabel(mesaTipoSeleccionado) : null;

  const handleToggleModalidad = (modalidad: MesaModalidad, enabled: boolean) => {
    setModalidadesSeleccionadas((prev) => {
      if (enabled) {
        return prev.includes(modalidad) ? prev : [...prev, modalidad];
      }
      const next = prev.filter((m) => m !== modalidad);
      return next.length ? next : ['REG'];
    });
  };

  useEffect(() => {
    if (mesaEspecial) {
      if (ventanaNueva) {
        setVentanaNueva('');
      }
      return;
    }
    if (ventanaNueva && !ventanas.some((v) => String(v.id) === ventanaNueva)) {
      setVentanaNueva(ventanas.length ? String(ventanas[0].id) : '');
      return;
    }
    if (!ventanaNueva && ventanas.length) {
      setVentanaNueva(String(ventanas[0].id));
    }
  }, [mesaEspecial, ventanas, ventanaNueva]);

  useEffect(() => {
    if (ventanaId && !ventanas.some((v) => String(v.id) === ventanaId)) {
      setVentanaId('');
    }
  }, [ventanaId, ventanas]);

  useEffect(() => {
    if (!profesoradoFiltro) {
      setPlanesFiltro([]);
      setPlanFiltro('');
      setMateriasFiltro([]);
      setMateriaFiltro('');
      setAnioFiltro('');
      setCuatrimestreFiltro('');
      return;
    }
    setPlanFiltro('');
    setMateriasFiltro([]);
    setMateriaFiltro('');
    setAnioFiltro('');
    setCuatrimestreFiltro('');
    const fetchPlanes = async () => {
      try {
        const data = await listarPlanes(Number(profesoradoFiltro));
        setPlanesFiltro(data);
      } catch {
        setPlanesFiltro([]);
        setMateriasFiltro([]);
      }
    };
    fetchPlanes();
  }, [profesoradoFiltro]);

  useEffect(() => {
    if (!profesoradoNueva) {
      setPlanesNueva([]);
      setPlanNueva('');
      setMaterias([]);
      setForm(f => ({ ...f, materia_id: undefined }));
      setAnioNueva('');
      setCuatrimestreNueva('');
      return;
    }
    const fetchPlanes = async () => {
      try {
        const data = await listarPlanes(Number(profesoradoNueva));
        setPlanesNueva(data);
      } catch {
        setPlanesNueva([]);
      }
    };
    fetchPlanes();
  }, [profesoradoNueva]);

  useEffect(() => {
    if (planNueva && !planesNueva.some((p) => String(p.id) === planNueva)) {
      setPlanNueva('');
      setMaterias([]);
      setForm((f) => ({ ...f, materia_id: undefined }));
    }
  }, [planNueva, planesNueva]);

  useEffect(() => {
    if (planFiltro && !planesFiltro.some((p) => String(p.id) === planFiltro)) {
      setPlanFiltro('');
      setMateriaFiltro('');
    }
  }, [planFiltro, planesFiltro]);

  useEffect(() => {
    if (!planFiltro) {
      setMateriasFiltro([]);
      setMateriaFiltro('');
      setAnioFiltro('');
      setCuatrimestreFiltro('');
      return;
    }
    setMateriaFiltro('');
    const fetchMateriasFiltro = async () => {
      try {
        const data = await listarMaterias(Number(planFiltro));
        const mapped: MateriaOption[] = data.map(m => ({
          id: m.id,
          nombre: m.nombre,
          anio: m.anio_cursada ?? null,
          cuatrimestre: m.regimen ?? null,
          permiteLibre: Boolean(m.permite_mesa_libre),
        }));
        setMateriasFiltro(mapped);
      } catch {
        setMateriasFiltro([]);
      }
    };
    fetchMateriasFiltro();
  }, [planFiltro]);

  useEffect(() => {
    if (!planNueva) {
      setMaterias([]);
      setForm(f => ({ ...f, materia_id: undefined }));
      setAnioNueva('');
      setCuatrimestreNueva('');
      return;
    }
    const fetchMaterias = async () => {
      try {
        const data = await listarMaterias(Number(planNueva));
        const mapped: MateriaOption[] = data.map(m => ({
          id: m.id,
          nombre: m.nombre,
          anio: m.anio_cursada ?? null,
          cuatrimestre: m.regimen ?? null,
          permiteLibre: Boolean(m.permite_mesa_libre),
        }));
        setMaterias(mapped);
        setAnioNueva('');
        setCuatrimestreNueva('');
      } catch {
        setMaterias([]);
      }
    };
    fetchMaterias();
  }, [planNueva]);

  useEffect(() => {
    if (form.materia_id && !materias.some((m) => m.id === form.materia_id)) {
      setForm((f) => ({ ...f, materia_id: undefined }));
    }
  }, [form.materia_id, materias]);

  const materiasFiltroFiltradas = useMemo(() => {
    return materiasFiltro
      .filter(m => !anioFiltro || m.anio === Number(anioFiltro))
      .filter(m => !cuatrimestreFiltro || m.cuatrimestre === cuatrimestreFiltro);
  }, [materiasFiltro, anioFiltro, cuatrimestreFiltro]);

  useEffect(() => {
    if (materiaFiltro && !materiasFiltroFiltradas.some((m) => String(m.id) === materiaFiltro)) {
      setMateriaFiltro('');
    }
  }, [materiaFiltro, materiasFiltroFiltradas]);

  useEffect(() => { loadMesas(); }, [ventanaId, tipo, modalidadFiltro, materiaFiltro, profesoradoFiltro, planFiltro, anioFiltro, cuatrimestreFiltro, codigoFiltro]);

  const resetTribunalDocentes = () => {
    setTribunalDocentes({ presidente: null, vocal1: null, vocal2: null });
  };

  const handleTribunalChange = (rol: 'presidente' | 'vocal1' | 'vocal2', value: DocenteDTO | null) => {
    setTribunalDocentes((prev) => ({
      ...prev,
      [rol]: value,
    }));
  };

  const handleMesaEspecialChange = (checked: boolean) => {
    setMesaEspecial(checked);
    if (checked) {
      setVentanaNueva('');
    } else if (!ventanaNueva && ventanas.length) {
      setVentanaNueva(String(ventanas[0].id));
    }
  };

  const materiasFiltradas = useMemo(() => {
    return materias
      .filter(m => !anioNueva || m.anio === Number(anioNueva))
      .filter(m => !cuatrimestreNueva || m.cuatrimestre === cuatrimestreNueva);
  }, [materias, anioNueva, cuatrimestreNueva]);

  const materiaSeleccionada = useMemo(
    () => materias.find((m) => m.id === form.materia_id) ?? null,
    [materias, form.materia_id]
  );

  const availableAniosNueva = useMemo(() => {
    const valores = new Set<number>();
    materias.forEach(m => {
      if (typeof m.anio === 'number' && m.anio !== null) {
        valores.add(m.anio);
      }
    });
    const lista = Array.from(valores).sort((a, b) => a - b);
    if (lista.length) return lista;
    return DEFAULT_ANIO_OPTIONS;
  }, [materias]);

  const availableAniosFiltro = useMemo(() => {
    const valores = new Set<number>();
    mesas.forEach(m => {
      if (typeof m.anio_cursada === 'number') {
        valores.add(m.anio_cursada);
      }
    });
    const lista = Array.from(valores).sort((a, b) => a - b);
    return lista.length ? lista : DEFAULT_ANIO_OPTIONS;
  }, [mesas]);

  const cuatrimestreOptionsNueva = useMemo(() => {
    const base = [...BASE_CUATRIMESTRE_OPTIONS];
    const extras = new Set<string>();
    materias.forEach(m => {
      if (m.cuatrimestre) {
        extras.add(m.cuatrimestre);
      }
    });
    extras.forEach(value => {
      if (!base.some(option => option.value === value)) {
        base.push({
          value,
          label: CUATRIMESTRE_LABEL[value] ?? value,
        });
      }
    });
    return base;
  }, [materias]);

  const cuatrimestreOptionsFiltro = useMemo(() => {
    const base = [...BASE_CUATRIMESTRE_OPTIONS];
    mesas.forEach(m => {
      if (m.regimen && !base.some(option => option.value === m.regimen)) {
        base.push({
          value: m.regimen,
          label: CUATRIMESTRE_LABEL[m.regimen] ?? m.regimen,
        });
      }
    });
    return base;
  }, [mesas]);

  return {
    // ventanas
    ventanas, ventanaId, setVentanaId,
    ventanaNueva, setVentanaNueva,
    ventanaSeleccionada,
    // tipo / modalidad filtro
    tipo, setTipo,
    modalidadFiltro, setModalidadFiltro,
    // profesorado
    profesorados,
    profesoradoFiltro, setProfesoradoFiltro,
    profesoradoNueva, setProfesoradoNueva,
    // planes
    planesFiltro, planesNueva,
    planFiltro, setPlanFiltro,
    planNueva, setPlanNueva,
    // anio / cuatrimestre
    anioFiltro, setAnioFiltro,
    cuatrimestreFiltro, setCuatrimestreFiltro,
    anioNueva, setAnioNueva,
    cuatrimestreNueva, setCuatrimestreNueva,
    // materia
    materiaFiltro, setMateriaFiltro,
    codigoFiltro, setCodigoFiltro,
    materias, materiasFiltro,
    materiasFiltradas, materiasFiltroFiltradas,
    materiaSeleccionada,
    // mesas
    mesas, loadMesas,
    // form
    form, setForm,
    // mesa especial
    mesaEspecial,
    mesaTipoSeleccionado, mesaTipoLabel,
    handleMesaEspecialChange,
    // modalidades
    modalidadesSeleccionadas,
    handleToggleModalidad,
    // tribunal
    docentesLista, docentesLoading,
    tribunalDocentes,
    handleTribunalChange,
    resetTribunalDocentes,
    // computed options
    availableAniosNueva, availableAniosFiltro,
    cuatrimestreOptionsNueva, cuatrimestreOptionsFiltro,
    // planilla
    planillaModalOpen, setPlanillaModalOpen,
    planillaMesa, setPlanillaMesa,
    planillaCondiciones, setPlanillaCondiciones,
    planillaEstudiantes, setPlanillaEstudiantes,
    planillaLoading, setPlanillaLoading,
    planillaSaving, setPlanillaSaving,
    planillaError, setPlanillaError,
    planillaSuccess, setPlanillaSuccess,
    condicionPorValor,
  };
}
