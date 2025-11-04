import React, { useEffect, useMemo, useState } from 'react';
import { client as axios } from '@/api/client';
import { fetchVentanas, VentanaDto } from '@/api/ventanas';
import { useSnackbar } from 'notistack';
import { Box, Button, Card, CardContent, CardHeader, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem, Select, Switch, TextField, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type Ventana = VentanaDto;

const LABEL_PERIODO: Record<'1C_ANUALES' | '2C', string> = {
  '1C_ANUALES': '1º Cuatrimestre + Anuales',
  '2C': '2º Cuatrimestre',
};

const TIPOS: { key: string; label: string }[] = [
  { key: 'MESAS_FINALES', label: 'Mesas de examen - Finales' },
  { key: 'MESAS_EXTRA', label: 'Mesas de examen - Extraordinarias' },
  { key: 'MESAS_LIBRES', label: 'Mesas de examen - Libres' },
  { key: 'MATERIAS', label: 'Inscripciones a Materias' },
  { key: 'COMISION', label: 'Cambios de Comisión' },
  { key: 'ANALITICOS', label: 'Pedidos de Analíticos (placeholder)' },
  { key: 'PREINSCRIPCION', label: 'Preinscripción' },
];

export default function HabilitarFechasPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [ventanas, setVentanas] = useState<Record<string, Ventana[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editV, setEditV] = useState<Ventana | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Ventana>>({});

  const defaultDraft = (tipo: string): Ventana => ({
    tipo,
    activo: false,
    desde: dayjs().format('YYYY-MM-DD'),
    hasta: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    periodo: '1C_ANUALES',
  });

  const load = async () => {
    try {
      const data = await fetchVentanas();
      const map: Record<string, Ventana[]> = {};
      data.forEach(v => { (map[v.tipo] ||= []).push(v); });
      Object.keys(map).forEach(k => map[k].sort((a,b)=> a.desde < b.desde ? 1 : -1));
      setVentanas(map);
    } catch {
      setVentanas({});
    }
  };

  useEffect(() => { load(); }, []);

  const upsert = async (v: Ventana) => {
    setSaving(s => ({ ...s, [v.tipo]: true }));
    try {
      const payload = { ...v };
      if (v.id) {
        await axios.put(`/ventanas/${v.id}`, payload);
      } else {
        await axios.post(`/ventanas`, payload);
      }
    } finally {
      setSaving(s => ({ ...s, [v.tipo]: false }));
      load();
    }
  };

  const openEdit = (v: Ventana) => { setEditV({ ...v }); setEditOpen(true); };
  const closeEdit = () => { setEditOpen(false); setEditV(null); };
  const saveEdit = async () => {
    if (!editV || !editV.id) return;
    await axios.put(`/ventanas/${editV.id}`, editV);
    closeEdit();
    load();
  };
  const deleteVentana = async (id?: number) => {
    if (!id) return;
    await axios.delete(`/ventanas/${id}`);
    closeEdit();
    load();
  };

  const card = (t: { key: string; label: string }) => {
    const list = ventanas[t.key] ?? [];
    const baseDraft =
      drafts[t.key] ??
      (() => {
        const activo = list.find((x) => x.activo);
        return activo ? { ...activo } : defaultDraft(t.key);
      })();
    const setLocal = (patch: Partial<Ventana>) =>
      setDrafts((prev) => {
        let draftBase: Ventana = baseDraft;
        if (patch.periodo && t.key === 'MATERIAS') {
          const candidato = list.find((item) => item.periodo === patch.periodo);
          if (candidato) {
            draftBase = { ...candidato };
          } else {
            draftBase = {
              ...draftBase,
              id: undefined,
              activo: false,
              periodo: patch.periodo,
            };
          }
        }
        return {
          ...prev,
          [t.key]: { ...draftBase, ...patch, tipo: t.key },
        };
      });
    const resetDraft = () =>
      setDrafts((prev) => ({
        ...prev,
        [t.key]: defaultDraft(t.key),
      }));
    const v = baseDraft;
    const today = dayjs();
    const enRango = (x: Ventana) => dayjs(x.desde).isSameOrBefore(today, 'day') && dayjs(x.hasta).isSameOrAfter(today, 'day');
    const estado = (x: Ventana) => enRango(x) ? 'En rango' : (dayjs(x.desde).isAfter(today) ? 'Pendiente' : 'Pasada');

    const displayList = list
      .filter(x => x.activo || dayjs(x.hasta).isSameOrAfter(today, 'day'))
      .sort((a, b) => {
        if (a.activo && !b.activo) return -1;
        if (!a.activo && b.activo) return 1;
        return dayjs(a.desde).diff(dayjs(b.desde));
      })
      .slice(0, 3);

    return (
      <Grid item xs={12} md={6} key={t.key}>
        <Card variant="outlined">
          <CardHeader title={t.label} action={
            <FormControlLabel
              control={<Switch checked={!!v.activo} onChange={(e)=>setLocal({ activo: e.target.checked })} />}
              label={
                v.activo
                  ? `Habilitado (${LABEL_PERIODO[(v.periodo ?? '1C_ANUALES') as '1C_ANUALES' | '2C']})`
                  : 'Deshabilitado'
              }
            />
          }/>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField type="date" label="Desde" InputLabelProps={{ shrink: true }} fullWidth size="small" value={v.desde} onChange={(e)=>setLocal({ desde: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField type="date" label="Hasta" InputLabelProps={{ shrink: true }} fullWidth size="small" value={v.hasta} onChange={(e)=>setLocal({ hasta: e.target.value })} />
              </Grid>
              {t.key === 'MATERIAS' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`periodo-${t.key}`}>Período habilitado</InputLabel>
                    <Select labelId={`periodo-${t.key}`} label="Período habilitado" value={v.periodo ?? '1C_ANUALES'} onChange={(e)=>setLocal({ periodo: e.target.value as any })}>
                      <MenuItem value="1C_ANUALES">1° Cuatrimestre + Anuales</MenuItem>
                      <MenuItem value="2C">2° Cuatrimestre</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
                <Grid item xs={12} display="flex" gap={1}>
                  <Button variant="outlined" onClick={resetDraft}>
                    Nuevo periodo
                  </Button>
                  <Button variant="contained" disabled={!!saving[t.key]} onClick={()=>upsert(v)}>
                    {saving[t.key] ? 'Guardando...' : 'Guardar'}
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Histórico</Typography>
                {
                  Array(3).fill(null).map((_, index) => {
                    const x = displayList[index];
                    return x ? (
                      <Box key={(x.id ?? 0) + x.desde + x.hasta} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: .5 }}>
                        <span>{dayjs(x.desde).format('DD/MM/YYYY')} → {dayjs(x.hasta).format('DD/MM/YYYY')}</span>
                        <Chip size="small" label={x.activo ? 'Habilitado' : 'Deshabilitado'} color={x.activo ? 'success' : 'default'} variant={x.activo ? 'filled' : 'outlined'} />
                        <Chip size="small" label={estado(x)} color={estado(x)==='En rango' ? 'info' : estado(x)==='Pendiente' ? 'warning' : 'default'} variant={estado(x)==='Pasada' ? 'outlined' : 'filled'} />
                        {t.key === 'MATERIAS' && (
                          <Chip
                            size="small"
                            label={LABEL_PERIODO[(x.periodo ?? '1C_ANUALES') as '1C_ANUALES' | '2C']}
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        <span style={{ flex: 1 }} />
                        <Tooltip title="Editar"><IconButton size="small" onClick={() => openEdit(x)}><EditIcon fontSize="small"/></IconButton></Tooltip>
                       <Tooltip title="Eliminar"><IconButton color="error" size="small" onClick={() => deleteVentana(x.id)}><DeleteForeverIcon fontSize="small"/></IconButton></Tooltip>
                      </Box>
                    ) : (
                      <Box key={`placeholder-${index}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: .5, height: '34px' }}>
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      </Box>
                    );
                  })
                }
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  return (
    <div className="center-page">
      <h1 className="text-3xl font-extrabold mb-1">Habilitar Fechas</h1>
      <p className="text-gray-600 mb-6">Definí periodos (desde/hasta) para inscripciones y trámites.</p>
      <Grid container spacing={2}>
        {TIPOS.map(card)}
      </Grid>
      <Dialog open={editOpen} onClose={closeEdit} maxWidth="xs" fullWidth>
        <DialogTitle>Editar ventana</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: .5 }}>
            <Grid item xs={12}>
              <TextField label="Tipo" fullWidth size="small" value={editV?.tipo ?? ''} onChange={(e)=>setEditV(v=> v?{...v, tipo: e.target.value}:v)} />
            </Grid>
            <Grid item xs={12}>
              <TextField type="date" label="Desde" InputLabelProps={{ shrink: true }} fullWidth size="small" value={editV?.desde ?? ''} onChange={(e)=>setEditV(v=> v?{...v, desde: e.target.value}:v)} />
            </Grid>
            <Grid item xs={12}>
              <TextField type="date" label="Hasta" InputLabelProps={{ shrink: true }} fullWidth size="small" value={editV?.hasta ?? ''} onChange={(e)=>setEditV(v=> v?{...v, hasta: e.target.value}:v)} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={!!editV?.activo} onChange={(e)=>setEditV(v=> v?{...v, activo: e.target.checked}:v)} />} label={editV?.activo ? 'Habilitado' : 'Deshabilitado'} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancelar</Button>
          <Button color="error" onClick={()=>deleteVentana(editV?.id)}>Eliminar</Button>
          <Button variant="contained" onClick={saveEdit}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
