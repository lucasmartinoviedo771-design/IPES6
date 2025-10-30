import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Stack, TextField, MenuItem, Grid, Paper, Button, Alert, FormGroup, FormControlLabel, Checkbox, FormLabel, FormControl, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { client as api } from '@/api/client';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { listarPlanes, listarProfesorados, PlanDTO, ProfesoradoDTO } from '@/api/cargaNotas';
import { obtenerMesaPlanilla, actualizarMesaPlanilla, MesaPlanillaAlumnoDTO, MesaPlanillaCondicionDTO } from '@/api/alumnos';
import { listarMaterias } from '@/api/comisiones';

const CUATRIMESTRE_LABEL: Record<string, string> = {
  ANU: 'Anual',
  PCU: '1er cuatrimestre',
  SCU: '2do cuatrimestre',
};

const BASE_CUATRIMESTRE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ANU', label: 'Anual' },
  { value: 'PCU', label: '1er cuatrimestre' },
  { value: 'SCU', label: '2do cuatrimestre' },
];

const DEFAULT_ANIO_OPTIONS = Array.from({ length: 6 }, (_value, index) => index + 1);

type Mesa = {
  id:number;
  materia_id:number;
  materia_nombre:string;
  profesorado_id:number | null;
  profesorado_nombre:string | null;
  plan_id:number | null;
  plan_resolucion:string | null;
  anio_cursada:number | null;
  regimen:string | null;
  tipo:string;
  modalidad:string;
  fecha:string;
  hora_desde?:string;
  hora_hasta?:string;
  aula?:string;
  cupo:number;
};

type MateriaOption = {
  id: number;
  nombre: string;
  anio: number | null;
  cuatrimestre: string | null;
  permiteLibre: boolean;
};

type MesaTipo = 'FIN' | 'EXT';

type MesaModalidad = 'REG' | 'LIB';

const MESA_TIPO_LABEL: Record<MesaTipo, string> = {
  FIN: 'Final',
  EXT: 'Extraordinaria',
};

const MESA_MODALIDAD_LABEL: Record<MesaModalidad, string> = {
  REG: 'Regulares',
  LIB: 'Libres',
};

const getTipoLabel = (tipo: string) => MESA_TIPO_LABEL[(tipo as MesaTipo)] ?? tipo;

const getModalidadLabel = (modalidad: string) =>
  MESA_MODALIDAD_LABEL[(modalidad as MesaModalidad)] ?? modalidad;

const ventanaTipoToMesaTipo = (ventana?: VentanaDto): MesaTipo | null => {
  if (!ventana) return null;
  switch (ventana.tipo) {
    case 'MESAS_FINALES':
      return 'FIN';
    case 'MESAS_EXTRA':
      return 'EXT';
    default:
      return null;
  }
};

