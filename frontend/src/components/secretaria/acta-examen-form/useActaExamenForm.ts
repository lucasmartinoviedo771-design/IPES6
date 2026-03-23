import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import {
  ActaEstudiantePayload,
  ActaCreatePayload,
  ActaMetadataDTO,
  MesaResumenDTO,
  buscarMesaPorCodigo,
  crearActaExamen,
  fetchActaMetadata,
  actualizarActaExamen,
  obtenerActa,
} from "@/api/cargaNotas";
import { OralActFormValues } from "@/components/secretaria/OralExamActaDialog";
import { fetchEstudianteAdminDetail } from "@/api/estudiantes";

import { DocenteState, EstudianteState, ActaExamenFormProps } from './types';
import {
  createEmptyDocentes,
  createEmptyEstudiante,
  clasificarNota,
} from './utils';

export function useActaExamenForm({
  strict = true,
  successMessage = "Acta generada correctamente.",
  editId,
}: Pick<ActaExamenFormProps, 'strict' | 'successMessage' | 'editId'>) {
  const queryClient = useQueryClient();
  const metadataQuery = useQuery<ActaMetadataDTO>({
    queryKey: ["acta-examen-metadata"],
    queryFn: fetchActaMetadata,
  });

  const [tipo, setTipo] = useState<"REG" | "LIB">("REG");
  const [profesoradoId, setProfesoradoId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [materiaId, setMateriaId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [folio, setFolio] = useState<string>("");
  const [libro, setLibro] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  const [docentes, setDocentes] = useState<DocenteState[]>(createEmptyDocentes);
  const [estudiantes, setEstudiantes] = useState<EstudianteState[]>([createEmptyEstudiante(1)]);
  const [oralActDrafts, setOralActDrafts] = useState<Record<string, OralActFormValues>>({});
  const [oralDialogEstudiante, setOralDialogEstudiante] = useState<EstudianteState | null>(null);
  const [loadingEstudianteDni, setLoadingEstudianteDni] = useState<string | null>(null);
  const [mesaCodigo, setMesaCodigo] = useState<string>("");
  const [mesaBuscando, setMesaBuscando] = useState(false);
  const [mesaBusquedaError, setMesaBusquedaError] = useState<string | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<MesaResumenDTO | null>(null);
  const [confirmActaOpen, setConfirmActaOpen] = useState(false);
  const [pendingActaPayload, setPendingActaPayload] = useState<ActaCreatePayload | null>(null);
  const [isEditing] = useState(!!editId);
  const [isInitialPopulated, setIsInitialPopulated] = useState(false);

  const { data: actaParaEditar } = useQuery({
    queryKey: ["acta-edicion", editId],
    queryFn: () => obtenerActa(editId!),
    enabled: !!editId,
  });

  const metadata = metadataQuery.data;
  const notaOptions = metadata?.nota_opciones ?? [];

  const profesorados = useMemo(() => {
    const list = [...(metadata?.profesorados ?? [])];
    if (!!editId && actaParaEditar && actaParaEditar.profesorado_id) {
      const alreadyInMetadata = list.some((p) => String(p.id) === String(actaParaEditar.profesorado_id));
      if (!alreadyInMetadata) {
        list.push({
          id: actaParaEditar.profesorado_id,
          nombre: actaParaEditar.profesorado || "Cargando...",
          planes: [
            {
              id: actaParaEditar.plan_id!,
              resolucion: actaParaEditar.plan_resolucion || "Cargando...",
              materias: [
                {
                  id: actaParaEditar.materia_id!,
                  nombre: actaParaEditar.materia || "Cargando...",
                  anio_cursada: actaParaEditar.materia_anio || 1,
                  plan_id: actaParaEditar.plan_id!,
                  plan_resolucion: actaParaEditar.plan_resolucion || ""
                }
              ]
            }
          ],
        });
      }
    }
    const uniqueList: typeof list = [];
    const seen = new Set();
    list.forEach(p => {
      const sid = String(p.id);
      if (!seen.has(sid)) { seen.add(sid); uniqueList.push(p); }
    });
    return uniqueList;
  }, [metadata, actaParaEditar, editId]);

  const docentesDisponibles = metadata?.docentes ?? [];

  const docenteOptions = useMemo(
    () => docentesDisponibles.map((doc) => {
      const labelDni = doc.dni ?? "";
      return labelDni ? `${labelDni} - ${doc.nombre}` : doc.nombre;
    }),
    [docentesDisponibles],
  );

  const selectedProfesorado = useMemo(
    () => profesorados.find((p) => String(p.id) === profesoradoId),
    [profesorados, profesoradoId],
  );

  const planesDisponibles = useMemo(() => {
    const list = [...(selectedProfesorado?.planes ?? [])];
    if (!!editId && actaParaEditar && String(actaParaEditar.profesorado_id) === profesoradoId) {
      if (actaParaEditar.plan_id && !list.some(p => String(p.id) === String(actaParaEditar.plan_id))) {
        list.push({
          id: actaParaEditar.plan_id,
          resolucion: actaParaEditar.plan_resolucion || "Sin definir",
          materias: [
            {
              id: actaParaEditar.materia_id!,
              nombre: actaParaEditar.materia || "Sin definir",
              anio_cursada: actaParaEditar.materia_anio || 1,
              plan_id: actaParaEditar.plan_id!,
              plan_resolucion: actaParaEditar.plan_resolucion || ""
            }
          ]
        });
      }
    }
    return list;
  }, [selectedProfesorado, editId, actaParaEditar, profesoradoId]);

  const selectedPlan = useMemo(
    () => planesDisponibles.find((p) => String(p.id) === planId),
    [planesDisponibles, planId],
  );

  const materiasDisponibles = useMemo(() => {
    const list = [...(selectedPlan?.materias ?? [])];
    if (!!editId && actaParaEditar && String(actaParaEditar.plan_id) === planId) {
      if (actaParaEditar.materia_id && !list.some(m => String(m.id) === String(actaParaEditar.materia_id))) {
        list.push({
          id: actaParaEditar.materia_id,
          nombre: actaParaEditar.materia || "Sin definir",
          anio_cursada: actaParaEditar.materia_anio || 1,
          plan_id: actaParaEditar.plan_id!,
          plan_resolucion: actaParaEditar.plan_resolucion || ""
        });
      }
    }
    return list;
  }, [selectedPlan, editId, actaParaEditar, planId]);

  const selectedMateria = useMemo(
    () => materiasDisponibles.find((m) => String(m.id) === materiaId),
    [materiasDisponibles, materiaId],
  );

  useEffect(() => {
    if (!!editId && actaParaEditar && !isInitialPopulated) {
      if (actaParaEditar.tipo) setTipo(actaParaEditar.tipo as "REG" | "LIB");
      if (actaParaEditar.profesorado_id) setProfesoradoId(String(actaParaEditar.profesorado_id));
      if (actaParaEditar.plan_id) setPlanId(String(actaParaEditar.plan_id));
      if (actaParaEditar.materia_id) setMateriaId(String(actaParaEditar.materia_id));
      if (actaParaEditar.fecha) {
        const parts = actaParaEditar.fecha.split("/");
        setFecha(parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : actaParaEditar.fecha);
      }
      setFolio(actaParaEditar.folio || "");
      setLibro(actaParaEditar.libro || "");
      setObservaciones(actaParaEditar.observaciones || "");
      if (metadata) {
        if (actaParaEditar.docentes && actaParaEditar.docentes.length > 0) {
          const loadedDocentes = actaParaEditar.docentes.map((d: any) => ({
            rol: d.rol, docente_id: Number(d.docente_id) || null,
            nombre: d.nombre || "", dni: d.dni || "", inputValue: d.nombre || "",
          }));
          setDocentes(createEmptyDocentes().map(emptyDoc => {
            const found = loadedDocentes.find(ld => ld.rol === emptyDoc.rol);
            return found || emptyDoc;
          }));
        }
        if (actaParaEditar.estudiantes && actaParaEditar.estudiantes.length > 0) {
          setEstudiantes(
            actaParaEditar.estudiantes.map((e: any, index: number) => ({
              internoId: `${index}-${Date.now()}`,
              numero_orden: e.numero_orden || index + 1,
              permiso_examen: e.permiso_examen || "",
              dni: e.dni,
              apellido_nombre: e.apellido_nombre,
              examen_escrito: e.examen_escrito || "",
              examen_oral: e.examen_oral || "",
              calificacion_definitiva: e.calificacion_definitiva,
              observaciones: e.observaciones || "",
            }))
          );
        }
        setIsInitialPopulated(true);
      }
    }
  }, [editId, actaParaEditar, metadata, isInitialPopulated]);

  useEffect(() => {
    if (!!editId && !isInitialPopulated) return;
    if (!metadata) return;
    if (selectedPlan && !selectedPlan.materias.some((m) => String(m.id) === materiaId)) {
      setMateriaId("");
    }
  }, [selectedPlan, materiaId, editId, isInitialPopulated, metadata]);

  useEffect(() => {
    if (!!editId && !isInitialPopulated) return;
    if (!metadata) return;
    if (selectedProfesorado && !selectedProfesorado.planes.some((p) => String(p.id) === planId)) {
      setPlanId("");
      setMateriaId("");
    }
  }, [selectedProfesorado, planId, editId, isInitialPopulated, metadata]);

  const summary = useMemo(() => {
    const total = estudiantes.length;
    let aprobados = 0; let desaprobados = 0; let ausentes = 0;
    estudiantes.forEach((estudiante) => {
      const categoria = clasificarNota(estudiante.calificacion_definitiva);
      if (categoria === "aprobado") aprobados += 1;
      if (categoria === "desaprobado") desaprobados += 1;
      if (categoria === "ausente") ausentes += 1;
    });
    return { total, aprobados, desaprobados, ausentes };
  }, [estudiantes]);

  const tribunalInfo = useMemo(
    () => ({
      presidente: docentes.find((doc) => doc.rol === "PRES")?.nombre ?? "",
      vocal1: docentes.find((doc) => doc.rol === "VOC1")?.nombre ?? "",
      vocal2: docentes.find((doc) => doc.rol === "VOC2")?.nombre ?? "",
    }),
    [docentes],
  );

  const confirmActaContext = pendingActaPayload
    ? `acta de examen de ${selectedMateria?.nombre ?? "la mesa seleccionada"}`
    : "acta de examen final";

  const mutation = useMutation({
    mutationFn: (payload: ActaCreatePayload) => crearActaExamen(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["acta-examen-metadata"] });
      enqueueSnackbar(response.message || successMessage, { variant: "success" });
      setDocentes(createEmptyDocentes());
      setEstudiantes([createEmptyEstudiante(1)]);
      setFolio(""); setLibro(""); setObservaciones("");
      setPendingActaPayload(null); setConfirmActaOpen(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "No se pudo generar el acta.", { variant: "error" });
    },
  });

  const { mutate: updateMutation, isPending: isUpdating } = useMutation({
    mutationFn: (payload: ActaCreatePayload) => actualizarActaExamen(editId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acta-examen-metadata"] });
      enqueueSnackbar(successMessage || "Acta actualizada correctamente.", { variant: "success" });
      setConfirmActaOpen(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(error?.response?.data?.message || "No se pudo actualizar el acta.", { variant: "error" });
    },
  });

  const isCreating = mutation.isPending;
  const isSaving = isCreating || isUpdating;

  const updateEstudiante = (internoId: string, patch: Partial<EstudianteState>) => {
    setEstudiantes((prev) => prev.map((item) => (item.internoId === internoId ? { ...item, ...patch } : item)));
  };

  const updateDocente = (index: number, patch: Partial<DocenteState>) => {
    setDocentes((prev) => prev.map((doc, idx) => (idx === index ? { ...doc, ...patch } : doc)));
  };

  const applyMesaSeleccionada = (mesa: MesaResumenDTO) => {
    if (mesa.profesorado_id) setProfesoradoId(String(mesa.profesorado_id));
    if (mesa.plan_id) setPlanId(String(mesa.plan_id));
    if (mesa.materia_id) setMateriaId(String(mesa.materia_id));
    if (mesa.fecha) setFecha(dayjs(mesa.fecha).format("YYYY-MM-DD"));
    if (mesa.modalidad === "LIB") setTipo("LIB");
    else if (mesa.modalidad === "REG") setTipo("REG");
    if (mesa.docentes && mesa.docentes.length) {
      setDocentes((prev) => prev.map((doc) => {
        const remoto = mesa.docentes?.find((item) => item.rol === doc.rol);
        if (!remoto) return doc;
        return { ...doc, docente_id: remoto.docente_id ?? null, nombre: remoto.nombre ?? "", dni: remoto.dni ?? "", inputValue: remoto.nombre ?? "" };
      }));
    }
  };

  const handleBuscarMesa = async () => {
    const code = mesaCodigo.trim();
    if (!code) { setMesaBusquedaError("Ingresá un código de mesa."); setMesaSeleccionada(null); return; }
    setMesaBuscando(true); setMesaBusquedaError(null);
    try {
      const encontrada = await buscarMesaPorCodigo(code);
      if (!encontrada) { setMesaSeleccionada(null); setMesaBusquedaError("No se encontró una mesa con ese código."); return; }
      setMesaSeleccionada(encontrada);
      applyMesaSeleccionada(encontrada);
    } catch (error) {
      console.error("No se pudo buscar la mesa", error);
      setMesaBusquedaError("No se pudo buscar la mesa. Intenta nuevamente.");
    } finally {
      setMesaBuscando(false);
    }
  };

  const handleAgregarEstudiante = () => {
    setEstudiantes((prev) => [...prev, createEmptyEstudiante(prev.length + 1)]);
  };

  const handleEliminarEstudiante = (internoId: string) => {
    setEstudiantes((prev) => {
      const filtered = prev.filter((item) => item.internoId !== internoId);
      return filtered.map((item, index) => ({ ...item, numero_orden: index + 1 }));
    });
  };

  const handleEstudianteDniChange = async (internoId: string, dni: string) => {
    const numeric = dni.replace(/\D/g, "").slice(0, 10);
    updateEstudiante(internoId, { dni: numeric, apellido_nombre: "" });
    if (numeric.length < 8) return;
    try {
      setLoadingEstudianteDni(internoId);
      const data = await fetchEstudianteAdminDetail(numeric);
      setEstudiantes((prev) => prev.map((item) =>
        item.internoId === internoId && item.dni === numeric
          ? { ...item, apellido_nombre: `${data.apellido}, ${data.nombre}` }
          : item,
      ));
    } catch (error: any) {
      if (strict) {
        enqueueSnackbar(error?.response?.data?.message || "No se encontró un estudiante con ese DNI.", { variant: "error" });
      } else {
        console.warn("Estudiante no encontrado en el sistema (modo no estricto).");
      }
    } finally {
      setLoadingEstudianteDni((current) => (current === internoId ? null : current));
    }
  };

  const handleOpenOralActa = (estudiante: EstudianteState) => { setOralDialogEstudiante(estudiante); };

  const handleSaveOralActa = async (values: OralActFormValues) => {
    if (!oralDialogEstudiante) return;
    setOralActDrafts((prev) => ({ ...prev, [oralDialogEstudiante.internoId]: values }));
  };

  const handleDocenteInputChange = (index: number, rawValue: string) => {
    const value = rawValue;
    const trimmed = value.trim();
    if (!trimmed) { updateDocente(index, { docente_id: null, dni: "", nombre: "", inputValue: "" }); return; }

    const exactMatch = docentesDisponibles.find((doc) => {
      const label = doc.dni ? `${doc.dni} - ${doc.nombre}` : doc.nombre;
      return label === value;
    });
    if (exactMatch) { updateDocente(index, { docente_id: exactMatch.id, dni: exactMatch.dni || "", nombre: exactMatch.nombre, inputValue: value }); return; }

    const normalized = trimmed.replace(/\s+/g, " ");
    const hyphenIndex = normalized.indexOf("-");
    const dniSegmentRaw = hyphenIndex >= 0 ? normalized.slice(0, hyphenIndex).trim() : normalized;
    const isHist = dniSegmentRaw.toUpperCase().startsWith("HIST-");
    const sanitizedDni = isHist ? dniSegmentRaw : dniSegmentRaw.replace(/\D/g, "");

    if (!isHist && (sanitizedDni.length < 6 || sanitizedDni.length > 9)) {
      if (hyphenIndex === -1 && sanitizedDni.length === 0) { updateDocente(index, { docente_id: null, dni: "", nombre: normalized, inputValue: value }); return; }
      if (sanitizedDni.length !== 8 && sanitizedDni.length !== 7) {
        const nombreOnly = hyphenIndex >= 0 ? normalized.slice(hyphenIndex + 1).trim() : normalized;
        updateDocente(index, { docente_id: null, dni: sanitizedDni, nombre: nombreOnly, inputValue: value }); return;
      }
    }

    const match = docentesDisponibles.find((doc) => {
      const candidateDni = doc.dni ? (doc.dni.toUpperCase().startsWith("HIST-") ? doc.dni : doc.dni.replace(/\D/g, "")) : null;
      return candidateDni === sanitizedDni;
    });
    if (match) { const formattedDni = match.dni ?? sanitizedDni; updateDocente(index, { docente_id: match.id, dni: sanitizedDni, nombre: match.nombre, inputValue: `${formattedDni} - ${match.nombre}` }); return; }

    const nombreFromInput = hyphenIndex >= 0 ? normalized.slice(hyphenIndex + 1).trim() : "";
    const displayValue = nombreFromInput ? `${dniSegmentRaw || sanitizedDni} - ${nombreFromInput}` : value;
    updateDocente(index, { docente_id: null, dni: sanitizedDni, nombre: nombreFromInput, inputValue: displayValue });
  };

  const handleSubmit = () => {
    if (!profesoradoId || !planId || !materiaId) { enqueueSnackbar("Seleccione profesorado, plan y materia.", { variant: "warning" }); return; }
    if (!folio.trim()) { enqueueSnackbar("Ingrese el número de folio del acta.", { variant: "warning" }); return; }
    if (estudiantes.some((estudiante) => !estudiante.calificacion_definitiva)) { enqueueSnackbar("Complete la calificación definitiva en todas las filas.", { variant: "warning" }); return; }
    if (strict && summary.total === 0) { enqueueSnackbar("Debe agregar al menos un estudiante al acta.", { variant: "warning" }); return; }

    const docentesPayload = docentes.map((doc) => ({ rol: doc.rol, docente_id: doc.docente_id ?? null, nombre: doc.nombre.trim(), dni: doc.dni?.trim() || null }));
    const estudiantesPayload: ActaEstudiantePayload[] = estudiantes.map((estudiante, index) => ({
      numero_orden: index + 1, permiso_examen: estudiante.permiso_examen?.trim() || undefined,
      dni: estudiante.dni.trim(), apellido_nombre: estudiante.apellido_nombre.trim(),
      examen_escrito: estudiante.examen_escrito || undefined, examen_oral: estudiante.examen_oral || undefined,
      calificacion_definitiva: estudiante.calificacion_definitiva, observaciones: estudiante.observaciones?.trim() || undefined,
    }));
    const payload: ActaCreatePayload = {
      tipo, profesorado_id: Number(profesoradoId), materia_id: Number(materiaId), fecha,
      folio: folio.trim(), libro: libro.trim() || undefined, observaciones: observaciones.trim() || undefined,
      docentes: docentesPayload, estudiantes: estudiantesPayload,
      total_aprobados: summary.aprobados, total_desaprobados: summary.desaprobados, total_ausentes: summary.ausentes,
    };

    setPendingActaPayload(payload);
    setConfirmActaOpen(true);
  };

  const handleConfirmActaSubmit = () => {
    if (!pendingActaPayload) return;
    if (isEditing) updateMutation(pendingActaPayload);
    else mutation.mutate(pendingActaPayload);
  };

  const handleCancelActaSubmit = () => {
    if (mutation.isPending) return;
    setConfirmActaOpen(false);
    setPendingActaPayload(null);
  };

  return {
    // metadata
    metadataQuery, metadata, notaOptions,
    // form fields
    tipo, setTipo,
    profesoradoId, setProfesoradoId, setPlanId, setMateriaId,
    planId, setPlanId2: setPlanId,
    materiaId,
    fecha, setFecha,
    folio, setFolio,
    libro, setLibro,
    observaciones, setObservaciones,
    // derived
    profesorados, selectedProfesorado, planesDisponibles, selectedPlan, materiasDisponibles, selectedMateria,
    // docentes
    docentes, docenteOptions,
    handleDocenteInputChange,
    // estudiantes
    estudiantes, loadingEstudianteDni, summary,
    handleAgregarEstudiante, handleEliminarEstudiante,
    handleEstudianteDniChange, updateEstudiante,
    // oral
    oralActDrafts, oralDialogEstudiante, setOralDialogEstudiante,
    handleOpenOralActa, handleSaveOralActa,
    // mesa
    mesaCodigo, setMesaCodigo, mesaBuscando, mesaBusquedaError, mesaSeleccionada,
    handleBuscarMesa,
    // confirm
    confirmActaOpen, pendingActaPayload, confirmActaContext,
    handleSubmit, handleConfirmActaSubmit, handleCancelActaSubmit,
    // status
    isEditing, isSaving, tribunalInfo,
  };
}
