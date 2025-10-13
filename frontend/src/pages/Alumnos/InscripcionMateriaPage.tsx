import React from 'react';
import { Box, Typography, Grid, Paper, ButtonBase, Chip, Tooltip, Stack, Alert, Skeleton, TextField } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { solicitarInscripcionMateria, obtenerMateriasPlanAlumno, obtenerHistorialAlumno, obtenerVentanaMaterias, MateriaPlanDTO, HistorialAlumnoDTO } from '@/api/alumnos';
import { useAuth } from '@/context/AuthContext';

type Horario = { dia: string; desde: string; hasta: string };
type Materia = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: 'ANUAL' | '1C' | '2C';
  horarios: Horario[];
  correlativasRegular: number[];
  correlativasAprob: number[];
  profesorado?: string;
};

function mapMateria(dto: MateriaPlanDTO): Materia {
  return {
    id: dto.id,
    nombre: dto.nombre,
    anio: dto.anio,
    cuatrimestre: dto.cuatrimestre,
    horarios: dto.horarios,
    correlativasRegular: dto.correlativas_regular || [],
    correlativasAprob: dto.correlativas_aprob || [],
    profesorado: dto.profesorado,
  };
}

function useMateriasPlan() {
  return useQuery<Materia[]>({
    queryKey: ['materias-plan'],
    queryFn: async () => {
      const data = await obtenerMateriasPlanAlumno();
      return data.map(mapMateria);
    },
  });
}

function useHistorialAlumno() {
  return useQuery({
    queryKey: ['historial-alumno'],
    queryFn: async () => {
      const d: HistorialAlumnoDTO = await obtenerHistorialAlumno();
      return {
        aprobadas: d.aprobadas || [],
        regularizadas: d.regularizadas || [],
        inscriptasActuales: d.inscriptas_actuales || [],
      };
    },
  });
}

function useVentanaMaterias() {
  return useQuery({
    queryKey: ['ventana-materias'],
    queryFn: obtenerVentanaMaterias,
  });
}

function hayChoque(a: Horario[], b: Horario[]) {
  const toMin = (t: string) => parseInt(t.slice(0,2))*60 + parseInt(t.slice(3));
  for (const ha of a) {
    for (const hb of b) {
      if (ha.dia !== hb.dia) continue;
      const a1 = toMin(ha.desde), a2 = toMin(ha.hasta);
      const b1 = toMin(hb.desde), b2 = toMin(hb.hasta);
      if (Math.max(a1,b1) < Math.min(a2,b2)) return true;
    }
  }
  return false;
}

type Status = 'aprobada' | 'habilitada' | 'bloqueada';

const InscripcionMateriaPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles || []).some((r: string)=> ['admin','secretaria','bedel'].includes((r||'').toLowerCase())));
  const [dniFiltro, setDniFiltro] = React.useState<string>('');
  const materiasQ = useQuery<Materia[]>({
    queryKey: ['materias-plan', dniFiltro],
    queryFn: async ()=> (await obtenerMateriasPlanAlumno(dniFiltro ? { dni: dniFiltro } : undefined)).map(mapMateria),
  });
  const histQ = useQuery({
    queryKey: ['historial-alumno', dniFiltro],
    queryFn: async ()=> {
      const d: HistorialAlumnoDTO = await obtenerHistorialAlumno(dniFiltro ? { dni: dniFiltro } : undefined);
      return {
        aprobadas: d.aprobadas || [],
        regularizadas: d.regularizadas || [],
        inscriptasActuales: d.inscriptas_actuales || [],
      };
    }
  });
  const ventanaQ = useVentanaMaterias();
  const [seleccionadas, setSeleccionadas] = React.useState<number[]>([]);
  const [info, setInfo] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const mInscribir = useMutation({
    mutationFn: (materia_id: number) => solicitarInscripcionMateria({ materia_id }),
    onSuccess: (res) => { setInfo(res.message || 'Inscripto correctamente'); setErr(null); qc.invalidateQueries(); },
    onError: (e: any) => { setErr(e?.response?.data?.message || 'No se pudo inscribir'); setInfo(null); },
  });

  if (materiasQ.isLoading || histQ.isLoading || ventanaQ.isLoading) return <Skeleton variant="rectangular" height={120} />;
  if (materiasQ.isError || histQ.isError || ventanaQ.isError || !materiasQ.data || !histQ.data) return <Alert severity="error">No se pudieron cargar los datos.</Alert>;

  const historial = histQ.data;
  const yaInscriptas = new Set(historial.inscriptasActuales.concat(seleccionadas));

  const periodo = (ventanaQ.data?.periodo ?? '1C_ANUALES') as '1C_ANUALES'|'2C';
  const esPeriodoHabilitado = (m: Materia) => periodo === '1C_ANUALES' ? (m.cuatrimestre === 'ANUAL' || m.cuatrimestre === '1C') : (m.cuatrimestre === '2C');

  const evalMateria = (m: Materia): { status: Status; motivo?: string } => {
    if (!esPeriodoHabilitado(m)) return { status: 'bloqueada', motivo: 'No habilitada en este período' };
    if (historial.aprobadas.includes(m.id)) return { status: 'aprobada' };
    const faltaReg = m.correlativasRegular.filter(id => !historial.regularizadas.includes(id));
    const faltaApr = m.correlativasAprob.filter(id => !historial.aprobadas.includes(id));
    if (faltaReg.length || faltaApr.length) {
      const motivos: string[] = [];
      if (faltaReg.length) motivos.push('Requiere correlativas regularizadas');
      if (faltaApr.length) motivos.push('Requiere correlativas aprobadas');
      return { status: 'bloqueada', motivo: motivos.join(' y ') };
    }
    if (yaInscriptas.has(m.id)) return { status: 'bloqueada', motivo: 'Ya está inscripto/a' };
    const selMaterias = materiasQ.data.filter(x => seleccionadas.includes(x.id));
    for (const s of selMaterias) {
      if (hayChoque(m.horarios, s.horarios)) return { status: 'bloqueada', motivo: `Superposición horaria con ${s.nombre}` };
    }
    return { status: 'habilitada' };
  };

  const porAnio = materiasQ.data.reduce<Record<number, Materia[]>>((acc, m) => {
    acc[m.anio] = acc[m.anio] || [];
    acc[m.anio].push(m);
    return acc;
  }, {});
  const hayMaterias = Object.values(porAnio).some(list => list.length > 0);

  const Card = ({ m }: { m: Materia }) => {
    const { status, motivo } = evalMateria(m);
    const colors: Record<Status, string> = { aprobada: '#e8f5e9', habilitada: '#e3f2fd', bloqueada: '#f5f5f5' };
    const label: Record<Status, string> = { aprobada: 'Aprobada', habilitada: 'Habilitada', bloqueada: motivo || 'No habilitada' };
    const clickable = status === 'habilitada';
    const onClick = () => {
      if (!clickable) return;
      setSeleccionadas((prev) => prev.includes(m.id) ? prev : [...prev, m.id]);
      mInscribir.mutate(m.id);
    };
    const content = (
      <Paper sx={{ p:2, borderRadius:2, bgcolor: colors[status], border: '1px solid', borderColor: 'divider', height: '100%' }}>
        <Stack gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>{m.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">{m.horarios.map(h => `${h.dia} ${h.desde}-${h.hasta}`).join(' • ')}</Typography>
          <Box>
            <Chip size="small" label={label[status]} color={status==='habilitada' ? 'primary' : status==='aprobada' ? 'success' : 'default'} />
          </Box>
        </Stack>
      </Paper>
    );
    return clickable ? (
      <ButtonBase onClick={onClick} sx={{ width:'100%', textAlign:'left' }}>{content}</ButtonBase>
    ) : (
      <Tooltip title={status==='bloqueada' ? label['bloqueada'] : ''}>{content}</Tooltip>
    );
  };

  const profesoradoNombre = materiasQ.data.find(m => m.profesorado)?.profesorado || 'Profesorado';
  const periodoHabilitado = ventanaQ.data?.periodo === '2C' ? '2° Cuatrimestre' : '1° Cuatrimestre + Anuales';
  const fechaDesde = ventanaQ.data?.desde;
  const fechaHasta = ventanaQ.data?.hasta;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Inscripción a Materias</Typography>
      {canGestionar && (
        <Stack direction={{ xs:'column', sm:'row' }} gap={1} alignItems={{ xs:'stretch', sm:'center' }} sx={{ mt: .5, mb: 1 }}>
          <TextField label="DNI del estudiante" size="small" value={dniFiltro} onChange={(e)=>setDniFiltro(e.target.value)} sx={{ maxWidth: 260 }} />
          <Typography variant="caption" color="text.secondary">Bedel/Secretaría/Admin: buscar por DNI para gestionar en nombre del alumno</Typography>
        </Stack>
      )}
      <Typography variant="body2" color="text.secondary">
        {profesoradoNombre} • {periodoHabilitado}
        {fechaDesde && fechaHasta ? ` • ${new Date(fechaDesde).toLocaleDateString()} – ${new Date(fechaHasta).toLocaleDateString()}` : ''}
      </Typography>

      {info && <Alert severity="success" sx={{ mt:2 }}>{info}</Alert>}
      {err && <Alert severity="error" sx={{ mt:2 }}>{err}</Alert>}

      {!hayMaterias && (
        <Alert severity="info" sx={{ mt:2 }}>
          No se encontraron materias para tu plan o período habilitado. Si estás logueado como administrador, este módulo necesita un alumno con plan asignado o pasar <code>plan_id</code>/<code>profesorado_id</code> al endpoint.
        </Alert>
      )}

      <Stack gap={3} sx={{ mt: 2 }}>
        {Object.keys(porAnio).sort((a,b)=>Number(a)-Number(b)).map((anioKey) => (
          <Box key={anioKey}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Año {anioKey}</Typography>
            <Grid container spacing={1.5} justifyContent="flex-start" alignItems="stretch">
              {porAnio[Number(anioKey)].map((m) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={m.id}>
                  <Card m={m} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default InscripcionMateriaPage;
