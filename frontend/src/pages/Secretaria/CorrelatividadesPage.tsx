import React, { useEffect, useMemo, useState } from 'react';

import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';

import Autocomplete from '@mui/material/Autocomplete';

import { client as axios } from '@/api/client';



type Profesorado = { id: number; nombre: string };

type Plan = { id: number; resolucion: string };



type MatrixRow = {

  id: number;

  nombre: string;

  anio_cursada: number;

  regimen: string;

  formato: string;

  regular_para_cursar: number[];

  aprobada_para_cursar: number[];

  aprobada_para_rendir: number[];

};



type CorrSet = {

  regular_para_cursar: number[];

  aprobada_para_cursar: number[];

  aprobada_para_rendir: number[];

};



type MateriaOption = {

  label: string;

  id: number | string;

  anio_cursada: number;

  aggregateIds?: number[];

};



type CorrelatividadVersion = {

  id: number;

  nombre: string;

  descripcion?: string | null;

  cohorte_desde: number;

  cohorte_hasta?: number | null;

  vigencia_desde?: string | null;

  vigencia_hasta?: string | null;

  activo: boolean;

  correlatividades: number;

};



export default function CorrelatividadesPage() {

  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);

  const [planes, setPlanes] = useState<Plan[]>([]);

  const [planId, setPlanId] = useState<number | ''>('');

  const [profId, setProfId] = useState<number | ''>('');

  const [anio, setAnio] = useState<number | ''>('');

  const [matrix, setMatrix] = useState<MatrixRow[]>([]);

  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState('');

  const [regimen, setRegimen] = useState<string | ''>('');

  const [formato, setFormato] = useState<string | ''>('');

  const [sortBy, setSortBy] = useState<'nombre'|'anio'|'regimen'>('nombre');

  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');



  // Editor modal

  const [open, setOpen] = useState(false);

  const [rowEdit, setRowEdit] = useState<MatrixRow | null>(null);

  const [editSet, setEditSet] = useState<CorrSet>({ regular_para_cursar: [], aprobada_para_cursar: [], aprobada_para_rendir: [] });

  // Fuente completa (todas las materias del plan) para opciones del editor

  const [allRows, setAllRows] = useState<MatrixRow[] | null>(null);

  // Ediciones en lote (pendientes de guardar)

  const [pending, setPending] = useState<Record<number, CorrSet>>({});

  const pendingCount = useMemo(() => Object.keys(pending).length, [pending]);

  const [versiones, setVersiones] = useState<CorrelatividadVersion[]>([]);

  const [versionId, setVersionId] = useState<number | ''>('');

  const [versionLoading, setVersionLoading] = useState(false);

  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const [versionModalMode, setVersionModalMode] = useState<'create' | 'duplicate' | 'edit'>('create');

  const [versionForm, setVersionForm] = useState({

    nombre: '',

    descripcion: '',

    cohorteDesde: '',

    cohorteHasta: '',

    vigenciaDesde: '',

    vigenciaHasta: '',

    activo: true,

  });

  const selectedVersion = useMemo(

    () => (typeof versionId === 'number' ? versiones.find(v => v.id === versionId) : undefined),

    [versiones, versionId],

  );



  useEffect(() => {

    axios.get<Profesorado[]>('/profesorados/').then(r => setProfesorados(r.data));

  }, []);



  useEffect(() => {

    if (profId) {

      axios.get<Plan[]>(`/profesorados/${profId}/planes`).then(r => setPlanes(r.data));

    } else {

      setPlanes([]); setPlanId('');

    }

  }, [profId]);



  const loadVersiones = async (preferredId?: number) => {

    if (!planId) {

      setVersiones([]);

      setVersionId('');

      return;

    }

    setVersionLoading(true);

    try {

      const { data } = await axios.get<CorrelatividadVersion[]>(`/planes/${planId}/correlatividades/versiones`);

      setVersiones(data);

      setVersiones(data);

      if (!data.length) {

        setVersionId('');

        return;

      }

      setVersionId((prev) => {

        if (preferredId && data.some((v) => v.id === preferredId)) {

          return preferredId;

        }

        if (typeof prev === 'number' && data.some((v) => v.id === prev)) {

          return prev;

        }

        return data[data.length - 1].id;

      });

    } catch (error) {

      console.error('Error fetching versiones de correlatividades:', error);

      setVersiones([]);

      setVersionId('');

    } finally {

      setVersionLoading(false);

    }

  };



  const loadMatrix = async () => {

    if (!planId || typeof versionId !== 'number') { setMatrix([]); return; }

    setLoading(true);

    try {

      const params: string[] = [];

      if (anio) params.push(`anio_cursada=${anio}`);

      if (filter) params.push(`nombre=${encodeURIComponent(filter)}`);

      if (regimen) params.push(`regimen=${encodeURIComponent(regimen)}`);

      if (formato) params.push(`formato=${encodeURIComponent(formato)}`);

      params.push(`version_id=${versionId}`);

      const qs = params.length ? `?${params.join('&')}` : '';

      const url = `/planes/${planId}/correlatividades_matrix${qs}`;

      const { data } = await axios.get<MatrixRow[]>(url);

      setMatrix(data);

    } finally {

      setLoading(false);

    }

  };



  const versionRangeLabel = (version: CorrelatividadVersion) =>

    version.cohorte_hasta ? `${version.cohorte_desde}-${version.cohorte_hasta}` : `${version.cohorte_desde}+`;



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



  const handleVersionFieldChange =

    (field: keyof typeof versionForm) =>

    (event: React.ChangeEvent<HTMLInputElement>) => {

      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

      setVersionForm((prev) => ({ ...prev, [field]: value }));

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

    } catch (error: any) {

      const message =

        error?.response?.data?.message || error?.response?.data?.detail || 'No se pudo guardar la versión.';

      alert(message);

    }

  };





  useEffect(() => {

    setPending({});

    setMatrix([]);

    if (planId) {

      loadVersiones();

    } else {

      setVersiones([]);

      setVersionId('');

    }

  }, [planId]);



  useEffect(() => { setPending({}); }, [versionId]);



  useEffect(() => { loadMatrix(); }, [planId, anio, regimen, formato, filter, versionId]);



  const materiaOptions = useMemo<MateriaOption[]>(() => {

    const src = allRows && allRows.length ? allRows : matrix;

    const maxYear = rowEdit?.anio_cursada ?? Infinity;



    const baseOptions: MateriaOption[] = src

      .filter(m => m.anio_cursada <= maxYear)

      .map(m => ({

        label: `${m.nombre} (${m.anio_cursada}º)`,

        id: m.id,

        anio_cursada: m.anio_cursada,

      }));



    const extras: MateriaOption[] = [];

    const years = [1, 2, 3].filter(y => y < maxYear);

    years.forEach(year => {

      const matches = baseOptions.filter(opt => opt.anio_cursada === year);

      if (matches.length) {

        extras.push({

          label: `Todo ${year}º año`,

          id: `year-${year}`,

          anio_cursada: year,

          aggregateIds: matches.map(opt => opt.id as number),

        });

      }

    });



    return [...extras, ...baseOptions];

  }, [matrix, allRows, rowEdit]);



  const resolveIdsFromOptions = (vals: MateriaOption[]) => {

    const ids = new Set<number>();

    vals.forEach((v) => {

      if (typeof v.id === 'number') ids.add(v.id);

      if (Array.isArray(v.aggregateIds)) v.aggregateIds.forEach((id) => ids.add(id));

    });

    return Array.from(ids);

  };



  const handleFieldChange = (field: keyof CorrSet) => (_: any, vals: MateriaOption[]) => {

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



  // Limpiar fuente completa al cambiar plan

  useEffect(() => { setAllRows(null); }, [planId, versionId]);



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



  return (

    <div className="center-page">

      <Typography variant="h5" fontWeight={800}>Correlatividades</Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>Definí las correlatividades “para cursar” y “para rendir” por plan y año.</Typography>



      <Grid container spacing={2} sx={{ mb: 2 }}>

        <Grid item xs={12} md={4}>

          <FormControl fullWidth size="small">

            <InputLabel>Profesorado</InputLabel>

            <Select label="Profesorado" value={profId} onChange={e => setProfId(e.target.value as any)}>

              <MenuItem value="">Seleccione</MenuItem>

              {profesorados.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}

            </Select>

          </FormControl>

        </Grid>

        <Grid item xs={12} md={4}>

          <FormControl fullWidth size="small" disabled={!profId}>

            <InputLabel>Plan</InputLabel>

            <Select label="Plan" value={planId} onChange={e => setPlanId(e.target.value as any)}>

              <MenuItem value="">Seleccione</MenuItem>

              {planes.map(pl => <MenuItem key={pl.id} value={pl.id}>{pl.resolucion}</MenuItem>)}

            </Select>

          </FormControl>

        </Grid>

        <Grid item xs={12} md={4}>

          <FormControl fullWidth size="small">

            <InputLabel>Año (carrera)</InputLabel>

            <Select label="Año (carrera)" value={anio} onChange={e => setAnio(e.target.value as any)}>

              <MenuItem value="">Todos</MenuItem>

              <MenuItem value={1}>1º año</MenuItem>

              <MenuItem value={2}>2º año</MenuItem>

              <MenuItem value={3}>3º año</MenuItem>

              <MenuItem value={4}>4º año</MenuItem>

            </Select>

          </FormControl>

        </Grid>

        <Grid item xs={12} md={3}>

          <TextField fullWidth size="small" label="Buscar materia" value={filter} onChange={e=>setFilter(e.target.value)} />

        </Grid>

        <Grid item xs={12} md={3}>

          <FormControl fullWidth size="small">

            <InputLabel>Régimen</InputLabel>

            <Select label="Régimen" value={regimen} onChange={e => setRegimen(e.target.value as any)}>

              <MenuItem value="">Todos</MenuItem>

              <MenuItem value="ANU">Anual</MenuItem>

              <MenuItem value="PCU">1º cuatrimestre</MenuItem>

              <MenuItem value="SCU">2º cuatrimestre</MenuItem>

            </Select>

          </FormControl>

        </Grid>

        <Grid item xs={12} md={3}>

          <FormControl fullWidth size="small">

            <InputLabel>Formato</InputLabel>

            <Select label="Formato" value={formato} onChange={e => setFormato(e.target.value as any)}>

              <MenuItem value="">Todos</MenuItem>

              <MenuItem value="ASI">Asignatura</MenuItem>

              <MenuItem value="PRA">Práctica</MenuItem>

              <MenuItem value="MOD">Módulo</MenuItem>

              <MenuItem value="TAL">Taller</MenuItem>

              <MenuItem value="LAB">Laboratorio</MenuItem>

              <MenuItem value="SEM">Seminario</MenuItem>

            </Select>

          </FormControl>

        </Grid>

        {planId && (

          <Grid item xs={12} md={6}>

            <FormControl fullWidth size="small" disabled={versionLoading || versiones.length === 0}>

              <InputLabel>Versión de correlatividades</InputLabel>

              <Select

                label="Versión de correlatividades"

                value={versionId === '' ? '' : String(versionId)}

                onChange={(e) => {

                  const value = e.target.value;

                  setVersionId(value === '' ? '' : Number(value));

                }}

              >

                <MenuItem value="">Seleccione</MenuItem>

                {versiones.map((v) => (

                  <MenuItem key={v.id} value={v.id}>

                    {v.nombre} — Cohortes {versionRangeLabel(v)}

                  </MenuItem>

                ))}

              </Select>

            </FormControl>

          </Grid>

        )}

        {planId && (

          <Grid item xs={12}>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="flex-start">

              <Button variant="outlined" onClick={() => openVersionModalHandler('create')}>

                Nueva versión

              </Button>

              <Button

                variant="outlined"

                disabled={!selectedVersion}

                onClick={() => selectedVersion && openVersionModalHandler('duplicate')}

              >

                Duplicar versión

              </Button>

              <Button

                variant="outlined"

                disabled={!selectedVersion}

                onClick={() => selectedVersion && openVersionModalHandler('edit')}

              >

                Editar versión

              </Button>

            </Stack>

          </Grid>

        )}

        <Grid item xs={12} md={3} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>

          <Button variant="outlined" disabled={!pendingCount} onClick={discardBatch}>Descartar cambios</Button>

          <Button variant="contained" disabled={!pendingCount || loading} onClick={saveBatch}>

            Guardar cambios {pendingCount ? `(${pendingCount})` : ''}

          </Button>

        </Grid>

      </Grid>



      {planId && typeof versionId !== 'number' && (

        <Alert severity="info" sx={{ mb: 2 }}>

          Todavía no hay una versión de correlatividades definida para este plan. Creá una para comenzar a editar.

        </Alert>

      )}



      {selectedVersion && (

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mb={2}>

          <Chip color="primary" label={`Cohortes ${versionRangeLabel(selectedVersion)}`} />

          {selectedVersion.vigencia_desde && (

            <Chip

              label={`Vigencia ${selectedVersion.vigencia_desde}${selectedVersion.vigencia_hasta ? ` al ${selectedVersion.vigencia_hasta}` : ''}`}

            />

          )}

          <Chip

            label={selectedVersion.activo ? 'Activa' : 'Inactiva'}

            color={selectedVersion.activo ? 'success' : 'default'}

          />

          <Chip label={`${selectedVersion.correlatividades} correlatividades`} />

        </Stack>

      )}





      <TableContainer sx={{ maxHeight: 520 }}>

        <Table stickyHeader size="small">

          <TableHead>

            <TableRow>

              <TableCell>ID</TableCell>

              <TableCell sortDirection={sortBy==='nombre' ? sortDir : false as any}>

                <TableSortLabel active={sortBy==='nombre'} direction={sortBy==='nombre'?sortDir:'asc'} onClick={() => { setSortBy('nombre'); setSortDir(d=> (sortBy!=='nombre' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>

                  Materia

                </TableSortLabel>

              </TableCell>

              <TableCell sortDirection={sortBy==='anio' ? sortDir : false as any}>

                <TableSortLabel active={sortBy==='anio'} direction={sortBy==='anio'?sortDir:'asc'} onClick={() => { setSortBy('anio'); setSortDir(d=> (sortBy!=='anio' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>

                  Año

                </TableSortLabel>

              </TableCell>

              <TableCell sortDirection={sortBy==='regimen' ? sortDir : false as any}>

                <TableSortLabel active={sortBy==='regimen'} direction={sortBy==='regimen'?sortDir:'asc'} onClick={() => { setSortBy('regimen'); setSortDir(d=> (sortBy!=='regimen' ? 'asc' : (d==='asc'?'desc':'asc')) as any); }}>

                Régimen

                </TableSortLabel>

              </TableCell>

              <TableCell>Formato</TableCell>

              <TableCell>Para cursar: Regular</TableCell>

              <TableCell>Para cursar: Aprobada</TableCell>

              <TableCell>Para rendir: Aprobada</TableCell>

              <TableCell>Acciones</TableCell>

            </TableRow>

          </TableHead>

          <TableBody>

            {loading ? (

              <TableRow><TableCell colSpan={8}><Box display="flex" justifyContent="center" py={3}><CircularProgress size={22} /></Box></TableCell></TableRow>

            ) : (

              [...matrix]

                .filter(r => !filter || r.nombre.toLowerCase().includes(filter.toLowerCase()))

                .sort((a,b) => {

                  const dir = sortDir==='asc' ? 1 : -1;

                  if (sortBy==='nombre') return a.nombre.localeCompare(b.nombre) * dir;

                  if (sortBy==='anio') return (a.anio_cursada - b.anio_cursada) * dir;

                  if (sortBy==='regimen') return (a.regimen || '').localeCompare(b.regimen || '') * dir;

                  return 0;

                })

                .map((r) => (

                <TableRow key={r.id} hover sx={pending[r.id] ? { backgroundColor: 'rgba(250, 204, 21, 0.08)' } : undefined}>

                  <TableCell>{r.id}</TableCell>

                  <TableCell>

                    {r.nombre}

                    {pending[r.id] && <Chip size="small" color="warning" label="Pendiente" sx={{ ml: 1 }} />}

                  </TableCell>

                  <TableCell>{r.anio_cursada}</TableCell>

                  <TableCell>{r.regimen}</TableCell>

                  <TableCell>{r.formato}</TableCell>

                  <TableCell>{r.regular_para_cursar?.length ? r.regular_para_cursar.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>

                  <TableCell>{r.aprobada_para_cursar?.length ? r.aprobada_para_cursar.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>

                  <TableCell>{r.aprobada_para_rendir?.length ? r.aprobada_para_rendir.map(id => matrix.find(m=>m.id===id)?.nombre || id).join(', ') : <em>Ninguna</em>}</TableCell>

                  <TableCell><Button size="small" onClick={() => openEditor(r)}>Editar</Button></TableCell>

                </TableRow>

              ))

            )}

          </TableBody>

        </Table>

      </TableContainer>



      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>

        <DialogTitle>Editar correlatividades — {rowEdit?.nombre}</DialogTitle>

        <DialogContent>

          <Stack gap={2} sx={{ mt: 1 }}>

            <Autocomplete

              multiple options={materiaOptions}

              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.regular_para_cursar.includes(o.id))}

              onChange={handleFieldChange('regular_para_cursar')}

              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}

              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Regular" />}

            />

            <Autocomplete

              multiple options={materiaOptions}

              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_cursar.includes(o.id))}

              onChange={handleFieldChange('aprobada_para_cursar')}

              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}

              renderInput={(p) => <TextField {...p} size="small" label="Para cursar: Aprobada" />}

            />

            <Autocomplete

              multiple options={materiaOptions}

              value={materiaOptions.filter(o => typeof o.id === 'number' && editSet.aprobada_para_rendir.includes(o.id))}

              onChange={handleFieldChange('aprobada_para_rendir')}

              getOptionDisabled={(o) => !!rowEdit && (o.id === rowEdit.id || o.anio_cursada > rowEdit.anio_cursada)}

              renderInput={(p) => <TextField {...p} size="small" label="Para rendir: Aprobada" />}

            />

            <Typography variant="body2" color="text.secondary">Sugerencia: si no hay restricciones para una columna, dejala vacía (equivale a “Ninguna”).</Typography>

          </Stack>

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setOpen(false)}>Cancelar</Button>

          <Button variant="contained" onClick={saveEditor}>Guardar</Button>

        </DialogActions>

      </Dialog>


      <Dialog open={versionModalOpen} onClose={() => setVersionModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {versionModalMode === 'edit'
            ? 'Editar versión de correlatividades'
            : versionModalMode === 'duplicate'
              ? 'Duplicar versión'
              : 'Nueva versión de correlatividades'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={versionForm.nombre}
              onChange={handleVersionFieldChange('nombre')}
              fullWidth
            />
            <TextField
              label="Descripción (opcional)"
              value={versionForm.descripcion}
              onChange={handleVersionFieldChange('descripcion')}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Cohorte desde"
                type="number"
                fullWidth
                value={versionForm.cohorteDesde}
                onChange={handleVersionFieldChange('cohorteDesde')}
              />
              <TextField
                label="Cohorte hasta"
                type="number"
                fullWidth
                value={versionForm.cohorteHasta}
                onChange={handleVersionFieldChange('cohorteHasta')}
                helperText="Dejar vacío para aplicar en adelante"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Vigencia desde"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={versionForm.vigenciaDesde}
                onChange={handleVersionFieldChange('vigenciaDesde')}
              />
              <TextField
                label="Vigencia hasta"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={versionForm.vigenciaHasta}
                onChange={handleVersionFieldChange('vigenciaHasta')}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={versionForm.activo}
                  onChange={(e) => setVersionForm((prev) => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label="Versión activa"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionModalOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={submitVersionForm}>
            {versionModalMode === 'edit' ? 'Guardar cambios' : 'Guardar versión'}
          </Button>
        </DialogActions>
      </Dialog>

    </div>

  );

}