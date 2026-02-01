import React, { useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Box,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  FormControlLabel,
  Checkbox,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  Autocomplete,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';

import {
  crearPlanillaRegularidad,
  fetchRegularidadMetadata,
  RegularidadMetadataMateria,
  RegularidadMetadataPlantilla,
  RegularidadMetadataProfesorado,
  PlanillaRegularidadCreatePayload,
  PlanillaRegularidadCreateResult,
  obtenerPlanillaRegularidadDetalle,
  actualizarPlanillaRegularidad,
} from '@/api/primeraCarga';

type PlanillaDocenteFormValues = {
  docente_id?: number | null;
  nombre: string;
  dni: string;
  rol: string;
  orden?: number | null;
};

type PlanillaFilaFormValues = {
  orden: number | null;
  dni: string;
  apellido_nombre: string;
  nota_final: string;
  asistencia: string;
  situacion: string;
  excepcion: boolean;
  datos: Record<string, string>;
};

type PlanillaFormValues = {
  profesoradoId: number | '';
  materiaId: number | '';
  plantillaId: number | '';
  fecha: string;
  folio: string;
  planResolucion: string;
  observaciones: string;
  docentes: PlanillaDocenteFormValues[];
  filas: PlanillaFilaFormValues[];
  dry_run: boolean;
};

interface PlanillaRegularidadDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: PlanillaRegularidadCreateResult | any, dryRun: boolean) => void;
  planillaId?: number | null;
  mode?: 'create' | 'edit' | 'view';
}

const DEFAULT_DOCENTE: PlanillaDocenteFormValues = {
  docente_id: null,
  nombre: '',
  dni: '',
  rol: 'profesor',
  orden: null,
};

const DEFAULT_DOCENTE_BEDEL: PlanillaDocenteFormValues = {
  docente_id: null,
  nombre: '',
  dni: '',
  rol: 'bedel',
  orden: null,
};

const buildDefaultRow = (index: number): PlanillaFilaFormValues => ({
  orden: index + 1,
  dni: '',
  apellido_nombre: '',
  nota_final: '', // Permitirá números 0-10 o '---'
  asistencia: '',
  situacion: '',
  excepcion: false,
  datos: {},
});

const buildDefaultRows = (count = 1): PlanillaFilaFormValues[] =>
  Array.from({ length: count }, (_, idx) => buildDefaultRow(idx));

const regimenToDictado: Record<string, string> = {
  ANU: 'ANUAL',
  ANUAL: 'ANUAL',
  PCU: '1C',
  SCU: '2C',
  '1C': '1C',
  '2C': '2C',
};

