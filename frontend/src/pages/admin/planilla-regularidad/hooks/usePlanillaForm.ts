import React, { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import {
  crearPlanillaRegularidad,
  obtenerPlanillaRegularidadDetalle,
  actualizarPlanillaRegularidad,
  PlanillaRegularidadCreatePayload,
} from '@/api/primeraCarga';
import {
  RegularidadMetadataPlantilla,
  RegularidadMetadataMateria,
  RegularidadMetadataProfesorado,
} from '@/api/primeraCarga';
import { PlanillaFormValues, PlanillaFilaFormValues } from '../types';
import {
  DEFAULT_DOCENTE,
  DEFAULT_DOCENTE_BEDEL,
  buildDefaultRow,
  buildDefaultRows,
  todayIso,
} from '../constants';

interface UsePlanillaFormOptions {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: any, dryRun: boolean) => void;
  planillaId?: number | null;
  mode?: 'create' | 'edit' | 'view';
  selectedProfesorado?: RegularidadMetadataProfesorado;
  selectedMateria?: RegularidadMetadataMateria;
  selectedPlantilla?: RegularidadMetadataPlantilla;
  columnasDinamicas: any[];
  situacionesDisponibles: any[];
  plantillasDisponibles: RegularidadMetadataPlantilla[];
  estudiantePorDni: Map<string, { apellido_nombre: string; profesorados: number[] }>;
  metadataQueryRefetch: () => void;
}

export function usePlanillaForm({
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
}: UsePlanillaFormOptions) {
  const queryClient = useQueryClient();

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

  const detailQuery = useQuery({
    queryKey: ['primera-carga', 'regularidades', 'detalle', planillaId],
    queryFn: () => obtenerPlanillaRegularidadDetalle(planillaId!),
    enabled: open && !!planillaId,
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

  const [persistStudents, setPersistStudents] = React.useState(false);
  const [rowsToAdd, setRowsToAdd] = React.useState<string>('5');

  const mutation = useMutation({
    mutationFn: (payload: PlanillaRegularidadCreatePayload) => {
      if (mode === 'edit' && planillaId) {
        return actualizarPlanillaRegularidad(planillaId, payload);
      }
      return crearPlanillaRegularidad(payload);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['primera-carga', 'regularidades', 'historial'] });
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
        // 1. Guardamos la lista de estudiantes retornada por el servidor (ya tiene los HIS- DNIs creados)
        const serverFilas = data.data?.filas || getValues('filas');
        const preservedFilas = serverFilas.map((f: any, idx: number) => ({
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

  useEffect(() => {
    if (open) {
      metadataQueryRefetch();
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
        docentes: d.docentes.map((doc: any, idx: number) => ({
          docente_id: doc.docente_id,
          nombre: doc.nombre,
          dni: doc.dni || '',
          rol: doc.rol || 'profesor',
          orden: doc.orden ?? (idx + 1)
        })),
        filas: d.filas.map((f: any) => ({
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

  const previewCodigo = useMemo(() => {
    const fechaSeleccionada = getValues('fecha');
    if (!selectedProfesorado || !fechaSeleccionada) {
      return null;
    }
    const day = fechaSeleccionada.replace(/-/g, '');
    return `PRP${String(selectedProfesorado.id).padStart(2, '0')}${selectedProfesorado.acronimo}${day}XXX`;
  }, [selectedProfesorado, getValues]);

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

    // Thresholds
    // Modulo/Anual -> 65%
    // Others (Asignatura, Taller 1C/2C) -> 60%?
    // Usually Taller requires high attendance (80%), but user mentioned 5% failing, so let's enforce the low limit first.
    // Thresholds (Reglamento Académico Art. 24)
    // Taller/Práctica/Laboratorio: 80% (65% con excepción justificada)
    // Asignatura/Módulo: 65% (actual configurado)
    let thresholdRegular = 65;
    if (isTallerGroup) {
      thresholdRegular = row.excepcion ? 65 : 80;
    }

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

  const handleCopyStudents = () => {
    // Obtenemos los alumnos actuales del listado
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
    } catch (err) {
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

      const nuevasFilas = buffer.map((item: any, idx: number) => ({
        ...buildDefaultRow(idx),
        dni: item.dni,
        apellido_nombre: item.apellido_nombre,
        orden: idx + 1
      }));

      replaceFilas(nuevasFilas);
      enqueueSnackbar(`Se pegaron ${nuevasFilas.length} estudiantes desde el buffer.`, { variant: 'success' });
    } catch (err) {
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
  };
}
