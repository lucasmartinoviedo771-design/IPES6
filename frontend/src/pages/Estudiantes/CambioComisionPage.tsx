import React from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import BackButton from '@/components/ui/BackButton';
import FinalConfirmationDialog from '@/components/ui/FinalConfirmationDialog';
import {
  solicitarInscripcionMateria,
  obtenerMateriasPlanEstudiante,
  obtenerMateriasInscriptas,
  obtenerEquivalencias,
  obtenerHistorialEstudiante,
  obtenerVentanaMaterias,
  MateriaPlanDTO,
  MateriaInscriptaItemDTO,
  ComisionResumenDTO,
  EquivalenciaItemDTO,
  HorarioDTO,
  HistorialEstudianteDTO,
  VentanaInscripcion,
} from '@/api/estudiantes';
import { useAuth } from '@/context/AuthContext';
import { hasAnyRole, isOnlyEstudiante } from '@/utils/roles';

type Horario = HorarioDTO;
type Cuatrimestre = MateriaPlanDTO['cuatrimestre'];

type Materia = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: Cuatrimestre;
  horarios: Horario[];
  correlativasRegular: number[];
  correlativasAprob: number[];
  profesorado?: string;
};

type InscripcionConHorario = {
  inscripcion: MateriaInscriptaItemDTO;
  comision: ComisionResumenDTO;
  horarios: Horario[];
  cuatrimestre: Cuatrimestre;
};

type MateriaBloqueada = {
  materia: Materia;
  horarios: Horario[];
  cuatrimestre: Cuatrimestre;
  conflictos: InscripcionConHorario[];
};

type AlternativaItem = {
  comision: ComisionResumenDTO;
  horarios: Horario[];
  profesorado: string;
};

const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);

const hayChoque = (a: Horario[], b: Horario[]) =>
  a.some((ha) =>
    b.some(
      (hb) =>
        ha.dia === hb.dia &&
        Math.max(toMin(ha.desde), toMin(hb.desde)) < Math.min(toMin(ha.hasta), toMin(hb.hasta)),
    ),
  );

const cuatrimestreCompatible = (a: Cuatrimestre, b: Cuatrimestre) => {
  if (a === 'ANUAL' || b === 'ANUAL') return true;
  return a === b;
};

const mismasEtapas = (objetivo: Cuatrimestre, candidato: Cuatrimestre) => {
  if (objetivo === 'ANUAL') return candidato === 'ANUAL';
  return objetivo === candidato;
};

const formatHorarios = (horarios: Horario[]) =>
  horarios.map((h) => `${h.dia} ${h.desde}-${h.hasta}`).join('  ');

const mensajeError = (error: unknown) => {
  const err = error as any;
  return err?.response?.data?.message || err?.message || 'No se pudo registrar la inscripción.';
};

const mapMateria = (dto: MateriaPlanDTO): Materia => ({
  id: dto.id,
  nombre: dto.nombre,
  anio: dto.anio,
  cuatrimestre: dto.cuatrimestre,
  horarios: dto.horarios ?? [],
  correlativasRegular: dto.correlativas_regular ?? [],
  correlativasAprob: dto.correlativas_aprob ?? [],
  profesorado: dto.profesorado ?? undefined,
});

const ventanaPermiteMateria = (ventana: VentanaInscripcion | null, materia: Materia) => {
  const periodoClave = ventana?.periodo;
  if (!periodoClave) return true;
  if (periodoClave === '1C_ANUALES') {
    return materia.cuatrimestre === 'ANUAL' || materia.cuatrimestre === '1C';
  }
  if (periodoClave === '2C') {
    return materia.cuatrimestre === '2C';
  }
  return true;
};

const defaultHistorial: HistorialEstudianteDTO = {
  aprobadas: [],
  regularizadas: [],
  inscriptas_actuales: [],
};

