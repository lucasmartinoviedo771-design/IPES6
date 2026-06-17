import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { enqueueSnackbar } from 'notistack';
import {
  RegularidadMetadataPlantilla,
  RegularidadMetadataMateria,
  RegularidadMetadataProfesorado,
  PlanillaRegularidadCreatePayload,
  PlanillaRegularidadCreateResult
} from '@/api/primeraCarga';
import { PlanillaFormValues, ColumnaDinamica, SituacionDisponible } from '../types';
import {
  DEFAULT_DOCENTE,
  DEFAULT_DOCENTE_BEDEL,
  buildDefaultRow,
  buildDefaultRows,
  todayIso,
} from '../constants';

import { usePlanillaColumns } from './usePlanillaColumns';
import { usePlanillaCalculations } from './usePlanillaCalculations';
import { usePlanillaQueries } from './usePlanillaQueries';

interface UsePlanillaFormOptions {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: PlanillaRegularidadCreateResult | undefined, dryRun: boolean) => void;
  planillaId?: number | null;
  mode?: 'create' | 'edit' | 'view';
  selectedProfesorado?: RegularidadMetadataProfesorado;
  selectedMateria?: RegularidadMetadataMateria;
  selectedPlantilla?: RegularidadMetadataPlantilla;
  columnasDinamicas: ColumnaDinamica[];
  situacionesDisponibles: SituacionDisponible[];
  plantillasDisponibles: RegularidadMetadataPlantilla[];
  estudiantePorDni: Map<string, { apellido_nombre: string; profesorados: number[] }>;
  metadataQueryRefetch: () => void;
  defaultProfesoradoId?: number;
  defaultMateriaId?: number;
  scope?: 'primera_carga' | 'standard';
  comisionId?: number | null;
}

