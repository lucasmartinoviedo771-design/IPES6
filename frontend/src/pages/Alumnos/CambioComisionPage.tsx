import React from 'react';
import { Box, Typography, Grid, Paper, Stack, Alert, Button, Collapse, TextField, CircularProgress } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { solicitarCambioComision, obtenerMateriasPlanAlumno, obtenerHistorialAlumno, MateriaPlanDTO, obtenerEquivalencias, EquivalenciaItemDTO } from '@/api/alumnos';
import { fetchCarreras } from '@/api/carreras';
import { useAuth } from '@/context/AuthContext';

type Horario = { dia: string; desde: string; hasta: string };
type Materia = { id:number; nombre:string; anio:number; cuatrimestre:'ANUAL'|'1C'|'2C'; horarios:Horario[]; profesorado?:string };

const toMin = (t:string)=> parseInt(t.slice(0,2))*60 + parseInt(t.slice(3));
const hayChoque = (a:Horario[], b:Horario[]) => a.some(ha => b.some(hb => ha.dia===hb.dia && Math.max(toMin(ha.desde),toMin(hb.desde)) < Math.min(toMin(ha.hasta),toMin(hb.hasta))));

function mapMateria(dto: MateriaPlanDTO): Materia {
  return { id:dto.id, nombre:dto.nombre, anio:dto.anio, cuatrimestre:dto.cuatrimestre, horarios:dto.horarios, profesorado:dto.profesorado };
}

const CambioComisionPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user:null }) as any;
  const canGestionar = !!user && (user.is_staff || (user.roles||[]).some((r:string)=> ['admin','secretaria','bedel'].includes((r||'').toLowerCase())));
  const [dniFiltro, setDniFiltro] = React.useState<string>('');
  const [debouncedDni, setDebouncedDni] = React.useState(dniFiltro);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDni(dniFiltro);
    }, 500); // 500ms de delay

    return () => {
      clearTimeout(handler);
    };
  }, [dniFiltro]);

  const materiasQ = useQuery<Materia[]>({
    queryKey: ['cc-materias', debouncedDni],
    queryFn: async () => (await obtenerMateriasPlanAlumno(debouncedDni ? { dni: debouncedDni } : undefined)).map(mapMateria),
  });
  const histQ = useQuery({
    queryKey: ['cc-historial', debouncedDni],
    queryFn: async () => obtenerHistorialAlumno(debouncedDni ? { dni: debouncedDni } : undefined),
  });
  const carrerasQ = useQuery({ queryKey: ['cc-carreras'], queryFn: fetchCarreras });

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggle = (key:string)=> setExpanded(p=>({...p, [key]: !p[key]}));

  const mSolicitar = useMutation({
    mutationFn: ({ actualId, nuevaId }: { actualId:number; nuevaId:number }) => solicitarCambioComision({ comision_actual_id: actualId, comision_nueva_id: nuevaId }),
  });

  const loading = materiasQ.isLoading || histQ.isLoading || carrerasQ.isLoading;
  if (loading) return <Box p={3}><CircularProgress /></Box>;
  if (materiasQ.isError || histQ.isError) return <Alert severity="error">No se pudieron cargar datos del alumno.</Alert>;

  const materias = materiasQ.data || [];
  const profesoradoActual = materias.find(m=>m.profesorado)?.profesorado || 'Profesorado';

  // Detectar superposiciones entre materias actuales (habilitables)
  const conflictos: Array<{ a:Materia; b:Materia }> = [];
  for (let i=0;i<materias.length;i++){
    for (let j=i+1;j<materias.length;j++){
      const mi = materias[i], mj = materias[j];
      if (mi.horarios.length && mj.horarios.length && hayChoque(mi.horarios, mj.horarios)) conflictos.push({ a:mi, b:mj });
    }
  }

  // Generar sugerencias: buscar misma materia por nombre en otros profesorados y que no choque con la contraparte
  async function cargarAlternativas(nombreMateria:string, contra:Materia){
    const eq: EquivalenciaItemDTO[] = await obtenerEquivalencias(contra.id);
    // Filtrar por nombre equivalente también (en caso de fallback por nombre en backend)
    const normalizados = eq.filter(e => e.materia_nombre.toLowerCase() === nombreMateria.toLowerCase());
    const alternativas = (normalizados.length? normalizados : eq)
      .map(e => ({ profesorado: e.profesorado, materia: { id:e.materia_id, nombre:e.materia_nombre, anio:contra.anio, cuatrimestre:contra.cuatrimestre, horarios:e.horarios, profesorado:e.profesorado } as Materia }))
      .filter(alt => !hayChoque(alt.materia.horarios, contra.horarios));
    return alternativas;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Cambio de Comisión</Typography>
      <Typography variant="body2" color="text.secondary">Solicita un cambio de comisión cuando exista superposición horaria entre espacios habilitados. El tutor autoriza el cambio.</Typography>
      {canGestionar && (
        <Stack direction={{ xs:'column', sm:'row' }} gap={1} alignItems={{ xs:'stretch', sm:'center' }} sx={{ mt: 2, mb: 1 }}>
          <TextField label="DNI del estudiante" size="small" value={dniFiltro} onChange={(e)=>setDniFiltro(e.target.value)} sx={{ maxWidth: 260 }} />
        </Stack>
      )}

      {conflictos.length === 0 && (
        <Alert severity="info" sx={{ mt:2 }}>No se encontraron espacios curriculares con superposición que permitan solicitar comisión a otro profesorado.</Alert>
      )}

      <Stack gap={2} sx={{ mt:2 }}>
        {conflictos.map(({a,b}, idx)=>{
          const clave = `${a.id}-${b.id}`;
          return (
            <Paper key={clave} sx={{ p:2 }}>
              <Stack gap={1}>
                <Typography variant="subtitle1" fontWeight={700}>Conflicto #{idx+1}</Typography>
                <Typography variant="body2">{a.nombre} ({a.horarios.map(h=>`${h.dia} ${h.desde}-${h.hasta}`).join(' • ')}) ↔ {b.nombre} ({b.horarios.map(h=>`${h.dia} ${h.desde}-${h.hasta}`).join(' • ')})</Typography>
                <Button size="small" onClick={()=>toggle(clave)}>{expanded[clave]? 'Ocultar' : 'Ver alternativas'}</Button>
                <Collapse in={!!expanded[clave]}>
                  <Alternativas nombre={a.nombre} contra={b} cargar={cargarAlternativas} onSolicitar={(nuevaId)=> mSolicitar.mutate({ actualId: a.id, nuevaId })} />
                  <Alternativas nombre={b.nombre} contra={a} cargar={cargarAlternativas} onSolicitar={(nuevaId)=> mSolicitar.mutate({ actualId: b.id, nuevaId })} />
                </Collapse>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

function Alternativas({ nombre, contra, cargar, onSolicitar }:{ nombre:string; contra:Materia; cargar:(n:string,c:Materia)=>Promise<any[]>; onSolicitar:(nuevaId:number)=>void }){
  const [items, setItems] = React.useState<any[]|null>(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(()=>{ let alive=true; setLoading(true); cargar(nombre, contra).then(res=>{ if(alive){ setItems(res); setLoading(false); } }); return ()=>{ alive=false; }; }, [nombre, contra.id]);
  return (
    <Box sx={{ mt:1, pl:1 }}>
      <Typography variant="subtitle2">Alternativas para {nombre} en otros profesorados</Typography>
      {loading && <CircularProgress size={18} sx={{ ml:1 }} />}
      {!loading && (!items || items.length===0) && (
        <Typography variant="body2" color="text.secondary">Sin alternativas que eviten superposición.</Typography>
      )}
      <Grid container spacing={1} sx={{ mt: .5 }}>
        {(items||[]).map((alt, i)=> (
          <Grid item xs={12} md={6} lg={4} key={i}>
            <Paper variant="outlined" sx={{ p:1.5 }}>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">{alt.profesorado}</Typography>
                <Typography variant="body2">{alt.materia.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">{alt.materia.horarios.map((h:Horario)=>`${h.dia} ${h.desde}-${h.hasta}`).join(' • ')}</Typography>
                <Button size="small" variant="contained" onClick={()=>onSolicitar(alt.materia.id)}>Solicitar cambio</Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default CambioComisionPage;