const CambioComisionPage: React.FC = () => {
  const { user } = (useAuth?.() ?? { user: null }) as any;
  const canGestionar = hasAnyRole(user, ['admin', 'secretaria', 'bedel']);

  const [dniFiltro, setDniFiltro] = React.useState<string>('');
  const [debouncedDni, setDebouncedDni] = React.useState(dniFiltro);
  const [info, setInfo] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedDni(dniFiltro), 500);
    return () => clearTimeout(handler);
  }, [dniFiltro]);

  const normalizedDni = debouncedDni.trim();

  React.useEffect(() => {
    setInfo(null);
    setErr(null);
  }, [normalizedDni]);

  const queryClient = useQueryClient();

  const isEstudiante = !canGestionar;
  const shouldFetch = isEstudiante || normalizedDni.length > 0;

  const materiasQ = useQuery({
    queryKey: ['cc-materias', normalizedDni],
    queryFn: async () => (await obtenerMateriasPlanEstudiante(normalizedDni ? { dni: normalizedDni } : undefined)).map(mapMateria),
    enabled: shouldFetch,
  });

  const historialQ = useQuery({
    queryKey: ['cc-historial', normalizedDni],
    queryFn: () => obtenerHistorialEstudiante(normalizedDni ? { dni: normalizedDni } : undefined),
    enabled: shouldFetch,
  });

  const ventanaQ = useQuery({
    queryKey: ['cc-ventana'],
    queryFn: obtenerVentanaMaterias,
  });

  const inscriptasQ = useQuery({
    queryKey: ['cc-inscriptas', normalizedDni],
    queryFn: () => obtenerMateriasInscriptas(normalizedDni ? { dni: normalizedDni } : undefined),
    enabled: shouldFetch,
  });

  const mSolicitar = useMutation({
    mutationFn: ({ materiaId, comisionId }: { materiaId: number; comisionId: number }) => {
      const payload: { materia_id: number; comision_id: number; dni?: string } = {
        materia_id: materiaId,
        comision_id: comisionId,
      };
      if (canGestionar && normalizedDni) {
        payload.dni = normalizedDni;
      }
      return solicitarInscripcionMateria(payload);
    },
    onSuccess: (res) => {
      setInfo(res?.message || 'Solicitud registrada.');
      setErr(null);
      setSolicitudPendiente(null);
      queryClient.invalidateQueries({ queryKey: ['cc-inscriptas', normalizedDni] });
      queryClient.invalidateQueries({ queryKey: ['cc-materias', normalizedDni] });
      queryClient.invalidateQueries({ queryKey: ['cc-historial', normalizedDni] });
    },
    onError: (error) => {
      setErr(mensajeError(error));
      setInfo(null);
      setSolicitudPendiente(null);
    },
  });

  const materias = materiasQ.data ?? [];
  const historial = historialQ.data ?? defaultHistorial;
  const ventana = ventanaQ.data ?? null;
  const inscripciones = inscriptasQ.data ?? [];

  const materiaById = React.useMemo(() => {
    const map = new Map<number, Materia>();
    materias.forEach((m) => map.set(m.id, m));
    return map;
  }, [materias]);

  const inscripcionesActivas = React.useMemo(
    () => inscripciones.filter((ins) => ins.estado === 'CONF' || ins.estado === 'PEND'),
    [inscripciones],
  );

  const resolveInscripcion = React.useCallback(
    (ins: MateriaInscriptaItemDTO): InscripcionConHorario | null => {
      const materiaRef = materiaById.get(ins.materia_id);
      const baseCuatrimestre: Cuatrimestre = materiaRef?.cuatrimestre ?? 'ANUAL';
      const baseHorarios = materiaRef?.horarios ?? [];
      const comision = ins.comision_actual ?? ins.comision_solicitada ?? null;
      const horarios = comision?.horarios?.length ? comision.horarios : baseHorarios;
      if (!horarios.length) {
        return null;
      }
      const resolvedComision: ComisionResumenDTO =
        comision ??
        ({
          id: -ins.inscripcion_id,
          codigo: 'Sin comision asignada',
          anio_lectivo: ins.anio_academico,
          turno_id: 0,
          turno: 'Turno no asignado',
          materia_id: ins.materia_id,
          materia_nombre: ins.materia_nombre,
          plan_id: null,
          profesorado_id: null,
          profesorado_nombre: materiaRef?.profesorado ?? null,
          docente: null,
          cupo_maximo: null,
          estado: ins.estado,
          horarios,
        } as ComisionResumenDTO);
      return {
        inscripcion: ins,
        comision: resolvedComision,
        horarios,
        cuatrimestre: baseCuatrimestre,
      };
    },
    [materiaById],
  );

  const inscripcionesConHorario = React.useMemo(
    () =>
      inscripcionesActivas
        .map((ins) => resolveInscripcion(ins))
        .filter((item): item is InscripcionConHorario => Boolean(item)),
    [inscripcionesActivas, resolveInscripcion],
  );

  const materiasConChoque = React.useMemo(() => {
    if (!shouldFetch) {
      return [] as MateriaBloqueada[];
    }
    const aprobadas = new Set(historial.aprobadas ?? []);
    const regularizadas = new Set(historial.regularizadas ?? []);
    const inscriptas = new Set(inscripcionesActivas.map((ins) => ins.materia_id));
    const ventanaActual = ventana ?? null;

    const resultado: MateriaBloqueada[] = [];

    materias.forEach((materia) => {
      if (inscriptas.has(materia.id)) return;
      if (!materia.horarios.length) return;
      if (!ventanaPermiteMateria(ventanaActual, materia)) return;

      const faltanReg = materia.correlativasRegular.filter(
        (mid) => !regularizadas.has(mid) && !aprobadas.has(mid),
      );
      const faltanApr = materia.correlativasAprob.filter((mid) => !aprobadas.has(mid));
      if (faltanReg.length || faltanApr.length) return;

      const conflictos = inscripcionesConHorario.filter((insData) => {
        if (!cuatrimestreCompatible(materia.cuatrimestre, insData.cuatrimestre)) return false;
        return hayChoque(materia.horarios, insData.horarios);
      });

      if (conflictos.length === 0) return;

      resultado.push({
        materia,
        horarios: materia.horarios,
        cuatrimestre: materia.cuatrimestre,
        conflictos,
      });
    });

    return resultado;
  }, [historial, inscripcionesActivas, inscripcionesConHorario, materias, shouldFetch, ventana]);

  const ventanaActiva =
    !!ventana &&
    ventana.activo &&
    (!ventana.desde || new Date(ventana.desde) <= new Date()) &&
    (!ventana.hasta || new Date(ventana.hasta) >= new Date());

  const [solicitudPendiente, setSolicitudPendiente] = React.useState<{
    materiaId: number;
    materiaNombre: string;
    comisionId: number;
    comisionLabel: string;
    profesorado?: string;
  } | null>(null);
  const [expandedMap, setExpandedMap] = React.useState<Record<number, boolean>>({});
  const toggleExpanded = React.useCallback(
    (id: number) => setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

  const abrirConfirmacionSolicitud = React.useCallback((materia: Materia, alternativa: AlternativaItem) => {
    setSolicitudPendiente({
      materiaId: materia.id,
      materiaNombre: materia.nombre,
      comisionId: alternativa.comision.id,
      comisionLabel: alternativa.comision.codigo || String(alternativa.comision.id),
      profesorado: alternativa.profesorado,
    });
  }, []);

  const solicitudLoading = mSolicitar.isPending;

  const confirmarSolicitud = React.useCallback(() => {
    if (!solicitudPendiente) {
      return;
    }
    mSolicitar.mutate({
      materiaId: solicitudPendiente.materiaId,
      comisionId: solicitudPendiente.comisionId,
    });
  }, [mSolicitar, solicitudPendiente]);

  const cancelarSolicitud = React.useCallback(() => {
    if (solicitudLoading) return;
    setSolicitudPendiente(null);
  }, [solicitudLoading]);

  const queryError =
    shouldFetch &&
    (materiasQ.isError || historialQ.isError || inscriptasQ.isError || ventanaQ.isError);

  const loading =
    shouldFetch &&
    (materiasQ.isLoading || historialQ.isLoading || inscriptasQ.isLoading || ventanaQ.isLoading);
  if (loading) {
    return (
      <Box p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ p: 3 }}>
        <BackButton fallbackPath={canGestionar ? '/secretaria' : '/estudiantes'} />
        <Typography variant="h4" gutterBottom>
          Cambio de Comisión
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Si una materia queda bloqueada por superposición horaria, podés solicitar cursarla en otro profesorado.
        </Typography>

        {canGestionar && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ mt: 2, mb: 1 }}
          >
            <TextField
              label="DNI del estudiante"
              size="small"
              value={dniFiltro}
              onChange={(e) => setDniFiltro(e.target.value)}
              sx={{ maxWidth: 260 }}
            />
          </Stack>
        )}

        {!shouldFetch && canGestionar && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Ingresa el DNI del estudiante para analizar superposiciones.
          </Alert>
        )}

        {queryError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            No se pudieron cargar los datos necesarios. Intenta nuevamente.
          </Alert>
        )}

        {info && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setInfo(null)}>
            {info}
          </Alert>
        )}
        {err && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErr(null)}>
            {err}
          </Alert>
        )}

        {shouldFetch && !ventanaActiva && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            No hay una ventana de inscripción activa. Las solicitudes quedarán pendientes hasta que se habilite.
          </Alert>
        )}

        {shouldFetch && materiasConChoque.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No se detectaron materias habilitadas con superposición horaria.
          </Alert>
        ) : shouldFetch ? (
          <Stack gap={2} sx={{ mt: 2 }}>
            {materiasConChoque.map((entrada) => {
              const { materia, horarios, conflictos } = entrada;
              const clave = String(materia.id);
              const isExpanded = !!expandedMap[materia.id];

              return (
                <Paper key={clave} sx={{ p: 2 }}>
                  <Stack gap={1.2}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {materia.nombre}
                    </Typography>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Horarios: {formatHorarios(horarios)}
                      </Typography>
                      {materia.profesorado && (
                        <Typography variant="body2" color="text.secondary">
                          Profesorado: {materia.profesorado}
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Se superpone con:
                      </Typography>
                      <Stack component="ul" sx={{ pl: 2, m: 0 }} gap={0.5}>
                        {conflictos.map((otro) => (
                          <li key={otro.inscripcion.inscripcion_id}>
                            <Typography variant="body2">
                              {otro.inscripcion.materia_nombre} - {otro.comision.codigo} ({otro.comision.turno}) -{' '}
                              {formatHorarios(otro.horarios)}
                            </Typography>
                          </li>
                        ))}
                      </Stack>
                    </Box>
                    <Button size="small" onClick={() => toggleExpanded(materia.id)}>
                      {isExpanded ? 'Ocultar alternativas' : 'Ver alternativas en otros profesorados'}
                    </Button>
                    <Collapse in={isExpanded}>
                      <Alternativas
                        base={entrada}
                        otros={inscripcionesConHorario}
                        disabled={mSolicitar.isPending || !ventanaActiva}
                        onSolicitar={(alternativa) => abrirConfirmacionSolicitud(materia, alternativa)}
                      />
                    </Collapse>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : null}
      </Box>
      <FinalConfirmationDialog
        open={!!solicitudPendiente}
        onConfirm={confirmarSolicitud}
        onCancel={cancelarSolicitud}
        contextText={
          solicitudPendiente
            ? `solicitud de cambio de comisión para ${solicitudPendiente.materiaNombre} (Comisión ${solicitudPendiente.comisionLabel}${solicitudPendiente.profesorado ? ` · ${solicitudPendiente.profesorado}` : ''
            })`
            : 'cambio de comisión'
        }
        loading={solicitudLoading}
      />
    </>
  );
};

function Alternativas({
  base,
  otros,
  disabled,
  onSolicitar,
}: {
  base: MateriaBloqueada;
  otros: InscripcionConHorario[];
  disabled: boolean;
  onSolicitar: (alternativa: AlternativaItem) => void;
}) {
  const [items, setItems] = React.useState<AlternativaItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const otrosKey = React.useMemo(
    () => otros.map((o) => o.inscripcion.inscripcion_id).sort().join(','),
    [otros],
  );

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    obtenerEquivalencias(base.materia.id)
      .then((res) => {
        if (!mounted) return;
        const disponibles = filtrarAlternativas(res, base, otros);
        setItems(disponibles);
      })
      .catch((err) => {
        if (mounted) setError(mensajeError(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [base.materia.id, base.cuatrimestre, otrosKey]);

  return (
    <Box sx={{ mt: 1, pl: 1 }}>
      <Typography variant="subtitle2">Alternativas disponibles</Typography>
      {loading && <CircularProgress size={18} sx={{ ml: 1, mt: 1 }} />}
      {!loading && error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      {!loading && !error && (!items || items.length === 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Sin alternativas que eviten superposición en este cuatrimestre.
        </Typography>
      )}
      <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
        {(items || []).map((alt) => (
          <Grid item xs={12} md={6} key={alt.comision.id}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack gap={0.5}>
                <Typography variant="subtitle2">{alt.profesorado}</Typography>
                <Typography variant="body2">
                  Comisión {alt.comision.codigo} ({alt.comision.turno})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatHorarios(alt.horarios)}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  disabled={disabled}
                  onClick={() => onSolicitar(alt)}
                >
                  Solicitar inscripción
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function filtrarAlternativas(
  equivalencias: EquivalenciaItemDTO[],
  base: MateriaBloqueada,
  otros: InscripcionConHorario[],
): AlternativaItem[] {
  const resultado = new Map<number, AlternativaItem>();
  const profesorActual = base.materia.profesorado ?? null;

  equivalencias.forEach((eq) => {
    if (!mismasEtapas(base.cuatrimestre, eq.cuatrimestre)) return;
    if (profesorActual && eq.profesorado === profesorActual) return;

    eq.comisiones.forEach((com) => {
      const horarios = com.horarios && com.horarios.length ? com.horarios : eq.horarios;
      if (!horarios.length) return;
      const chocaConOtros = otros.some((otro) => {
        if (!cuatrimestreCompatible(eq.cuatrimestre, otro.cuatrimestre)) return false;
        return hayChoque(horarios, otro.horarios);
      });
      if (chocaConOtros) return;
      if (!resultado.has(com.id)) {
        resultado.set(com.id, {
          comision: com,
          horarios,
          profesorado: eq.profesorado,
        });
      }
    });
  });

  return Array.from(resultado.values()).sort((a, b) => a.profesorado.localeCompare(b.profesorado));
}

export default CambioComisionPage;