export function usePlanillaForm(options: UsePlanillaFormOptions) {
  const {
    open,
    onClose,
    onCreated,
    planillaId,
    mode = 'create',
    selectedProfesorado,
    selectedMateria,
    selectedPlantilla,
    columnasDinamicas,
    situacionesDisponibles,
    plantillasDisponibles,
    estudiantePorDni,
    metadataQueryRefetch,
    defaultProfesoradoId,
    defaultMateriaId,
    scope = 'primera_carga',
    comisionId,
  } = options;

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
  } = useForm<PlanillaFormValues>({
    defaultValues: {
      profesoradoId: defaultProfesoradoId ?? '',
      materiaId: defaultMateriaId ?? '',
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
      force_upgrade: false,
    },
  });

  const [persistStudents, setPersistStudents] = React.useState(false);
  const [rowsToAdd, setRowsToAdd] = React.useState<string>('5');

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchMateriaId = watch('materiaId');
  const watchProfesoradoId = watch('profesoradoId');
  const watchFecha = watch('fecha');

  const watchFechaYear = React.useMemo(() => {
    if (!watchFecha) return new Date().getFullYear();
    const parsed = new Date(watchFecha);
    return isNaN(parsed.getFullYear()) ? new Date().getFullYear() : parsed.getFullYear();
  }, [watchFecha]);

  const { detailQuery, inscriptosActivosQuery, docentesDefectoQuery, mutation } = usePlanillaQueries({
    open,
    scope,
    planillaId,
    comisionId,
    defaultProfesoradoId,
    defaultMateriaId,
    mode,
    watchMateriaId,
    watchProfesoradoId,
    watchFechaYear,
    onClose,
    onCreated,
    getValues,
    setValue,
    persistStudents,
  });

  const { localColumnasDinamicas, localSituacionesDisponibles } = usePlanillaColumns({
    scope,
    detailData: detailQuery.data?.data,
    columnasDinamicas,
    situacionesDisponibles,
  });

  const { previewCodigo, calculateSituacionForRow } = usePlanillaCalculations({
    selectedProfesorado,
    selectedMateria,
    selectedPlantilla,
    localSituacionesDisponibles,
    getValues,
    setValue,
  });

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

  const inscriptosActivos = inscriptosActivosQuery.data;
  const docentesDefecto = docentesDefectoQuery.data;

  useEffect(() => {
    if (mode === 'create' && inscriptosActivos && inscriptosActivos.length > 0 && scope === 'primera_carga') {
      const nuevasFilas = inscriptosActivos.map((student, idx) => ({
        ...buildDefaultRow(idx),
        dni: student.dni,
        apellido_nombre: student.apellido_nombre,
        orden: idx + 1,
      }));
      replaceFilas(nuevasFilas);
      enqueueSnackbar(`Se auto-completó con ${nuevasFilas.length} alumnos activos inscriptos.`, { variant: 'info' });
    } else if (mode === 'create' && inscriptosActivos && inscriptosActivos.length === 0 && scope === 'primera_carga') {
      replaceFilas(buildDefaultRows());
    }
  }, [inscriptosActivos, mode, replaceFilas, scope]);

  useEffect(() => {
    if ((mode === 'create' || scope === 'standard') && docentesDefecto && docentesDefecto.length > 0) {
      const nuevosDocentes = docentesDefecto.map((doc, idx) => ({
        docente_id: doc.docente_id,
        nombre: doc.nombre,
        dni: doc.dni || '',
        rol: doc.rol || 'profesor',
        orden: doc.orden ?? (idx + 1),
      }));
      replaceDocente(nuevosDocentes);
    }
  }, [docentesDefecto, mode, scope, replaceDocente]);

  useEffect(() => {
    if (open) {
      metadataQueryRefetch();
      if (mode === 'create') {
        reset({
          profesoradoId: defaultProfesoradoId ?? '',
          materiaId: defaultMateriaId ?? '',
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
          force_upgrade: false,
        });
      }
    }
    if (!open) {
      reset();
    }
  }, [open, defaultProfesoradoId, defaultMateriaId, mode, metadataQueryRefetch, reset]);

  useEffect(() => {
    if (open && detailQuery.data?.data) {
      const d = detailQuery.data.data;
      reset({
        profesoradoId: (d.profesorado_id ? Number(d.profesorado_id) : '') as number | '',
        materiaId: (d.materia_id ? Number(d.materia_id) : '') as number | '',
        plantillaId: (d.plantilla_id ? Number(d.plantilla_id) : '') as number | '',
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
        filas: d.filas.map((f) => ({
          orden: f.orden ?? null,
          dni: f.dni,
          apellido_nombre: f.apellido_nombre,
          nota_final: f.nota_final?.toString() || '',
          asistencia: f.asistencia?.toString() || '',
          situacion: f.situacion ?? '',
          excepcion: f.excepcion ?? false,
          datos: Object.fromEntries(
            Object.entries(f.datos || {}).map(([k, v]) => [k, v?.toString() ?? ''])
          ) as Record<string, string>,
          inscripcion_id: f.inscripcion_id,
        })),
        dry_run: false,
        force_upgrade: d.force_upgrade ?? false
      });
    }
  }, [detailQuery.data, reset, open]);

  useEffect(() => {
    if (selectedMateria) {
      setValue('planResolucion', selectedMateria.plan_resolucion || '');
      if (mode === 'create') {
        if (plantillasDisponibles.length > 0) {
          setValue('plantillaId', plantillasDisponibles[0].id);
        } else {
          setValue('plantillaId', '');
        }
      } else {
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

  const handleAutoCalculateAll = () => {
    filaFields.forEach((_, index) => {
      calculateSituacionForRow(index);
    });
    enqueueSnackbar('Situaciones académicas calculadas según reglamento.', { variant: 'info' });
  };

  const handleAddRow = () => {
    let count = parseInt(rowsToAdd, 10);
    if (isNaN(count) || count < 1) count = 1;
    const currentLength = filaFields.length;
    const nuevos = Array.from({ length: count }, (_, idx) => buildDefaultRow(currentLength + idx));
    appendFila(nuevos);
  };

  const handleInsertRow = (index: number) => {
    const newRow = buildDefaultRow(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (replaceFilas as any)([
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
      newList.splice(bedelIndex, 0, newDocente);
    } else {
      newList.push(newDocente);
    }

    const orderedList = newList.map((d, i) => ({
      ...d,
      orden: i + 1,
    }));

    replaceDocente(orderedList);
  };

  const handleRemoveDocente = (index: number) => {
    const currentDocentes = getValues('docentes');
    const newList = currentDocentes.filter((_, i) => i !== index);

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

  const handleAsistenciaBlur = (index: number, e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val && val.trim() !== '') {
      const currentRow = getValues(`filas.${index}`);

      if (!currentRow.nota_final) setValue(`filas.${index}.nota_final`, '---', { shouldDirty: true });

      localColumnasDinamicas.forEach((col) => {
        const currentVal = currentRow.datos?.[col.key];
        if (!currentVal || String(currentVal).trim() === '') {
          setValue(`filas.${index}.datos.${col.key}`, '---', { shouldDirty: true });
        }
      });
    }

    calculateSituacionForRow(index);
  };

  const handleCopyStudents = () => {
    const filas = getValues('filas');
    const validos = filas
      .filter(f => f.dni && f.dni.trim() !== '')
      .map(f => ({
        dni: f.dni.trim(),
        apellido_nombre: f.apellido_nombre?.trim() || ''
      }));

    if (validos.length === 0) {
      enqueueSnackbar('No hay estudiantes con DNI cargado para copiar.', { variant: 'warning' });
      return;
    }

    try {
      sessionStorage.setItem('ipes_students_export_buffer', JSON.stringify(validos));
      enqueueSnackbar(`${validos.length} estudiantes copiados al buffer para exportar/reutilizar.`, { variant: 'info' });
    } catch (_err) {
      enqueueSnackbar('Error al acceder al almacenamiento local.', { variant: 'error' });
    }
  };

  const handlePasteStudents = () => {
    try {
      const raw = sessionStorage.getItem('ipes_students_export_buffer');
      if (!raw) {
        enqueueSnackbar('No hay una lista de estudiantes copiada previamente.', { variant: 'warning' });
        return;
      }

      const buffer = JSON.parse(raw);
      if (!Array.isArray(buffer) || buffer.length === 0) {
        enqueueSnackbar('La lista copiada está vacía o es inválida.', { variant: 'warning' });
        return;
      }

      const nuevasFilas = (buffer as Array<{ dni: string; apellido_nombre: string }>).map((item, idx) => ({
        ...buildDefaultRow(idx),
        dni: item.dni,
        apellido_nombre: item.apellido_nombre,
        orden: idx + 1
      }));

      replaceFilas(nuevasFilas);
      enqueueSnackbar(`Se pegaron ${nuevasFilas.length} estudiantes desde el buffer.`, { variant: 'success' });
    } catch (_err) {
      enqueueSnackbar('Error al recuperar la lista de estudiantes.', { variant: 'error' });
    }
  };

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

    if (values.fecha) {
      const year = new Date(values.fecha).getFullYear();
      if (isNaN(year) || year < 1990 || year > 2100) {
        enqueueSnackbar(`La fecha ingresada no es válida: "${values.fecha}". Verificá el año.`, { variant: 'warning' });
        return;
      }
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
      displayIndex: i + 1
    }));

    for (const fila of filasPreparadas) {
      const rowNum = fila.displayIndex;
      if (!fila.dni.trim() && !fila.apellido_nombre.trim()) {
        enqueueSnackbar(`Ingrese el DNI o el Nombre en la fila ${rowNum}.`, { variant: 'warning' });
        return;
      }
      if (!fila.apellido_nombre.trim()) {
        enqueueSnackbar(`Ingrese el nombre del estudiante en la fila ${rowNum}.`, { variant: 'warning' });
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
        localColumnasDinamicas.forEach((col) => {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verifique los datos de las filas cargadas.';
      enqueueSnackbar(message, { variant: 'error' });
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
      profesorado_id: Number(values.profesoradoId || selectedProfesorado?.id),
      materia_id: Number(values.materiaId || selectedMateria?.id),
      plantilla_id: Number(values.plantillaId || selectedPlantilla?.id || 1),
      dictado: selectedPlantilla?.dictado || 'ANUAL',
      fecha: values.fecha,
      folio: values.folio || undefined,
      plan_resolucion: values.planResolucion || selectedMateria?.plan_resolucion || '',
      observaciones: values.observaciones || undefined,
      docentes: docentesPayload,
      filas: filasPayload,
      dry_run: values.dry_run,
      force_upgrade: values.force_upgrade,
    };

    mutation.mutate(payload);
  };

  return {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    detailQuery,
    docenteFields,
    appendDocente,
    removeDocente,
    replaceDocente,
    filaFields,
    appendFila,
    removeFila,
    replaceFilas,
    persistStudents,
    setPersistStudents,
    rowsToAdd,
    setRowsToAdd,
    mutation,
    previewCodigo,
    calculateSituacionForRow,
    handleAutoCalculateAll,
    handleAddRow,
    handleInsertRow,
    handleClearRows,
    handleAddDocente,
    handleRemoveDocente,
    handleStudentDniBlur,
    handleAsistenciaBlur,
    handleCopyStudents,
    handlePasteStudents,
    onSubmit,
    localColumnasDinamicas,
    localSituacionesDisponibles,
  };
}