export default function MesasPage(){
  const [ventanas, setVentanas] = useState<VentanaDto[]>([]);
  const [ventanaId, setVentanaId] = useState<string>('');
  const [tipo, setTipo] = useState('');
  const [modalidadFiltro, setModalidadFiltro] = useState('');
  const [profesorados, setProfesorados] = useState<ProfesoradoDTO[]>([]);
    const [planesFiltro, setPlanesFiltro] = useState<PlanDTO[]>([]);
  const [planesNueva, setPlanesNueva] = useState<PlanDTO[]>([]);
  const [profesoradoFiltro, setProfesoradoFiltro] = useState<string>('');
  const [planFiltro, setPlanFiltro] = useState<string>('');
  const [anioFiltro, setAnioFiltro] = useState<string>('');
  const [cuatrimestreFiltro, setCuatrimestreFiltro] = useState<string>('');
  const [materiaFiltro, setMateriaFiltro] = useState<string>('');
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [form, setForm] = useState<Partial<Mesa> & { ventana_id?: number }>({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });
  const [ventanaNueva, setVentanaNueva] = useState<string>('');
  const [profesoradoNueva, setProfesoradoNueva] = useState<string>('');
  const [planNueva, setPlanNueva] = useState<string>('');
  const [anioNueva, setAnioNueva] = useState<string>('');
  const [cuatrimestreNueva, setCuatrimestreNueva] = useState<string>('');
  const [materias, setMaterias] = useState<MateriaOption[]>([]);
  const [materiasFiltro, setMateriasFiltro] = useState<MateriaOption[]>([]);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<MesaTipo[]>([]);
  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<MesaModalidad[]>(['REG']);
  const [planillaModalOpen, setPlanillaModalOpen] = useState(false);
  const [planillaMesa, setPlanillaMesa] = useState<Mesa | null>(null);
  const [planillaCondiciones, setPlanillaCondiciones] = useState<MesaPlanillaCondicionDTO[]>([]);
  const [planillaAlumnos, setPlanillaAlumnos] = useState<MesaPlanillaAlumnoDTO[]>([]);
  const [planillaLoading, setPlanillaLoading] = useState(false);
  const [planillaSaving, setPlanillaSaving] = useState(false);
  const [planillaError, setPlanillaError] = useState<string | null>(null);
  const [planillaSuccess, setPlanillaSuccess] = useState<string | null>(null);
  const condicionPorValor = useMemo(() => {
    const map = new Map<string, MesaPlanillaCondicionDTO>();
    planillaCondiciones.forEach((cond) => map.set(cond.value, cond));
    return map;
  }, [planillaCondiciones]);

  const loadVentanas = async()=>{
    const data = await fetchVentanas();
    const filtradas = (data||[]).filter(v=> ['MESAS_FINALES','MESAS_EXTRA'].includes(v.tipo));
    setVentanas(filtradas);
    if (filtradas.length){
      setVentanaId((prev) => (prev ? prev : String(filtradas[0].id)));
      setVentanaNueva((prev) => (prev ? prev : String(filtradas[0].id)));
    }
  };
  const loadProfesorados = async()=>{
    try{
      const data = await listarProfesorados();
      setProfesorados(data);
    }catch{
      setProfesorados([]);
    }
  };
  const loadMesas = async()=>{
    try{
      const params: Record<string, unknown> = {};
      if (ventanaId) params.ventana_id = Number(ventanaId);
      if (tipo) params.tipo = tipo;
      if (materiaFiltro) params.materia_id = Number(materiaFiltro);
      if (profesoradoFiltro) params.profesorado_id = Number(profesoradoFiltro);
      if (planFiltro) params.plan_id = Number(planFiltro);
      if (anioFiltro) params.anio = Number(anioFiltro);
      if (cuatrimestreFiltro) params.cuatrimestre = cuatrimestreFiltro;
      const { data } = await api.get<Mesa[]>(`/mesas`, { params });
      const mesasObtenidas = data || [];
      const mesasFiltradas = modalidadFiltro ? mesasObtenidas.filter((m) => m.modalidad === modalidadFiltro) : mesasObtenidas;
      setMesas(mesasFiltradas);
    }catch (error){
      console.error('No se pudieron obtener las mesas', error);
      setMesas([]);
    }
  };
  useEffect(()=>{ loadVentanas(); loadProfesorados(); },[]);
  useEffect(() => {
    if (ventanaId) {
      setVentanaNueva(ventanaId);
    } else {
      setVentanaNueva('');
    }
  }, [ventanaId]);

  const ventanasPorTipo = useMemo(() => {
    const map: Record<MesaTipo, VentanaDto[]> = { FIN: [], EXT: [] };
    ventanas.forEach((v) => {
      const tipo = ventanaTipoToMesaTipo(v);
      if (tipo) {
        map[tipo].push(v);
      }
    });
    return map;
  }, [ventanas]);

  const ventanaSeleccionada = useMemo(() => {
    return ventanas.find((v) => String(v.id) === ventanaNueva) || null;
  }, [ventanas, ventanaNueva]);

  const tipoVentanaSeleccionada = ventanaTipoToMesaTipo(ventanaSeleccionada || undefined);

    const handleToggleTipo = (tipo: MesaTipo, enabled: boolean) => {
    setTiposSeleccionados((prev) => {
      if (enabled) {
        if (prev.includes(tipo)) {
          return prev;
        }
        return [...prev, tipo];
      }
      const next = prev.filter((t) => t !== tipo);
      return next;
    });
  };

  const handleToggleModalidad = (modalidad: MesaModalidad, enabled: boolean) => {
    setModalidadesSeleccionadas((prev) => {
      if (modalidad === 'LIB' && enabled && !materiaPermiteLibres) {
        return prev.filter((m) => m !== 'LIB');
      }
      if (enabled) {
        return prev.includes(modalidad) ? prev : [...prev, modalidad];
      }
      const next = prev.filter((m) => m !== modalidad);
      return next.length ? next : ['REG'];
    });
  };

  useEffect(() => {
    setTiposSeleccionados((prev) => {
      const valid = prev.filter((tipo) => {
        if (tipo === tipoVentanaSeleccionada) {
          return true;
        }
        return (ventanasPorTipo[tipo] || []).length > 0;
      });

      const result: MesaTipo[] = [];
      if (tipoVentanaSeleccionada) {
        result.push(tipoVentanaSeleccionada);
      }
      valid.forEach((tipo) => {
        if (!result.includes(tipo)) {
          result.push(tipo);
        }
      });

      if (!result.length && tipoVentanaSeleccionada) {
        result.push(tipoVentanaSeleccionada);
      }

      const sameLength = result.length === prev.length;
      const sameItems = sameLength && result.every((value, index) => value === prev[index]);
      return sameItems ? prev : result;
    });
  }, [ventanasPorTipo, tipoVentanaSeleccionada]);

  useEffect(()=>{
    if (!profesoradoFiltro){
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
    const fetchPlanes = async()=>{
      try{
        const data = await listarPlanes(Number(profesoradoFiltro));
        setPlanesFiltro(data);
      }catch{
        setPlanesFiltro([]);
        setMateriasFiltro([]);
      }
    };
    fetchPlanes();
  },[profesoradoFiltro]);

  useEffect(()=>{
    if (!profesoradoNueva){
      setPlanesNueva([]);
      setPlanNueva('');
      setMaterias([]);
      setForm(f => ({ ...f, materia_id: undefined }));
      setAnioNueva('');
      setCuatrimestreNueva('');
      return;
    }
    const fetchPlanes = async()=>{
      try{
        const data = await listarPlanes(Number(profesoradoNueva));
        setPlanesNueva(data);
      }catch{
        setPlanesNueva([]);
      }
    };
    fetchPlanes();
  },[profesoradoNueva]);
  useEffect(()=>{
    if (!planFiltro){
      setMateriasFiltro([]);
      setMateriaFiltro('');
      setAnioFiltro('');
      setCuatrimestreFiltro('');
      return;
    }
    setMateriaFiltro('');
    const fetchMateriasFiltro = async()=>{
      try{
        const data = await listarMaterias(Number(planFiltro));
        const mapped: MateriaOption[] = data.map(m => ({
          id: m.id,
          nombre: m.nombre,
          anio: m.anio_cursada ?? null,
          cuatrimestre: m.regimen ?? null,
          permiteLibre: Boolean(m.permite_mesa_libre),
        }));
        setMateriasFiltro(mapped);
      }catch{
        setMateriasFiltro([]);
      }
    };
    fetchMateriasFiltro();
  },[planFiltro]);
  useEffect(()=>{
    if (!planNueva){
      setMaterias([]);
      setForm(f => ({ ...f, materia_id: undefined }));
      setAnioNueva('');
      setCuatrimestreNueva('');
      return;
    }
    const fetchMaterias = async()=>{
      try{
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
      }catch{
        setMaterias([]);
      }
    };
    fetchMaterias();
  },[planNueva]);
  useEffect(()=>{ loadMesas(); },[ventanaId, tipo, modalidadFiltro, materiaFiltro, profesoradoFiltro, planFiltro, anioFiltro, cuatrimestreFiltro]);

  const materiasFiltradas = useMemo(() => {
    return materias
      .filter(m => !anioNueva || m.anio === Number(anioNueva))
      .filter(m => !cuatrimestreNueva || m.cuatrimestre === cuatrimestreNueva);
  }, [materias, anioNueva, cuatrimestreNueva]);
  const materiaSeleccionada = useMemo(
    () => materias.find((m) => m.id === form.materia_id) ?? null,
    [materias, form.materia_id]
  );
  const materiaPermiteLibres = Boolean(materiaSeleccionada?.permiteLibre);

  useEffect(() => {
    if (!materiaPermiteLibres && modalidadesSeleccionadas.includes('LIB')) {
      setModalidadesSeleccionadas((prev) => prev.filter((modalidad) => modalidad !== 'LIB'));
    }
  }, [materiaPermiteLibres, modalidadesSeleccionadas]);

  const materiasFiltroFiltradas = useMemo(() => {
    return materiasFiltro
      .filter(m => !anioFiltro || m.anio === Number(anioFiltro))
      .filter(m => !cuatrimestreFiltro || m.cuatrimestre === cuatrimestreFiltro);
  }, [materiasFiltro, anioFiltro, cuatrimestreFiltro]);

  const availableAniosNueva = useMemo(() => {
    const valores = new Set<number>();
    materias.forEach(m => {
      if (typeof m.anio === 'number' && m.anio !== null) {
        valores.add(m.anio);
      }
    });
    const lista = Array.from(valores).sort((a, b) => a - b);
    return lista.length ? lista : DEFAULT_ANIO_OPTIONS;
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

const tiposAlternativosDisponibles = useMemo(() => {
    return (Object.keys(MESA_TIPO_LABEL) as MesaTipo[])
      .filter((tipo) => tipo !== tipoVentanaSeleccionada && (ventanasPorTipo[tipo] || []).length > 0);
  }, [tipoVentanaSeleccionada, ventanasPorTipo]);

  const guardar = async()=>{
    if (!ventanaNueva) {
      alert('Selecciona un periodo para la mesa.');
      return;
    }
    if (!form.materia_id) {
      alert('Selecciona la materia de la mesa.');
      return;
    }

    const ventanaBase = ventanas.find((v) => String(v.id) === ventanaNueva) || null;
    const tipoBase = ventanaTipoToMesaTipo(ventanaBase || undefined);

    const tiposAcrear = (tiposSeleccionados.length ? tiposSeleccionados : tipoBase ? [tipoBase] : []);
    if (!tiposAcrear.length) {
      alert('Selecciona al menos un tipo de mesa disponible.');
      return;
    }

    const modalidadesPermitidas = materiaPermiteLibres
      ? modalidadesSeleccionadas
      : modalidadesSeleccionadas.filter((modalidad) => modalidad !== 'LIB');
    const modalidadesAcrear = modalidadesPermitidas.length ? modalidadesPermitidas : ['REG'];

    const payloadBase: any = {
      materia_id: form.materia_id,
      fecha: form.fecha,
      hora_desde: form.hora_desde || null,
      hora_hasta: form.hora_hasta || null,
      aula: form.aula || null,
      cupo: typeof form.cupo === 'number' ? form.cupo : Number(form.cupo ?? 0),
    };

    const fechaMesa = form.fecha ? new Date(`${form.fecha}T00:00:00`) : null;

    const resolveVentanaDestino = (mesaTipo: MesaTipo): number | undefined => {
      if (mesaTipo === tipoBase && ventanaNueva) {
        return Number(ventanaNueva);
      }

      const candidatas = ventanasPorTipo[mesaTipo] || [];
      if (!candidatas.length) {
        return undefined;
      }

      let posibles = [...candidatas];

      if (ventanaBase) {
        const mismasFechas = candidatas.filter(
          (ventana) => ventana.desde === ventanaBase.desde && ventana.hasta === ventanaBase.hasta
        );
        if (mismasFechas.length) {
          posibles = mismasFechas;
        }

        if (ventanaBase.periodo) {
          const mismoPeriodo = posibles.filter((ventana) => ventana.periodo === ventanaBase.periodo);
          if (mismoPeriodo.length) {
            posibles = mismoPeriodo;
          }
        }
      }

      if (fechaMesa) {
        const dentroDeRango = posibles.filter((ventana) => {
          const desde = new Date(ventana.desde);
          const hasta = new Date(ventana.hasta);
          return fechaMesa >= desde && fechaMesa <= hasta;
        });
        if (dentroDeRango.length) {
          posibles = dentroDeRango;
        }
      }

      const destino = posibles[0] ?? candidatas[0];
      return destino && destino.id !== undefined ? Number(destino.id) : undefined;
    };

    const faltantes: MesaTipo[] = [];

    try {
      for (const tipo of tiposAcrear) {
        const ventanaDestinoId = resolveVentanaDestino(tipo);

        if (!ventanaDestinoId) {
          faltantes.push(tipo);
          continue;
        }

        for (const modalidad of modalidadesAcrear) {
          const payload = {
            ...payloadBase,
            tipo,
            modalidad,
            ventana_id: ventanaDestinoId,
          };

          await api.post(`/mesas`, payload);
        }
      }

      if (faltantes.length) {
        alert(`No se encontraron ventanas activas para: ${faltantes.map((t) => MESA_TIPO_LABEL[t]).join(', ')}`);
      } else {
        setForm({ tipo:'FIN', fecha: new Date().toISOString().slice(0,10), cupo: 0 });
        setTiposSeleccionados(tipoBase ? [tipoBase] : []);
        setModalidadesSeleccionadas(['REG']);
      }

      await loadMesas();
    } catch (error) {
      console.error('No se pudieron crear las mesas', error);
      alert('No se pudieron crear las mesas.');
    }
  };

  const eliminar = async(id:number)=>{
    await api.delete(`/mesas/${id}`);
    await loadMesas();
  };

  const fetchPlanilla = async (mesaId: number) => {
    setPlanillaLoading(true);
    setPlanillaError(null);
    try {
      const data = await obtenerMesaPlanilla(mesaId);
      setPlanillaCondiciones(data.condiciones);
      setPlanillaAlumnos(data.alumnos);
    } catch (error) {
      console.error('No se pudieron cargar los datos de la planilla', error);
      setPlanillaCondiciones([]);
      setPlanillaAlumnos([]);
      setPlanillaError('No se pudieron cargar los resultados de la mesa.');
    } finally {
      setPlanillaLoading(false);
    }
  };

  const handleVerPlanilla = (mesa: Mesa) => {
    setPlanillaMesa(mesa);
    setPlanillaModalOpen(true);
    setPlanillaError(null);
    setPlanillaSuccess(null);
    fetchPlanilla(mesa.id);
  };

  const handleCerrarPlanilla = () => {
    setPlanillaModalOpen(false);
    setPlanillaMesa(null);
    setPlanillaCondiciones([]);
    setPlanillaAlumnos([]);
    setPlanillaError(null);
    setPlanillaSuccess(null);
    setPlanillaLoading(false);
    setPlanillaSaving(false);
  };

  const updatePlanillaAlumno = (
    inscripcionId: number,
    updater: (prev: MesaPlanillaAlumnoDTO) => MesaPlanillaAlumnoDTO,
  ) => {
    setPlanillaAlumnos((prev) =>
      prev.map((alumno) => (alumno.inscripcion_id === inscripcionId ? updater(alumno) : alumno))
    );
  };

  const handlePlanillaFechaChange = (inscripcionId: number, value: string) => {
    const nextValue = value ? value : null;
    updatePlanillaAlumno(inscripcionId, (alumno) => ({
      ...alumno,
      fecha_resultado: nextValue,
    }));
  };

  const handlePlanillaCondicionChange = (inscripcionId: number, value: string) => {
    const condicion = value || null;
    const condInfo = condicion ? condicionPorValor.get(condicion) : undefined;
    updatePlanillaAlumno(inscripcionId, (alumno) => ({
      ...alumno,
      condicion,
      condicion_display: condInfo?.label ?? null,
      cuenta_para_intentos: condInfo ? condInfo.cuenta_para_intentos : alumno.cuenta_para_intentos,
    }));
  };

  const handlePlanillaNotaChange = (inscripcionId: number, value: string) => {
    let nextValue: number | null = null;
    if (value !== '') {
      const parsed = Number(value);
      nextValue = Number.isNaN(parsed) ? null : parsed;
    }
    updatePlanillaAlumno(inscripcionId, (alumno) => ({
      ...alumno,
      nota: nextValue,
    }));
  };

  const handlePlanillaTextoChange = (
    inscripcionId: number,
    field: 'folio' | 'libro' | 'observaciones',
    value: string,
  ) => {
    const sanitized = value.trim();
    updatePlanillaAlumno(inscripcionId, (alumno) => {
      const next: MesaPlanillaAlumnoDTO = { ...alumno };
      next[field] = sanitized ? sanitized : null;
      return next;
    });
  };

  const handlePlanillaCuentaIntentosChange = (inscripcionId: number, checked: boolean) => {
    updatePlanillaAlumno(inscripcionId, (alumno) => ({
      ...alumno,
      cuenta_para_intentos: checked,
    }));
  };

  const handlePlanillaGuardar = async () => {
    if (!planillaMesa) {
      return;
    }

    setPlanillaSaving(true);
    setPlanillaError(null);
    setPlanillaSuccess(null);

    try {
      const payload = {
        alumnos: planillaAlumnos.map((alumno) => ({
          inscripcion_id: alumno.inscripcion_id,
          fecha_resultado: alumno.fecha_resultado || null,
          condicion: alumno.condicion || null,
          nota: alumno.nota ?? null,
          folio: alumno.folio || null,
          libro: alumno.libro || null,
          observaciones: alumno.observaciones || null,
          cuenta_para_intentos: alumno.cuenta_para_intentos,
        })),
      };

      await actualizarMesaPlanilla(planillaMesa.id, payload);
      setPlanillaSuccess('Planilla guardada correctamente.');
      await fetchPlanilla(planillaMesa.id);
    } catch (error) {
      console.error('No se pudieron guardar los cambios de la planilla', error);
      setPlanillaError('No se pudieron guardar los cambios.');
    } finally {
      setPlanillaSaving(false);
    }
  };

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" fontWeight={800}>Mesas de Examen</Typography>
      <Typography variant="body2" color="text.secondary">ABM de mesas por periodo y tipo</Typography>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt:3 }}>Nueva mesa</Typography>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ mt:1, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Periodo"
          size="small"
          value={ventanaNueva}
          onChange={(e)=>setVentanaNueva(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Seleccionar</MenuItem>
          {ventanas.map(v => (
            <MenuItem key={v.id} value={String(v.id)}>{new Date(v.desde).toLocaleDateString()} - {new Date(v.hasta).toLocaleDateString()} ({v.tipo.replace('MESAS_','')})</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Profesorado"
          size="small"
          value={profesoradoNueva}
          onChange={(e)=>setProfesoradoNueva(e.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {profesorados.map(p => (
            <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Plan de estudio"
          size="small"
          value={planNueva}
          onChange={(e)=>setPlanNueva(e.target.value)}
          sx={{ minWidth: 200 }}
          disabled={!profesoradoNueva}
        >
          <MenuItem value="">Todos</MenuItem>
          {planesNueva.map(p => (
            <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Anio cursada"
          size="small"
          value={anioNueva}
          onChange={(e)=>setAnioNueva(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {availableAniosNueva.map(anio => (
            <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Cuatrimestre"
          size="small"
          value={cuatrimestreNueva}
          onChange={(e)=>setCuatrimestreNueva(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {cuatrimestreOptionsNueva.map(option => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Materia"
          size="small"
          value={form.materia_id ?? ''}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              materia_id: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          sx={{ minWidth: 240 }}
          disabled={!planNueva || !materiasFiltradas.length}
        >
          <MenuItem value="">Seleccionar</MenuItem>
          {materiasFiltradas.map(m => (
            <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
          ))}
        </TextField>
        <FormControl component="fieldset" sx={{ minWidth: 240 }}>
          <FormLabel component="legend">Tipos de mesa</FormLabel>
          <Stack direction="row" gap={1} sx={{ mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {tipoVentanaSeleccionada ? (
              <Typography variant="body2">
                Tipo principal: <strong>{MESA_TIPO_LABEL[tipoVentanaSeleccionada]}</strong>
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">Selecciona un periodo para ver los tipos disponibles.</Typography>
            )}
          </Stack>
          {tiposAlternativosDisponibles.length > 0 && (
            <FormGroup row sx={{ mt: 0.5 }}>
              {tiposAlternativosDisponibles.map((tipo) => (
                <FormControlLabel
                  key={tipo}
                  control={
                    <Checkbox
                      size="small"
                      checked={tiposSeleccionados.includes(tipo)}
                      onChange={(e) => handleToggleTipo(tipo, e.target.checked)}
                    />
                  }
                  label={MESA_TIPO_LABEL[tipo]}
                />
              ))}
            </FormGroup>
          )}
        </FormControl>
        <FormControl component="fieldset" sx={{ minWidth: 220 }}>
          <FormLabel component="legend">Modalidades</FormLabel>
          <FormGroup row sx={{ mt: 0.5 }}>
            {( ['REG','LIB'] as MesaModalidad[]).map((modalidad) => (
              <FormControlLabel
                key={modalidad}
                control={
                  <Checkbox
                    size="small"
                    checked={modalidadesSeleccionadas.includes(modalidad)}
                    onChange={(e)=>handleToggleModalidad(modalidad, e.target.checked)}
                    disabled={!materiaPermiteLibres && modalidad === 'LIB'}
                    inputProps={
                      !materiaPermiteLibres && modalidad === 'LIB'
                        ? { title: 'Esta materia no tiene mesas libres habilitadas.' }
                        : undefined
                    }
                  />
                }
                label={MESA_MODALIDAD_LABEL[modalidad]}
              />
            ))}
          </FormGroup>
          {!materiaPermiteLibres && materiaSeleccionada && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              La materia seleccionada se rinde solo en modalidad regular.
            </Typography>
          )}
        </FormControl>
        <TextField label="Fecha" size="small" type="date" value={form.fecha || ''} onChange={(e)=>setForm(f=>({...f, fecha: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora desde" size="small" type="time" value={form.hora_desde || ''} onChange={(e)=>setForm(f=>({...f, hora_desde: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Hora hasta" size="small" type="time" value={form.hora_hasta || ''} onChange={(e)=>setForm(f=>({...f, hora_hasta: e.target.value}))} InputLabelProps={{ shrink:true }} />
        <TextField label="Aula" size="small" value={form.aula || ''} onChange={(e)=>setForm(f=>({...f, aula: e.target.value}))} />
        <TextField label="Cupo" size="small" type="number" value={form.cupo ?? 0} onChange={(e)=>setForm(f=>({...f, cupo: Number(e.target.value)}))} />
        <Button variant="contained" onClick={guardar}>Guardar</Button>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt:4 }}>Filtros</Typography>
      <Stack gap={2} sx={{ mt:1 }}>
        <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ flexWrap: 'wrap' }}>
          <TextField select label="Periodo" size="small" value={ventanaId} onChange={(e)=>setVentanaId(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">Todos</MenuItem>
            {ventanas.map(v=> (
              <MenuItem key={v.id} value={String(v.id)}>{new Date(v.desde).toLocaleDateString()} - {new Date(v.hasta).toLocaleDateString()} ({v.tipo.replace('MESAS_','_')})</MenuItem>
            ))}
          </TextField>
          <TextField select label="Tipo" size="small" value={tipo} onChange={(e)=>setTipo(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="FIN">Final</MenuItem>
            <MenuItem value="EXT">Extraordinaria</MenuItem>
          </TextField>
          <TextField
            select
            label="Modalidad"
            size="small"
            value={modalidadFiltro}
            onChange={(e)=>setModalidadFiltro(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="REG">Regulares</MenuItem>
            <MenuItem value="LIB">Libres</MenuItem>
          </TextField>
          <TextField
            select
            label="Profesorado"
            size="small"
            value={profesoradoFiltro}
            onChange={(e)=>{
              setProfesoradoFiltro(e.target.value);
              setPlanFiltro('');
              setMateriaFiltro('');
            }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {profesorados.map(p => (
              <MenuItem key={p.id} value={String(p.id)}>{p.nombre}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Plan de estudio"
            size="small"
            value={planFiltro}
            onChange={(e)=>{
              setPlanFiltro(e.target.value);
              setMateriaFiltro('');
            }}
            sx={{ minWidth: 200 }}
            disabled={!profesoradoFiltro}
          >
            <MenuItem value="">Todos</MenuItem>
            {planesFiltro.map(p => (
              <MenuItem key={p.id} value={String(p.id)}>{p.resolucion}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs:'column', sm:'row' }} gap={2} sx={{ flexWrap: 'wrap' }}>
          <TextField
            select
            label="Anio cursada"
            size="small"
            value={anioFiltro}
            onChange={(e)=>setAnioFiltro(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {availableAniosFiltro.map(anio => (
              <MenuItem key={anio} value={String(anio)}>{anio}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Cuatrimestre"
            size="small"
            value={cuatrimestreFiltro}
            onChange={(e)=>setCuatrimestreFiltro(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {cuatrimestreOptionsFiltro.map(option => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Materia"
            size="small"
            value={materiaFiltro}
            onChange={(e)=>setMateriaFiltro(e.target.value)}
            sx={{ minWidth: 220 }}
            disabled={!planFiltro || !materiasFiltroFiltradas.length}
          >
            <MenuItem value="">Todas</MenuItem>
            {materiasFiltroFiltradas.map(m => (
              <MenuItem key={m.id} value={String(m.id)}>{m.nombre}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
      <Grid container spacing={1.5} sx={{ mt:2 }}>
        {mesas.map(m => {
          const horaDesde = m.hora_desde ? m.hora_desde.slice(0, 5) : '';
          const horaHasta = m.hora_hasta ? m.hora_hasta.slice(0, 5) : '';
          const regimenLabel = m.regimen ? (CUATRIMESTRE_LABEL[m.regimen] || m.regimen) : '-';
          const tipoLabel = getTipoLabel(m.tipo);
          const modalidadLabel = getModalidadLabel(m.modalidad);
          const fechaLabel = m.fecha ? new Date(m.fecha).toLocaleDateString() : '-';
          return (
            <Grid item xs={12} md={6} lg={4} key={m.id}>
              <Paper variant="outlined" sx={{ p:1.5 }}>
                <Stack gap={0.5}>
                  <Typography variant="subtitle2">#{m.id} - {tipoLabel} ({modalidadLabel}) - {fechaLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {m.materia_nombre} (#{m.materia_id}) | {m.profesorado_nombre ?? 'Sin profesorado'} | Plan {m.plan_resolucion ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Anio {m.anio_cursada ?? '-'} | {regimenLabel} | {`${horaDesde}${horaHasta ? ` - ${horaHasta}` : ''}${m.aula ? ` | ${m.aula}` : ''}`} | Cupo: {m.cupo}
                  </Typography>
                  <Stack direction="row" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={()=>handleVerPlanilla(m)}
                      disabled={planillaSaving && planillaMesa?.id === m.id}
                    >
                      Planilla
                    </Button>
                    <Button size="small" color="error" onClick={()=>eliminar(m.id)} >Eliminar</Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
      <Dialog open={planillaModalOpen} onClose={handleCerrarPlanilla} fullWidth maxWidth="lg">
        <DialogTitle>Planilla de mesa #{planillaMesa?.id}</DialogTitle>
        <DialogContent dividers>
          {planillaMesa && (
            <Stack spacing={0.5} sx={{ mb:2 }}>
              <Typography variant="subtitle2">{planillaMesa.materia_nombre}</Typography>
              <Typography variant="body2" color="text.secondary">
                {getTipoLabel(planillaMesa.tipo)} ({getModalidadLabel(planillaMesa.modalidad)}) | {planillaMesa.fecha ? new Date(planillaMesa.fecha).toLocaleDateString() : '-'}
              </Typography>
            </Stack>
          )}
          {planillaError && <Alert severity="error" sx={{ mb:2 }}>{planillaError}</Alert>}
          {planillaSuccess && <Alert severity="success" sx={{ mb:2 }}>{planillaSuccess}</Alert>}
          {planillaLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py:4 }}>
              <CircularProgress />
            </Stack>
          ) : planillaAlumnos.length === 0 ? (
            <Alert severity="info">No hay inscripciones registradas para esta mesa.</Alert>
          ) : (
            <Box sx={{ overflowX:'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>DNI</TableCell>
                    <TableCell>Apellido y nombre</TableCell>
                    <TableCell>Condicion</TableCell>
                    <TableCell>Nota</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Cuenta intentos</TableCell>
                    <TableCell>Folio</TableCell>
                    <TableCell>Libro</TableCell>
                    <TableCell>Observaciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planillaAlumnos.map((alumno) => (
                    <TableRow key={alumno.inscripcion_id}>
                      <TableCell>{alumno.dni}</TableCell>
                      <TableCell>{alumno.apellido_nombre}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={alumno.condicion ?? ''}
                          onChange={(e)=>handlePlanillaCondicionChange(alumno.inscripcion_id, e.target.value)}
                          disabled={planillaSaving}
                        >
                          <MenuItem value="">Sin asignar</MenuItem>
                          {planillaCondiciones.map((cond) => (
                            <MenuItem key={cond.value} value={cond.value}>{cond.label}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={alumno.nota ?? ''}
                          onChange={(e)=>handlePlanillaNotaChange(alumno.inscripcion_id, e.target.value)}
                          disabled={planillaSaving}
                          inputProps={{ step: 0.5, min: 0, max: 10 }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          type="date"
                          value={alumno.fecha_resultado ?? ''}
                          onChange={(e)=>handlePlanillaFechaChange(alumno.inscripcion_id, e.target.value)}
                          disabled={planillaSaving}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox
                          checked={Boolean(alumno.cuenta_para_intentos)}
                          onChange={(e)=>handlePlanillaCuentaIntentosChange(alumno.inscripcion_id, e.target.checked)}
                          disabled={planillaSaving}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          size="small"
                          value={alumno.folio ?? ''}
                          onChange={(e)=>handlePlanillaTextoChange(alumno.inscripcion_id, 'folio', e.target.value)}
                          disabled={planillaSaving}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField
                          size="small"
                          value={alumno.libro ?? ''}
                          onChange={(e)=>handlePlanillaTextoChange(alumno.inscripcion_id, 'libro', e.target.value)}
                          disabled={planillaSaving}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        <TextField
                          size="small"
                          value={alumno.observaciones ?? ''}
                          onChange={(e)=>handlePlanillaTextoChange(alumno.inscripcion_id, 'observaciones', e.target.value)}
                          disabled={planillaSaving}
                          multiline
                          maxRows={3}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCerrarPlanilla} disabled={planillaSaving}>Cerrar</Button>
          <Button
            onClick={handlePlanillaGuardar}
            disabled={planillaSaving || planillaLoading}
            startIcon={planillaSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}