const REGIMEN_LABELS: Record<string, string> = {
  ANU: 'Anual',
  ANUAL: 'Anual',
  PCU: '1° cuatrimestre',
  SCU: '2° cuatrimestre',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

const DICTADO_LABELS: Record<string, string> = {
  ANUAL: 'Anual',
  '1C': '1° cuatrimestre',
  '2C': '2° cuatrimestre',
};

const FORMATO_SLUG_MAP: Record<string, string> = {
  ASI: 'asignatura',
  MOD: 'modulo',
  TAL: 'taller',
  PRA: 'taller',
  LAB: 'taller',
  SEM: 'asignatura', // Seminario según reglamento tiene piso 65% (B)
};

const SITUACION_PLACEHOLDER = 'Seleccionar';

const formatColumnLabel = (label?: string) => {
  if (!label) {
    return '';
  }
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/º|°/g, '').replace(/\s+/g, ' ').trim();
};

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PlanillaRegularidadDialog: React.FC<PlanillaRegularidadDialogProps> = ({
  open,
  onClose,
  onCreated,
  planillaId,
  mode = 'create'
}) => {
  const isReadOnly = mode === 'view';

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
  } = useForm<PlanillaFormValues>({
    defaultValues: {
      profesoradoId: '',
      materiaId: '',
      plantillaId: '',
      fecha: todayIso(),
      folio: '',
      planResolucion: '',
      observaciones: '',
      docentes: [DEFAULT_DOCENTE, DEFAULT_DOCENTE_BEDEL],
      filas: buildDefaultRows(),
      dry_run: false,
    },
  });

  const [crossLoadEnabled, setCrossLoadEnabled] = React.useState(false);

  const metadataQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'metadata', crossLoadEnabled],
    queryFn: () => fetchRegularidadMetadata(crossLoadEnabled),
    enabled: open,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'detalle', planillaId],
    queryFn: () => obtenerPlanillaRegularidadDetalle(planillaId!),
    enabled: open && !!planillaId,
  });

  useEffect(() => {
    if (open) {
      metadataQuery.refetch();
    }
    if (!open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (detailQuery.data?.data) {
      const d = detailQuery.data.data;
      reset({
        profesoradoId: d.profesorado_id,
        materiaId: d.materia_id,
        plantillaId: d.plantilla_id,
        fecha: d.fecha.slice(0, 10),
        folio: d.folio || '',
        planResolucion: d.plan_resolucion || '',
        observaciones: d.observaciones || '',
        docentes: d.docentes.map(doc => ({
          docente_id: doc.docente_id,
          nombre: doc.nombre,
          dni: doc.dni || '',
          rol: doc.rol || 'profesor',
          orden: doc.orden ?? null
        })),
        filas: d.filas.map(f => ({
          orden: f.orden ?? null,
          dni: f.dni,
          apellido_nombre: f.apellido_nombre,
          nota_final: f.nota_final?.toString() || '',
          asistencia: f.asistencia?.toString() || '',
          situacion: f.situacion,
          excepcion: f.excepcion ?? false,
          datos: Object.fromEntries(
            Object.entries(f.datos || {}).map(([k, v]) => [k, v?.toString() ?? ''])
          )
        })),
        dry_run: false
      });
    }
  }, [detailQuery.data, reset]);

  const profesoradoId = watch('profesoradoId');
  const materiaId = watch('materiaId');
  const plantillaId = watch('plantillaId');
  const fechaSeleccionada = watch('fecha');
  const docentesForm = watch('docentes');

  const headerCellSx = {
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    backgroundColor: 'grey.100',
    border: '1px solid',
    borderColor: 'grey.300',
    whiteSpace: 'nowrap',
  };

  const bodyCellSx = {
    border: '1px solid',
    borderColor: 'grey.200',
    px: 1.5,
    py: 1,
    verticalAlign: 'middle',
  };

  const {
    fields: docenteFields,
    append: appendDocente,
    remove: removeDocente,
  } = useFieldArray({
    control,
    name: 'docentes',
  });

  const {
    fields: filaFields,
    append: appendFila,
    remove: removeFila,
    replace: replaceFilas,
  } = useFieldArray({
    control,
    name: 'filas',
  });



  const mutation = useMutation({
    mutationFn: (payload: PlanillaRegularidadCreatePayload) => {
      if (mode === 'edit' && planillaId) {
        return actualizarPlanillaRegularidad(planillaId, payload);
      }
      return crearPlanillaRegularidad(payload);
    },
    onSuccess: (data, variables) => {
      enqueueSnackbar(data.message, { variant: 'success' });
      // ... (warnings logic same as before) ...
      if (typeof data.data?.regularidades_registradas === 'number') {
        const count = data.data.regularidades_registradas;
        const messageDetalle = variables.dry_run
          ? `Simuladas ${count} regularidades.`
          : `${count} regularidades registradas.`;
        enqueueSnackbar(
          messageDetalle,
          { variant: 'info' },
        );
      }
      if (data.data?.warnings?.length) {
        data.data.warnings.forEach((warning: string) => {
          if (warning && !warning.includes("No se encontró inscripción")) {
            enqueueSnackbar(warning, { variant: 'warning' });
          }
        });
      }
      if (!variables.dry_run && data.data?.pdf_url) {
        // ... (pdf open logic) ...
        const base = import.meta.env.VITE_API_BASE || window.location.origin;
        const mediaBase = base.replace(/\/api\/?$/, '/');
        let targetUrl = data.data.pdf_url;
        if (!/^https?:\/\//i.test(targetUrl)) {
          try {
            targetUrl = new URL(targetUrl, mediaBase).toString();
          } catch (error) {
          }
        }
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }

      onCreated?.(data.data, !!variables.dry_run);

      if (!variables.dry_run && !planillaId && persistStudents) {
        // Si es creación y quiere persistir estudiantes:
        // 1. Guardamos la lista de estudiantes limpia
        const currentFilas = getValues('filas');
        const preservedFilas = currentFilas.map((f, idx) => ({
          ...buildDefaultRow(idx),
          dni: f.dni,
          apellido_nombre: f.apellido_nombre,
          orden: idx + 1
        }));

        // 2. Reseteamos formulario pero volvemos a poner las filas
        // Cuidado: reset() borra todo. Mejor estrategia: setValue manual de campos cabecera.
        setValue('materiaId', '');
        setValue('plantillaId', '');
        setValue('folio', '');
        setValue('observaciones', '');
        setValue('filas', preservedFilas);

        enqueueSnackbar('Se han mantenido los estudiantes para la siguiente carga. Seleccione nueva materia.', { variant: 'info' });
        // NO llamamos onClose()
      } else {
        onClose();
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'No se pudo generar la planilla.';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const profesorados: RegularidadMetadataProfesorado[] = metadataQuery.data?.profesorados ?? [];

  const selectedProfesorado = useMemo(
    () => profesorados.find((p) => p.id === Number(profesoradoId)),
    [profesorados, profesoradoId],
  );

  const materias = useMemo<RegularidadMetadataMateria[]>(() => {
    if (!selectedProfesorado) {
      return [];
    }
    return selectedProfesorado.planes.flatMap((plan) => plan.materias);
  }, [selectedProfesorado]);

  /* Removed cleanup useEffect */

  const selectedMateria = useMemo(
    () => materias.find((m) => m.id === Number(materiaId)),
    [materias, materiaId],
  );

  const materiaAnioLabel = useMemo(() => {
    if (!selectedMateria) {
      return null;
    }
    const anio = selectedMateria.anio_cursada;
    if (!anio) {
      return null;
    }
    return `${anio}°`;
  }, [selectedMateria]);

  const plantillasDisponibles = useMemo<RegularidadMetadataPlantilla[]>(() => {
    if (!selectedMateria) {
      return [];
    }
    const slug = FORMATO_SLUG_MAP[selectedMateria.formato] ?? selectedMateria.formato.toLowerCase();
    const expectedDictado = regimenToDictado[selectedMateria.regimen] ?? 'ANUAL';
    const candidatas = (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) =>
        plantilla.formato.slug.toLowerCase() === slug &&
        plantilla.dictado.toUpperCase() === expectedDictado.toUpperCase(),
    );
    if (candidatas.length) {
      return candidatas;
    }
    return (metadataQuery.data?.plantillas ?? []).filter(
      (plantilla) => plantilla.formato.slug.toLowerCase() === slug,
    );
  }, [selectedMateria, metadataQuery.data?.plantillas]);

  useEffect(() => {
    if (selectedMateria) {
      setValue('planResolucion', selectedMateria.plan_resolucion || '');
      // Al cambiar de materia, seleccionamos automáticamente la primera plantilla compatible disponible
      // para evitar que quede seleccionada una plantilla incompatible (ej: Modulo en Asignatura).
      // Solo intentamos mantener la actual si estamos en modo edición.
      if (mode === 'create') {
        if (plantillasDisponibles.length > 0) {
          setValue('plantillaId', plantillasDisponibles[0].id);
        } else {
          setValue('plantillaId', '');
        }
      } else {
        // En modo view/edit intentamos preservar si existe
        const currentId = getValues('plantillaId');
        const exists = plantillasDisponibles.some(p => p.id === Number(currentId));
        if (!exists && plantillasDisponibles.length > 0) {
          setValue('plantillaId', plantillasDisponibles[0].id);
        }
      }
    } else {
      setValue('plantillaId', '');
      setValue('planResolucion', '');
    }
  }, [selectedMateria, plantillasDisponibles, setValue, mode, getValues]);

  const selectedPlantilla = useMemo(
    () => plantillasDisponibles.find((p) => p.id === Number(plantillaId)),
    [plantillasDisponibles, plantillaId],
  );

  const dictadoLabel = useMemo(() => {
    if (!selectedPlantilla) {
      return null;
    }
    return DICTADO_LABELS[selectedPlantilla.dictado] ?? selectedPlantilla.dictado;
  }, [selectedPlantilla]);

  const docentesOptions = useMemo(() => metadataQuery.data?.docentes ?? [], [metadataQuery.data?.docentes]);
  const docentesMap = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; dni?: string | null }>();
    docentesOptions.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [docentesOptions]);

  const estudiantesMetadata = useMemo(() => metadataQuery.data?.estudiantes ?? [], [metadataQuery.data?.estudiantes]);
  const estudiantePorDni = useMemo(() => {
    const map = new Map<string, { apellido_nombre: string; profesorados: number[] }>();
    estudiantesMetadata.forEach((est) => {
      map.set(est.dni, { apellido_nombre: est.apellido_nombre, profesorados: est.profesorados });
    });
    return map;
  }, [estudiantesMetadata]);

  const columnasDinamicas = selectedPlantilla?.columnas ?? [];
  const situacionesDisponibles = selectedPlantilla?.situaciones ?? [];

  const previewCodigo = useMemo(() => {
    if (!selectedProfesorado || !fechaSeleccionada) {
      return null;
    }
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(selectedProfesorado.id).padStart(2, '0')}${selectedProfesorado.acronimo}${day}XXX`;
  }, [selectedProfesorado, fechaSeleccionada]);

  const onSubmit = (values: PlanillaFormValues) => {
    if (!selectedProfesorado) {
      enqueueSnackbar('Debe seleccionar un profesorado.', { variant: 'warning' });
      return;
    }
    if (!selectedMateria) {
      enqueueSnackbar('Debe seleccionar una unidad curricular.', { variant: 'warning' });
      return;
    }
    if (!selectedPlantilla) {
      enqueueSnackbar('Debe seleccionar una plantilla de planilla.', { variant: 'warning' });
      return;
    }

    const filasConDatos = values.filas
      .map((fila, index) => ({ ...fila, index }))
      .filter((fila) => {
        return (
          fila.dni.trim() ||
          fila.apellido_nombre.trim() ||
          fila.nota_final.trim() ||
          fila.asistencia.trim() ||
          fila.situacion.trim() ||
          Object.values(fila.datos || {}).some(v => String(v).trim())
        );
      });

    if (filasConDatos.length === 0) {
      enqueueSnackbar('Debe completar al menos una fila de estudiante.', { variant: 'warning' });
      return;
    }

    // Actualizar el estado del formulario para remover físicamente las vacías de la UI
    if (filasConDatos.length !== values.filas.length) {
      const nuevasFilas = filasConDatos.map((f, i) => ({
        ...f,
        orden: i + 1
      }));
      replaceFilas(nuevasFilas);
    }

    const filasPreparadas = filasConDatos.map((f, i) => ({
      ...f,
      orden: i + 1,
      // Usar un índice lógico para el mensaje de error basado en la nueva tabla limpia
      displayIndex: i + 1
    }));

    for (const fila of filasPreparadas) {
      const rowNum = fila.displayIndex;
      if (!fila.dni.trim() && !fila.apellido_nombre.trim()) {
        enqueueSnackbar(`Ingrese el DNI o el Nombre en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
      // Validar que si no hay DNI, al menos el backend lo pueda manejar (ya cubierto por logica backend)
      if (!fila.apellido_nombre.trim()) {
        enqueueSnackbar(`Ingrese el nombre del alumno en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
      if (!fila.nota_final.trim()) {
        enqueueSnackbar(`Ingrese la nota final en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
      if (!fila.asistencia.trim()) {
        enqueueSnackbar(`Ingrese el porcentaje de asistencia en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
      if (!fila.situacion.trim()) {
        enqueueSnackbar(`Seleccione la situación académica en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
    }

    let filasPayload: PlanillaRegularidadCreatePayload['filas'];
    try {
      filasPayload = filasPreparadas.map<PlanillaRegularidadCreatePayload['filas'][number]>((fila, idx) => {
        const datosLimpios: Record<string, string> = {};
        columnasDinamicas.forEach((col) => {
          const valor = fila.datos?.[col.key];
          const stringValor = valor !== undefined && valor !== null ? String(valor).trim() : '';
          if (!stringValor) {
            if (!col.optional) {
              throw new Error(`Completa el campo "${col.label}" en la fila ${fila.index + 1}.`);
            }
          } else {
            datosLimpios[col.key] = stringValor;
          }
        });

        const asistRaw = (fila.asistencia || '').trim();
        let asistNumero: number | null = null;
        if (asistRaw === '---') {
          asistNumero = null;
        } else {
          asistNumero = parseInt(asistRaw, 10);
          if (isNaN(asistNumero) || asistNumero < 0 || asistNumero > 100) {
            throw new Error(`La asistencia de la fila ${fila.index + 1} debe estar entre 0 y 100 o "---".`);
          }
        }

        const notaRaw = fila.nota_final.trim();
        let notaNumero: number | null = null;
        if (notaRaw === '---') {
          notaNumero = null;
        } else {
          notaNumero = Number(notaRaw.replace(',', '.'));
          if (Number.isNaN(notaNumero)) {
            throw new Error(`La nota final de la fila ${fila.index + 1} debe ser numérica (0-10) o "---".`);
          }
        }

        return {
          orden: fila.orden ?? idx + 1,
          dni: fila.dni.trim(),
          apellido_nombre: fila.apellido_nombre.trim(),
          nota_final: notaNumero,
          asistencia: asistNumero,
          situacion: fila.situacion.trim(),
          excepcion: fila.excepcion ?? false,
          datos: datosLimpios,
        };
      });
    } catch (error: any) {
      enqueueSnackbar(error.message ?? 'Verifique los datos de las filas cargadas.', { variant: 'error' });
      return;
    }

    const docentesPayload =
      values.docentes
        ?.map((docente, idx) => ({
          docente_id: docente.docente_id ?? null,
          nombre: docente.nombre.trim(),
          dni: docente.dni.trim() || null,
          rol: docente.rol || 'profesor',
          orden: docente.orden ?? idx + 1,
        }))
        .filter((docente) => docente.nombre.length > 0) ?? [];

    const payload: PlanillaRegularidadCreatePayload = {
      profesorado_id: Number(selectedProfesorado.id),
      materia_id: Number(selectedMateria.id),
      plantilla_id: Number(selectedPlantilla.id),
      dictado: selectedPlantilla.dictado,
      fecha: values.fecha,
      folio: values.folio || undefined,
      plan_resolucion: values.planResolucion || selectedMateria.plan_resolucion,
      observaciones: values.observaciones || undefined,
      docentes: docentesPayload,
      filas: filasPayload,
      dry_run: values.dry_run,
    };

    mutation.mutate(payload);
  };

  const [persistStudents, setPersistStudents] = React.useState(false);
  const [rowsToAdd, setRowsToAdd] = React.useState<string>('5');

  const handleAddRow = () => {
    let count = parseInt(rowsToAdd, 10);
    if (isNaN(count) || count < 1) count = 1;
    const currentLength = filaFields.length;
    const nuevos = Array.from({ length: count }, (_, idx) => buildDefaultRow(currentLength + idx));
    appendFila(nuevos);
  };

  const handleInsertRow = (index: number) => {
    // Usamos splite/insert logica manual porque useFieldArray.insert a veces da problemas de re-render index
    const newRow = buildDefaultRow(0); // El orden se recalcula al enviar
    // @ts-ignore - insert is available in useFieldArray returns but sometimes typed poorly in older RHF
    replaceFilas([
      ...getValues('filas').slice(0, index + 1),
      newRow,
      ...getValues('filas').slice(index + 1)
    ]);
  };

  const handleClearRows = () => {
    replaceFilas(buildDefaultRows());
  };

  const handleAddDocente = () => {
    appendDocente({ ...DEFAULT_DOCENTE });
  };

  const handleRemoveDocente = (index: number) => {
    removeDocente(index);
  };

  const handleStudentDniBlur = (index: number, rawValue: string) => {
    const dni = (rawValue || '').trim();
    if (!dni) {
      return;
    }
    const match = estudiantePorDni.get(dni);
    if (!match) {
      return;
    }
    if (selectedProfesorado && !match.profesorados.includes(selectedProfesorado.id)) {
      return;
    }
    setValue(`filas.${index}.apellido_nombre`, match.apellido_nombre, { shouldDirty: true });
  };

  const calculateSituacionForRow = (index: number) => {
    const row = getValues(`filas.${index}`);
    if (!selectedMateria || !row.asistencia || !row.nota_final) return;

    const formato = selectedMateria.formato.toUpperCase();

    // ASISTENCIA Y PROMOCIÓN:
    // 1. Formatos que ADMITEN EXCEPCIÓN (Asignaturas, Seminarios, Talleres, Labs, Practicas, Materias):
    //    - Base Regular/Promoción: 80%
    //    - Con Excepción: Baja a 65%
    // 2. Formatos que NO ADMITEN EXCEPCIÓN (Módulos):
    //    - Base Regular/Promoción: 80% (Fijo). (Reglamento dice 65% un parrafo, promo 80% user rule. Usamos 65 Regular / 80 Promo para MOD)

    const admiteExcepcion = ['ASI', 'SEM', 'TAL', 'LAB', 'PRA', 'MAT'].includes(formato);
    const esModulo = ['MOD', 'MODULO'].includes(formato);

    const asistencia = parseInt(row.asistencia, 10);
    const notaVal = row.nota_final === '---' ? null : Number(row.nota_final.replace(',', '.'));
    const tieneExcepcion = row.excepcion; // boolean

    let minAsistencia = 80;

    if (esModulo) {
      // Módulos: 
      // Regularidad: 65% (segun reglamento textual "Módulos 65%").
      minAsistencia = 65;
    } else if (admiteExcepcion) {
      // Asignaturas y otros:
      // Base 80%. Con excepción 65%.
      minAsistencia = tieneExcepcion ? 65 : 80;
    } else {
      // Default (otras cosas): 65% base.
      minAsistencia = 65;
    }

    let newSit = '';

    if (isNaN(asistencia)) {
      newSit = '';
    } else if (asistencia < 30) {
      newSit = 'LIBRE-AT';
    } else if (asistencia < minAsistencia) {
      newSit = 'LIBRE-I';
    } else if (notaVal === null) {
      newSit = 'REGULAR';
    } else if (notaVal < 6) {
      newSit = 'DESAPROBADO_PA';
    } else {
      // Candidato a Regular o Promocion
      let esPromocion = false;

      if (notaVal >= 8) {
        let minAsistPromo = 80;

        if (esModulo) {
          // Modulo: 80% Fijo para promo (User instruction)
          minAsistPromo = 80;
        } else if (admiteExcepcion) {
          // Resto: 80% o 65% si hay check
          minAsistPromo = tieneExcepcion ? 65 : 80;
        }

        if (asistencia >= minAsistPromo) {
          // Chequear TPs y Parciales
          let requisitosNotasOk = true;
          if (row.datos && columnasDinamicas.length > 0) {
            columnasDinamicas.forEach(col => {
              const key = col.key.toLowerCase();
              const valStr = row.datos[col.key];
              const val = Number(valStr);
              if (valStr && !isNaN(val)) {
                // TPs >= 6
                if (key.includes('tp') || key.includes('trabajo')) {
                  if (val < 6) requisitosNotasOk = false;
                }
                // Parciales >= 8
                if (key.includes('parc') || key.includes('parcial')) {
                  if (val < 8) requisitosNotasOk = false;
                }
              }
            });
          }
          if (requisitosNotasOk) {
            esPromocion = true;
          }
        }
      }

      if (esPromocion && situacionesDisponibles.some(s => s.codigo === 'PRO')) {
        newSit = 'PRO';
      } else {
        newSit = 'REGULAR';
      }
    }

    if (newSit && situacionesDisponibles.some(s => s.codigo === newSit)) {
      setValue(`filas.${index}.situacion`, newSit, { shouldDirty: true });
    }
  };

  const handleAutoCalculateAll = () => {
    filaFields.forEach((_, index) => {
      calculateSituacionForRow(index);
    });
    enqueueSnackbar('Situaciones académicas calculadas según reglamento.', { variant: 'info' });
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason && reason === 'backdropClick') return;
        onClose();
      }}
      maxWidth={false}
      scroll="paper"
      PaperProps={{
        sx: {
          width: '90vw',
          maxWidth: 'none',
          minWidth: '960px',
          minHeight: '70vh',
          resize: 'both',
          overflow: 'auto',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {mode === 'view' ? 'Ver Planilla de Regularidad' : mode === 'edit' ? 'Editar Planilla de Regularidad' : 'Generar planilla de regularidad / promoción'}
        </Typography>
        {mode !== 'create' && <Chip label={`MODO: ${mode.toUpperCase()}`} color={mode === 'view' ? 'info' : 'primary'} size="small" variant="filled" />}
      </DialogTitle>
      <DialogContent dividers sx={{ position: 'relative' }}>
        {(detailQuery.isLoading || metadataQuery.isLoading) && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}
        {metadataQuery.error && (
          <Alert severity="error">
            No se pudo cargar la información inicial. Actualice la página o vuelva a intentar.
          </Alert>
        )}
        {!metadataQuery.isLoading && metadataQuery.data && (
          <Box component="form" sx={{ mt: 1 }} onSubmit={handleSubmit(onSubmit)}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Datos generales
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={crossLoadEnabled}
                      onChange={(e) => setCrossLoadEnabled(e.target.checked)}
                    />
                  }
                  label="Habilitar carga de comisiones cruzadas (Cargar en otro profesorado)"
                />
                {crossLoadEnabled && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Esta opción mostrará todos los profesorados disponibles. Utilícela solo para cargar alumnos de comisiones o equivalencias.
                  </Alert>
                )}
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="profesoradoId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Profesorado"
                      fullWidth
                      size="small"
                      required
                      onChange={(e) => {
                        field.onChange(e);
                        setValue('materiaId', '');
                        setValue('plantillaId', '');
                        setValue('planResolucion', '');
                      }}
                    >
                      {profesorados.map((prof) => (
                        <MenuItem key={prof.id} value={prof.id}>
                          {prof.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="materiaId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Unidad curricular"
                      fullWidth
                      size="small"
                      required
                      disabled={!selectedProfesorado}
                    >
                      {materias.map((materia) => (
                        <MenuItem key={materia.id} value={materia.id}>
                          {materia.nombre} ({materia.anio_cursada ?? '-'}°)
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  control={control}
                  name="plantillaId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Plantilla"
                      fullWidth
                      size="small"
                      required
                      disabled={!selectedMateria}
                      helperText={
                        selectedPlantilla
                          ? `${selectedPlantilla.formato.nombre} - ${selectedPlantilla.dictado}`
                          : 'Selecciona unidad curricular para habilitar'
                      }
                    >
                      {plantillasDisponibles.map((plantilla) => (
                        <MenuItem key={plantilla.id} value={plantilla.id}>
                          {plantilla.nombre}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="fecha"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="date"
                      label="Fecha de la planilla"
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      size="small"
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="folio"
                  render={({ field }) => (
                    <TextField {...field} label="Folio" fullWidth size="small" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Controller
                  control={control}
                  name="planResolucion"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Resolución del plan"
                      fullWidth
                      size="small"
                      helperText="Se sugiere mantener la resolución de la unidad curricular."
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  control={control}
                  name="observaciones"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Observaciones"
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                {!isReadOnly && (
                  <Controller
                    control={control}
                    name="dry_run"
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label="Dry-run (simular sin guardar ni generar PDF)"
                      />
                    )}
                  />
                )}
              </Grid>
            </Grid>

            {selectedMateria && selectedPlantilla && (
              <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {materiaAnioLabel ? (
                  <Chip size="small" label={`Año: ${materiaAnioLabel}`} variant="outlined" />
                ) : null}
                <Chip
                  size="small"
                  label={`Formato: ${selectedPlantilla.formato.nombre}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Dictado: ${dictadoLabel || selectedPlantilla.dictado}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Regimen: ${REGIMEN_LABELS[selectedMateria.regimen] ?? selectedMateria.regimen}`}
                  variant="outlined"
                />
              </Box>
            )}

            {selectedPlantilla?.descripcion ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {selectedPlantilla.descripcion}
              </Typography>
            ) : null}

            {situacionesDisponibles.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Situaciones habilitadas: {situacionesDisponibles.map((s) => s.label || s.codigo).join(', ')}
              </Typography>
            )}

            {previewCodigo && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Vista previa del código (se asigna automáticamente al guardar): {previewCodigo}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 4 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Docentes / Firmantes</Typography>
              {!isReadOnly && (
                <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleAddDocente}>
                  Agregar firmante
                </Button>
              )}
            </Box>

            {docenteFields.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Agrega al menos al docente responsable y al bedel responsable antes de generar la planilla.
              </Alert>
            )}

            <Grid container spacing={3}>
              {docenteFields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <Grid item xs={12} md={5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.nombre`}
                      render={({ field: controllerField }) => {
                        const currentDocente = docentesForm?.[index];
                        const selectedOption = currentDocente?.docente_id
                          ? docentesMap.get(currentDocente.docente_id)
                          : null;
                        const autoValue =
                          selectedOption ||
                          (controllerField.value
                            ? { id: -1, nombre: controllerField.value, dni: currentDocente?.dni }
                            : null);
                        return (
                          <Autocomplete
                            options={docentesOptions}
                            freeSolo
                            disabled={isReadOnly}
                            value={autoValue}
                            onChange={(_, value) => {
                              if (!value) {
                                controllerField.onChange('');
                                setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                                return;
                              }
                              if (typeof value === 'string') {
                                controllerField.onChange(value);
                                setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                              } else {
                                controllerField.onChange(value.nombre);
                                setValue(`docentes.${index}.docente_id`, value.id, { shouldDirty: true });
                                setValue(`docentes.${index}.dni`, value.dni || '', { shouldDirty: true });
                              }
                            }}
                            onInputChange={(_, value, reason) => {
                              if (reason === 'input') {
                                controllerField.onChange(value);
                                const currentSelected = currentDocente?.docente_id
                                  ? docentesMap.get(currentDocente.docente_id)
                                  : null;
                                if (!currentSelected || value !== currentSelected.nombre) {
                                  setValue(`docentes.${index}.docente_id`, null, { shouldDirty: true });
                                  setValue(`docentes.${index}.dni`, '', { shouldDirty: true });
                                }
                              }
                            }}
                            isOptionEqualToValue={(option, value) => {
                              if (typeof value === 'string') {
                                return option.nombre === value;
                              }
                              if (typeof option === 'string') {
                                return option === (value as any).nombre;
                              }
                              return option.id === (value as any).id;
                            }}
                            getOptionLabel={(option) => {
                              if (typeof option === 'string') {
                                return option;
                              }
                              return option.nombre;
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Nombre y apellido"
                                size="small"
                                required
                              />
                            )}
                          />
                        );
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={2.5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.docente_id`}
                      render={() => <></>}
                    />
                    <Controller
                      control={control}
                      name={`docentes.${index}.dni`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? ''}
                          label="DNI"
                          fullWidth
                          size="small"
                          inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                          disabled={isReadOnly}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.rol`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? 'profesor'}
                          select
                          label="Rol"
                          fullWidth
                          size="small"
                          disabled={isReadOnly}
                        >
                          <MenuItem value="profesor">Profesor/a</MenuItem>
                          <MenuItem value="bedel">Bedel</MenuItem>
                          <MenuItem value="otro">Otro</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.5}>
                    <Controller
                      control={control}
                      name={`docentes.${index}.orden`}
                      render={({ field: controllerField }) => (
                        <TextField
                          {...controllerField}
                          value={controllerField.value ?? ''}
                          label="Orden"
                          type="number"
                          fullWidth
                          size="small"
                          inputProps={{ min: 1 }}
                          disabled={isReadOnly}
                        />
                      )}
                    />
                  </Grid>
                  <Grid
                    item
                    xs={12}
                    md={1}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {!isReadOnly && (
                      <Tooltip title="Quitar firmante">
                        <span>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleRemoveDocente(index)}
                            disabled={docenteFields.length === 1}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Grid>
                </React.Fragment>
              ))}
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>Detalle de estudiantes</Typography>
                {!isReadOnly && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onClick={handleAutoCalculateAll}
                    disabled={!selectedMateria}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Sugerir situaciones académicas
                  </Button>
                )}
              </Box>
              {!isReadOnly && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                    <Typography variant="body2" sx={{ mr: 1, fontSize: '0.85rem' }}>Agregar filas al final:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={rowsToAdd}
                      onChange={(e) => setRowsToAdd(e.target.value)}
                      sx={{ width: 60 }}
                      disabled={isReadOnly}
                      inputProps={{ min: 1, sx: { py: 0.5, px: 1 } }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddCircleOutlineIcon fontSize="small" />}
                      onClick={() => handleAddRow()}
                      disabled={isReadOnly}
                      sx={{ textTransform: 'none', px: 1, minWidth: 'auto' }}
                    >
                      Agregar
                    </Button>
                  </Box>

                  <Tooltip title="Restablecer filas (limpiar)">
                    <IconButton color="warning" size="small" onClick={handleClearRows}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headerCellSx, width: 60 }} rowSpan={2}>
                      N°
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, minWidth: 240 }} rowSpan={2}>
                      Alumnos
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 140 }} rowSpan={2}>
                      DNI
                    </TableCell>
                    <TableCell
                      sx={{ ...headerCellSx, textAlign: 'center' }}
                      colSpan={Math.max(columnasDinamicas.length, 0) + 1}
                    >
                      Nota de trabajos prácticos y final
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 130, textAlign: 'center' }} colSpan={1}>
                      Asistencia
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 90, textAlign: 'center' }} colSpan={1}>
                      Excepción
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, minWidth: 200 }} rowSpan={2}>
                      Situación académica
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 56 }} rowSpan={2} />
                  </TableRow>
                  <TableRow>
                    {columnasDinamicas.map((col) => (
                      <TableCell sx={{ ...headerCellSx, width: 80, minWidth: 80 }} key={col.key}>
                        <Typography variant="body2" sx={{ fontSize: '0.70rem' }}>
                          {formatColumnLabel(col.label)}
                        </Typography>
                        {col.optional ? (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            (opt)
                          </Typography>
                        ) : null}
                      </TableCell>
                    ))}
                    <TableCell sx={{ ...headerCellSx, width: 80 }}>Final</TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 80 }}>% Asist.</TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 70 }}>Excep.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filaFields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell sx={{ ...bodyCellSx, width: 60, textAlign: 'center' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {index + 1}
                        </Typography>
                        <Controller
                          control={control}
                          name={`filas.${index}.orden`}
                          render={({ field: controllerField }) => (
                            <input type="hidden" {...controllerField} value={index + 1} />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 320 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.apellido_nombre`}
                          render={({ field: controllerField }) => (
                            <Autocomplete
                              freeSolo
                              disabled={isReadOnly}
                              options={estudiantesMetadata}
                              getOptionLabel={(option) => {
                                if (typeof option === 'string') return option;
                                return `${option.apellido_nombre} (${option.dni})`;
                              }}
                              value={
                                estudiantesMetadata.find(
                                  (e) => e.apellido_nombre === controllerField.value && e.dni === watch(`filas.${index}.dni`)
                                ) || controllerField.value
                              }
                              onChange={(_, value) => {
                                if (typeof value === 'string') {
                                  // Intentar extraer DNI si viene formateado como "Nombre (DNI)"
                                  const match = value.match(/(.*) \((\d+)\)$/);
                                  if (match) {
                                    controllerField.onChange(match[1].trim());
                                    setValue(`filas.${index}.dni`, match[2], { shouldDirty: true });
                                  } else {
                                    controllerField.onChange(value);
                                  }
                                } else if (value) {
                                  controllerField.onChange(value.apellido_nombre);
                                  setValue(`filas.${index}.dni`, value.dni, { shouldDirty: true });
                                } else {
                                  controllerField.onChange('');
                                }
                              }}
                              onInputChange={(_, value) => {
                                // Eliminar el (DNI) de la visualización al escribir si es necesario
                                const match = value.match(/(.*) \((\d+)\)$/);
                                controllerField.onChange(match ? match[1].trim() : value);
                              }}
                              renderOption={(props, option) => {
                                const { key, ...restProps } = props as any;
                                return (
                                  <li key={key} {...restProps}>
                                    <Box>
                                      <Typography variant="body2">{option.apellido_nombre}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        DNI: {option.dni}
                                      </Typography>
                                    </Box>
                                  </li>
                                );
                              }}
                              renderInput={(params: any) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  fullWidth
                                  placeholder="Apellido y nombre"
                                  required
                                />
                              )}
                              noOptionsText="No se encontraron estudiantes"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 100 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.dni`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value ?? ''}
                              size="small"
                              fullWidth
                              placeholder="DNI"
                              inputProps={{
                                maxLength: 9,
                                inputMode: 'numeric',
                                sx: { fontSize: '0.85rem', px: 0.5 }
                              }}
                              onBlur={(event) => {
                                controllerField.onBlur();
                                handleStudentDniBlur(index, event.target.value);
                              }}
                              onChange={(event) => {
                                const val = event.target.value.replace(/\D/g, '');
                                controllerField.onChange(val);
                                if (val.length >= 7) {
                                  handleStudentDniBlur(index, val);
                                }
                              }}
                              required
                              disabled={isReadOnly}
                            />
                          )}
                        />
                      </TableCell>
                      {columnasDinamicas.map((col) => (
                        <TableCell sx={{ ...bodyCellSx, width: 80, minWidth: 80 }} key={`${field.id}-${col.key}`}>
                          <Controller
                            control={control}
                            name={`filas.${index}.datos.${col.key}`}
                            render={({ field: controllerField }) => (
                              <TextField
                                {...controllerField}
                                value={controllerField.value ?? ''}
                                size="small"
                                fullWidth
                                inputProps={{
                                  sx: { textAlign: 'center', px: 0.5 },
                                  maxLength: 3
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '-' || val === '--' || val === '---') {
                                    controllerField.onChange(val);
                                    return;
                                  }
                                  const num = val.replace(/\D/g, '');
                                  if (num === '') {
                                    controllerField.onChange('');
                                    return;
                                  }
                                  const n = parseInt(num, 10);
                                  if (n >= 0 && n <= 10) {
                                    controllerField.onChange(num);
                                  }
                                }}
                                required={!col.optional}
                                disabled={isReadOnly}
                              />
                            )}
                          />
                        </TableCell>
                      ))}
                      <TableCell sx={{ ...bodyCellSx, width: 80 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.nota_final`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value || (isReadOnly ? '-' : '')}
                              size="small"
                              fullWidth
                              inputProps={{
                                sx: { textAlign: 'center', px: 0.5 },
                                maxLength: 3
                              }}
                              onBlur={() => calculateSituacionForRow(index)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '-' || val === '--' || val === '---') {
                                  controllerField.onChange(val);
                                  return;
                                }
                                const num = val.replace(/\D/g, '');
                                if (num === '') {
                                  controllerField.onChange('');
                                  return;
                                }
                                const n = parseInt(num, 10);
                                if (n >= 0 && n <= 10) {
                                  controllerField.onChange(num);
                                }
                              }}
                              required
                              disabled={isReadOnly}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 80 }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.asistencia`}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              value={controllerField.value || (isReadOnly ? '-' : '')}
                              size="small"
                              fullWidth
                              inputProps={{
                                sx: { textAlign: 'center', px: 0.5 },
                                maxLength: 3
                              }}
                              onBlur={() => calculateSituacionForRow(index)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '-' || val === '--' || val === '---') {
                                  controllerField.onChange(val);
                                  return;
                                }
                                const num = val.replace(/\D/g, '');
                                if (num === '') {
                                  controllerField.onChange('');
                                  return;
                                }
                                const n = parseInt(num, 10);
                                if (n >= 0 && n <= 100) {
                                  controllerField.onChange(num);
                                }
                              }}
                              required
                              disabled={isReadOnly}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 70, textAlign: 'center' }}>
                        <Controller
                          control={control}
                          name={`filas.${index}.excepcion`}
                          render={({ field: controllerField }) => {
                            const { value, onChange, ...rest } = controllerField;
                            // Determinar si se permite excepción según formato
                            const formato = selectedMateria?.formato?.toUpperCase();
                            const isGroupHigh = ['LAB', 'TAL', 'PRA'].includes(formato || '');
                            // Deshabilitar si es View o si el formato no admite excepción (ASI, SEM, MOD...)
                            const isDisabled = isReadOnly || (selectedMateria && !isGroupHigh);

                            return (
                              <Checkbox
                                {...rest}
                                checked={Boolean(value)}
                                onChange={(event) => {
                                  onChange(event.target.checked);
                                  // Recalcular al cambiar el check
                                  setTimeout(() => calculateSituacionForRow(index), 10);
                                }}
                                size="small"
                                sx={{ p: 0 }}
                                disabled={isDisabled}
                              />
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, minWidth: 200 }}>
                        {isReadOnly ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={(() => {
                              const val = watch(`filas.${index}.situacion`);
                              // Intentar buscar label en situacionesDisponibles
                              const match = situacionesDisponibles.find(
                                (s) => s.codigo.toString().toLowerCase() === (val || '').toString().toLowerCase()
                              );
                              return match ? match.label : val;
                            })()}
                            InputProps={{
                              readOnly: true,
                            }}
                            disabled
                          // disabled adds opacity, readOnly doesn't. 
                          // If we want it to look clearly readable, maybe just readOnly is better, 
                          // but consistent with other disabled fields is OK.
                          // Let's use disabled to match the rest of the form style.
                          />
                        ) : (
                          <Controller
                            control={control}
                            name={`filas.${index}.situacion`}
                            render={({ field: controllerField }) => (
                              <Autocomplete
                                options={situacionesDisponibles}
                                fullWidth
                                size="small"
                                disabled={isReadOnly || !situacionesDisponibles.length}
                                value={
                                  situacionesDisponibles.find(
                                    (s) => s.codigo.toString().toLowerCase() === (controllerField.value || '').toString().toLowerCase()
                                  ) || null
                                }
                                onChange={(_, value) => controllerField.onChange(value?.codigo || '')}
                                getOptionLabel={(option) => option?.label || option?.codigo || ''}
                                renderOption={(props, option) => {
                                  const { key, ...restProps } = props as any;
                                  return (
                                    <li key={key} {...restProps}>
                                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                        <Typography variant="body2">{option.label || option.codigo}</Typography>
                                        {option.descripcion ? (
                                          <Typography variant="caption" color="text.secondary">
                                            {option.descripcion}
                                          </Typography>
                                        ) : null}
                                      </Box>
                                    </li>
                                  );
                                }}
                                isOptionEqualToValue={(option, value) => option?.codigo === value?.codigo}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    label="Situación"
                                    placeholder={SITUACION_PLACEHOLDER}
                                    InputLabelProps={{ shrink: true }}
                                    required
                                  />
                                )}
                                noOptionsText="Sin opciones"
                              />
                            )}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: 56, textAlign: 'center' }}>
                        {!isReadOnly && (
                          <>
                            <Tooltip title="Eliminar fila">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeFila(index)}
                                  disabled={filaFields.length <= 1}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Insertar fila debajo">
                              <IconButton size="small" color="primary" onClick={() => handleInsertRow(index)}>
                                <AddCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={persistStudents}
              onChange={(e) => setPersistStudents(e.target.checked)}
              disabled={mode !== 'create'}
            />
          }
          label="Mantener lista de estudiantes al guardar"
        />
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>{mode === 'view' ? 'Cerrar' : 'Cancelar'}</Button>
          {mode !== 'view' && (
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="contained"
              disabled={mutation.isPending || metadataQuery.isLoading}
            >
              {mutation.isPending
                ? (mode === 'edit' ? 'Guardando...' : 'Generando...')
                : (mode === 'edit' ? 'Guardar Cambios' : 'Generar planilla')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PlanillaRegularidadDialog;
