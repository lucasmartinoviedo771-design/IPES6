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

const SITUACION_DESCRIPTIONS: Record<string, string> = {
  PRO: "Promocionado",
  REG: "Regular",
  APR: "Aprobado (sin final)",
  DPA: "Desaprobado por Parciales",
  DTP: "Desaprobado por Trabajos Prácticos",
  LBI: "Libre por Inasistencias",
  LAT: "Libre Antes de Tiempo",
  AUJ: "JUS",
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

const getSituacionColor = (situacion?: string) => {
  const s = (situacion || '').toUpperCase();
  // Códigos de DB o Aliases
  if (s === 'PRO' || s.includes('PROM')) return '#c6e0b4'; // Verde claro
  if (s === 'REGULAR' || s === 'REG') return '#ffff00';     // Amarillo
  if (s === 'APR' || s.includes('APRO')) return '#ed7d31';    // Naranja
  if (s.includes('DESAPROBADO') || s === 'DPA' || s === 'DTP') return '#ff0000'; // Rojo
  if (s === 'LIBRE-I' || s === 'LBI') return '#5b9bd5';      // Azul/Cyan
  if (s === 'LIBRE-AT' || s === 'LAT') return '#5b9bd5';     // Azul/Cyan (Igual que Libre I)
  return 'transparent';
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
      docentes: [
        { ...DEFAULT_DOCENTE, orden: 1 },
        { ...DEFAULT_DOCENTE_BEDEL, orden: 2 }
      ],
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
        docentes: d.docentes.map((doc, idx) => ({
          docente_id: doc.docente_id,
          nombre: doc.nombre,
          dni: doc.dni || '',
          rol: doc.rol || 'profesor',
          orden: doc.orden ?? (idx + 1)
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
    replace: replaceDocente,
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
    const currentDocentes = getValues('docentes');
    const bedelIndex = currentDocentes.findIndex((d) => d.rol === 'bedel');

    const newDocente = { ...DEFAULT_DOCENTE };
    const newList = [...currentDocentes];

    if (bedelIndex !== -1) {
      // Insertar antes del bedel
      newList.splice(bedelIndex, 0, newDocente);
    } else {
      // Si no hay bedel (raro), al final
      newList.push(newDocente);
    }

    // Recalcular orden
    const orderedList = newList.map((d, i) => ({
      ...d,
      orden: i + 1,
    }));

    replaceDocente(orderedList);
  };

  const handleRemoveDocente = (index: number) => {
    const currentDocentes = getValues('docentes');
    const newList = currentDocentes.filter((_, i) => i !== index);

    // Recalcular orden
    const orderedList = newList.map((d, i) => ({
      ...d,
      orden: i + 1,
    }));

    replaceDocente(orderedList);
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

  // --- LÓGICA DE ASISTENCIA BLUR AUTO-FILL ---
  const handleAsistenciaBlur = (index: number, e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    // Auto-fill empty fields with '---' if attendance is entered
    if (val && val.trim() !== '') {
      const currentRow = getValues(`filas.${index}`);

      // Helper to set if empty
      const fillIfEmpty = (path: string, currentVal: any) => {
        if (!currentVal || String(currentVal).trim() === '') {
          setValue(`filas.${index}.${path}` as any, '---', { shouldDirty: true });
        }
      };

      if (!currentRow.nota_final) setValue(`filas.${index}.nota_final`, '---', { shouldDirty: true });

      columnasDinamicas.forEach(col => {
        const currentVal = currentRow.datos?.[col.key];
        if (!currentVal || String(currentVal).trim() === '') {
          setValue(`filas.${index}.datos.${col.key}`, '---', { shouldDirty: true });
        }
      });
    }

    // Trigger calculation
    calculateSituacionForRow(index);
  };


  const calculateSituacionForRow = (index: number) => {
    const row = getValues(`filas.${index}`);
    if (!selectedMateria) return;

    // Parsers
    const parseVal = (v: any) => {
      if (!v || v === '---') return 0;
      return Number(String(v).replace(',', '.'));
    };

    const asistencia = row.asistencia ? parseInt(row.asistencia, 10) : 0;
    const notaVal = row.nota_final === '---' || !row.nota_final ? 0 : parseVal(row.nota_final);

    let newSit = '';
    const dictado = selectedPlantilla?.dictado || selectedMateria?.dictado || '';
    let formato = selectedMateria?.formato?.toUpperCase() || '';

    // Fallback if materia has no format but template does
    if (!formato && selectedPlantilla) {
      const pName = selectedPlantilla.nombre.toUpperCase();
      if (pName.includes('TALLER')) formato = 'TALLER';
      else if (pName.includes('SEMINARIO')) formato = 'SEMINARIO';
      else if (pName.includes('ASIGNATURA')) formato = 'ASIGNATURA';
      else if (pName.includes('MODULO')) formato = 'MODULO';
      else if (pName.includes('LABORATORIO')) formato = 'LABORATORIO';
    }

    const isAnual = dictado === 'ANUAL';
    const is1C = dictado === '1C' || dictado === '1° Cuatrimestre';
    const is2C = dictado === '2C' || dictado === '2° Cuatrimestre';

    // Logic groups
    const isTallerGroup = ['TAL', 'TALLER', 'SEM', 'SEMINARIO', 'LAB', 'LABORATORIO', 'PRA', 'PRACTICA'].includes(formato || '');
    const isAsignaturaGroup = ['ASI', 'ASIGNATURA'].includes(formato || '');
    const isModuloGroup = ['MOD', 'MODULO'].includes(formato || '');

    // LÓGICA STRICTA PARA MODULO/ASIGNATURA/TALLER
    console.log(`[DEBUG] Row ${index} | Formato: ${formato} | Dictado: ${dictado} | Asistencia: ${asistencia} (Raw: ${row.asistencia}) | TallerGroup: ${isTallerGroup}`);
    console.log(`[DEBUG] Datos:`, row.datos, ` | Final: ${row.nota_final}`);

    // Thresholds
    // Modulo/Anual -> 65%
    // Others (Asignatura, Taller 1C/2C) -> 60%? 
    // Usually Taller requires high attendance (80%), but user mentioned 5% failing, so let's enforce the low limit first.
    // Thresholds
    // User requested "libre I que debe ser menor a 65".
    // We unify the threshold to 65 for all formats to be consistent with this request.
    const thresholdRegular = 65;

    if (isModuloGroup || isAsignaturaGroup || isTallerGroup) {
      if (asistencia < 30) {
        newSit = 'LIBRE-AT';
      } else if (asistencia < thresholdRegular) {
        newSit = 'LIBRE-I';
      } else {
        // Attendance OK -> Check Grades
        let desaprobado = false;

        // Define keys based on dictado
        if (isAnual) {
          const tpFinal = parseVal(row.datos?.tp_final);
          const tp1 = parseVal(row.datos?.tp_1c);
          const tp2 = parseVal(row.datos?.tp_2c);

          const hasTpFinal = row.datos && 'tp_final' in row.datos;
          const hasTp1 = row.datos && 'tp_1c' in row.datos;
          const hasTp2 = row.datos && 'tp_2c' in row.datos;

          // Fail if any TP exists and is < 6
          if (hasTpFinal && tpFinal < 6) desaprobado = true;
          if (hasTp1 && tp1 < 6) desaprobado = true;
          if (hasTp2 && tp2 < 6) desaprobado = true;

          const p1 = parseVal(row.datos?.parcial_1p);
          const r1 = parseVal(row.datos?.parcial_1r);
          const p2 = parseVal(row.datos?.parcial_2p);
          const r2 = parseVal(row.datos?.parcial_2r);

          // Check Parciales only if NOT Taller/Lab/Seminario
          if (!isTallerGroup) {
            if (Math.max(p1, r1) < 6) desaprobado = true;
            if (Math.max(p2, r2) < 6) desaprobado = true;
          }
        } else if (is1C) {
          const tp = parseVal(row.datos?.tp_1c);
          const p = parseVal(row.datos?.parcial_1p);
          const r = parseVal(row.datos?.parcial_1r);

          if (tp < 6) desaprobado = true;
          if (!isTallerGroup && Math.max(p, r) < 6) desaprobado = true;
        } else if (is2C) {
          const tp = parseVal(row.datos?.tp_2c);
          const p = parseVal(row.datos?.parcial_2p);
          const r = parseVal(row.datos?.parcial_2r);

          if (tp < 6) desaprobado = true;
          if (!isTallerGroup && Math.max(p, r) < 6) desaprobado = true;
        }

        // Global Final Note Check
        if (notaVal < 6) desaprobado = true;

        if (desaprobado) {
          // Determine specific failure status
          let specificStatus = 'DESAPROBADO_PA'; // Default to Parcial fail

          const tp1 = parseVal(row.datos?.tp_1c);
          const tp2 = parseVal(row.datos?.tp_2c);
          const tpFinal = parseVal(row.datos?.tp_final);

          // If failure is due to TP, switch to DESAPROBADO_TP
          if (is1C && tp1 < 6) specificStatus = 'DESAPROBADO_TP';
          else if (is2C && tp2 < 6) specificStatus = 'DESAPROBADO_TP';
          else if (isAnual) {
            if ((row.datos && 'tp_final' in row.datos && tpFinal < 6) ||
              (row.datos && 'tp_1c' in row.datos && tp1 < 6) ||
              (row.datos && 'tp_2c' in row.datos && tp2 < 6)) {
              specificStatus = 'DESAPROBADO_TP';
            }
          }

          // Taller/Lab failure is always TP related (since no exams)
          if (isTallerGroup) specificStatus = 'DESAPROBADO_TP';

          newSit = specificStatus;
        } else {
          // Passed
          if (isTallerGroup) {
            // Taller/Seminario/Lab -> Direct Approval
            newSit = 'APROBADO';
          } else if (isModuloGroup) {
            // MÓDULO LOGIC: Check for PROMOCIÓN (Art 63)
            // 1. Asistencia >= 80%
            // 2. Parciales >= 8 in FIRST INSTANCE (P). Taking Recuperatorio loses promotion.
            // 3. TPs Approved (already checked above to reach this block)

            let promo = false;
            if (asistencia >= 80) {
              if (isAnual) {
                const p1 = parseVal(row.datos?.parcial_1p);
                const p2 = parseVal(row.datos?.parcial_2p);
                // Must have >= 8 in both P instances to promote
                if (p1 >= 8 && p2 >= 8) promo = true;
              } else if (is1C) {
                const p = parseVal(row.datos?.parcial_1p);
                if (p >= 8) promo = true;
              } else if (is2C) {
                const p = parseVal(row.datos?.parcial_2p);
                if (p >= 8) promo = true;
              }
            }

            newSit = promo ? 'PROMOCION' : 'REGULAR';
          } else {
            // Asignatura -> Regularity
            newSit = 'REGULAR';
          }
        }
      }
    }

    // Normalización de Códigos (PRO -> PROMOCIONADO, etc)
    const validCodes = situacionesDisponibles.map(s => s.codigo);

    // Helper to find best matching code
    const findCode = (search: string) => {
      const found = situacionesDisponibles.find(s =>
        s.codigo === search ||
        s.label.toUpperCase() === search ||
        s.label.toUpperCase().includes(search)
      );
      return found ? found.codigo : search;
    };

    if (newSit === 'APROBADO') {
      newSit = findCode('APROBADO'); // Tries to find matching code for APROBADO
    }

    // Mapeo de códigos cortos a largos si es necesario
    const mapCode = (short: string, long: string) => {
      if (newSit === short && !validCodes.includes(short) && validCodes.includes(long)) {
        newSit = long;
      } else if (newSit === long && !validCodes.includes(long) && validCodes.includes(short)) {
        newSit = short;
      }
    }

    mapCode('PRO', 'PROMOCIONADO');
    mapCode('REG', 'REGULAR');
    mapCode('LIBRE', 'LIBRE-I'); // Default libre
    mapCode('APR', 'APROBADO'); // Try to map common abbreviations

    // If still not valid, try to find by name similar to strictly what we have
    if (!validCodes.includes(newSit)) {
      // Last resort lookup
      const similar = situacionesDisponibles.find(s => s.label.toUpperCase().includes(newSit.replace(/_/g, ' ')));
      if (similar) newSit = similar.codigo;
    }

    if (newSit !== row.situacion) {
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
                      onChange={(e) => {
                        field.onChange(e);
                        // Solo recalculamos automáticamente en modo creación.
                        // En edición, respetamos lo que viene de DB a menos que el usuario pulse el botón.
                        if (mode === 'create') {
                          setTimeout(() => {
                            filaFields.forEach((_, idx) => calculateSituacionForRow(idx));
                          }, 100);
                        }
                      }}
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

                    {/* Render Groups for Dynamic Columns */}
                    {(() => {
                      const groups: { name: string; span: number }[] = [];
                      let currentGroup = '';
                      let currentSpan = 0;

                      // Agrupar columnas
                      columnasDinamicas.forEach((col: any) => {
                        // Usar un espacio si no hay grupo para evitar problemas
                        const gName = col.group || '';
                        if (gName !== currentGroup) {
                          if (currentSpan > 0) groups.push({ name: currentGroup, span: currentSpan });
                          currentGroup = gName;
                          currentSpan = 1;
                        } else {
                          currentSpan++;
                        }
                      });
                      if (currentSpan > 0) groups.push({ name: currentGroup, span: currentSpan });

                      // Si no hay grupos definidos (legacy), fallback a un solo header
                      if (groups.length === 0 && columnasDinamicas.length > 0) {
                        return (
                          <TableCell
                            sx={{ ...headerCellSx, textAlign: 'center' }}
                            colSpan={columnasDinamicas.length}
                          >
                            Nota de trabajos prácticos
                          </TableCell>
                        );
                      }

                      // Renderizar headers de grupo
                      return groups.map((g, idx) => (
                        <TableCell
                          key={`group-${idx}`}
                          sx={{ ...headerCellSx, textAlign: 'center' }}
                          colSpan={g.span}
                        >
                          {g.name}
                        </TableCell>
                      ));
                    })()}

                    <TableCell sx={{ ...headerCellSx, width: 80, textAlign: 'center' }} rowSpan={2}>
                      Final
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 80, textAlign: 'center' }} rowSpan={2}>
                      Asistencia
                    </TableCell>
                    <TableCell sx={{ ...headerCellSx, width: 70, textAlign: 'center' }} rowSpan={2}>
                      Excep.
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
                    {/* Las columnas estáticas (Final, Asistencia...) ya tienen rowSpan=2 arriba, 
                        así que no agregamos celdas aquí */}
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
                            render={({ field: controllerField }) => {
                              const isRecuperatorio = col.key.endsWith('r');
                              let disabled = isReadOnly;
                              let softDisabled = false;

                              if (!isReadOnly && isRecuperatorio) {
                                const pKey = col.key.slice(0, -1) + 'p';
                                const pVal = getValues(`filas.${index}.datos.${pKey}`);
                                if (pVal && String(pVal).trim() !== '' && String(pVal) !== '---' && Number(String(pVal).replace(',', '.')) >= 6) {
                                  softDisabled = true;
                                }
                              }

                              const isBlocked = disabled || softDisabled;

                              return (
                                <TextField
                                  {...controllerField}
                                  value={controllerField.value ?? ''}
                                  size="small"
                                  fullWidth
                                  inputProps={{
                                    sx: {
                                      textAlign: 'center',
                                      px: 0.5,
                                      ...(softDisabled ? { backgroundColor: '#f5f5f5', color: '#a0a0a0', cursor: 'not-allowed' } : {})
                                    },
                                    maxLength: 3,
                                    readOnly: softDisabled,
                                    tabIndex: softDisabled ? -1 : undefined
                                  }}
                                  onBlur={() => calculateSituacionForRow(index)}
                                  onChange={(e) => {
                                    if (softDisabled) return; // double safety
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
                                  disabled={disabled} // Hard disabled only for global readonly
                                />
                              );
                            }}
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
                              onBlur={(e) => handleAsistenciaBlur(index, e)}
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
                            const isModulo = ['MOD', 'MODULO'].includes(formato || '');
                            // Deshabilitar si es View o si el formato no admite excepción 
                            // Para MOD deshabilitamos porque la asistencia base ya es 65% y no admite excepción.
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
                      <TableCell sx={{
                        ...bodyCellSx,
                        minWidth: 200,
                        backgroundColor: getSituacionColor(watch(`filas.${index}.situacion`))
                      }}>
                        {isReadOnly ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={(() => {
                              const val = watch(`filas.${index}.situacion`);

                              // Paridad con PDF: AUJ -> JUS
                              if (val === 'AUJ') return 'JUS';

                              // 1. Intentar buscar label en situacionesDisponibles (metadata dinámica)
                              const match = situacionesDisponibles.find(
                                (s) => s.codigo.toString().toLowerCase() === (val || '').toString().toLowerCase()
                              );
                              if (match && match.label) return match.label;

                              // 2. Fallback a mapa estático (simula comportamiento del PDF backend)
                              const staticDesc = SITUACION_DESCRIPTIONS[(val || '').toUpperCase()];
                              if (staticDesc) return staticDesc;

                              return val;
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
