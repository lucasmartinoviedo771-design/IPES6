import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import {
  apiGetPreinscripcionByCodigo, apiUpdatePreinscripcion,
  apiConfirmarPreinscripcion, apiObservarPreinscripcion, apiRechazarPreinscripcion, apiCambiarCarrera,
  eliminarPreinscripcion, apiGetChecklist, apiPutChecklist, ChecklistDTO, apiListPreDocs, apiUploadPreDoc,
  PreinscripcionUpdatePayload, listarPreinscripcionesEstudiante, agregarCarreraPreinscripcion,
} from "@/api/preinscripciones";
import { fetchCarreras } from "@/api/carreras";
import { compressImage } from "@/utils/compressImage";
import { PreinscripcionForm } from "../schema";

export function usePreConfirmData(
  codigo: string,
  onActionSuccess?: () => void,
  getSelectedCarreraIsCertDoc?: () => boolean,
) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["preinscripcion", codigo],
    queryFn: () => apiGetPreinscripcionByCodigo(codigo),
  });

  const checklistQ = useQuery<ChecklistDTO | null>({
    queryKey: ["preinscripcion", codigo, "checklist"],
    queryFn: async () => {
      if (!data?.id) return null;
      return await apiGetChecklist(data.id);
    },
    enabled: !!data?.id,
  });

  const carrerasQ = useQuery({ queryKey: ["carreras"], queryFn: fetchCarreras });

  const estudianteDni = data?.estudiante?.dni ?? "";
  const preinsEstudianteQ = useQuery({
    queryKey: ["preinscripciones", "estudiante", estudianteDni],
    queryFn: () => listarPreinscripcionesEstudiante(estudianteDni),
    enabled: !!estudianteDni,
    staleTime: 30_000,
  });

  const docsQ = useQuery({
    queryKey: ["preinscripcion", data?.id, "docs"],
    queryFn: async () => (data?.id ? await apiListPreDocs(data.id) : []),
    enabled: !!data?.id,
  });

  const mUpdate = useMutation({
    mutationFn: (values: PreinscripcionForm) => {
      const {
        nombres, apellido, dni, cuil, email, tel_movil, domicilio, fecha_nacimiento, carrera_id,
        ddjj_ok,
        ...datos_extra
      } = values;

      const isCertDoc = getSelectedCarreraIsCertDoc?.() ?? false;

      const payload: PreinscripcionUpdatePayload = {
        estudiante: {
          dni, nombres, apellido,
          cuil: cuil ? cuil : null,
          genero: values.genero || null,
          email: email || null,
          telefono: tel_movil || null,
          domicilio: domicilio || null,
          fecha_nacimiento: fecha_nacimiento ? fecha_nacimiento : null,
        },
        datos_extra: {
          ...datos_extra,
          nacionalidad: values.nacionalidad || null,
          estado_civil: values.estado_civil || null,
          genero: values.genero || null,
          localidad_nac: values.localidad_nac || null,
          provincia_nac: values.provincia_nac || null,
          pais_nac: values.pais_nac || null,
          tel_fijo: values.tel_fijo || null,
          tel_movil: values.tel_movil || null,
          emergencia_telefono: values.emergencia_telefono || null,
          emergencia_parentesco: values.emergencia_parentesco || null,
        },
        checklist: {
          dni_legalizado: !!values.dni_legalizado,
          fotos_4x4: !!values.fotos_4x4,
          certificado_salud: !!values.certificado_salud,
          folios_oficio: !!values.folios_oficio_ok,
          titulo_secundario_legalizado: !!values.titulo_secundario_legalizado,
          certificado_titulo_en_tramite: !!values.certificado_titulo_en_tramite,
          analitico_legalizado: !!values.analitico_legalizado,
          certificado_alumno_regular_sec: !!values.certificado_alumno_regular_sec,
          adeuda_materias: !!values.adeuda_materias,
          adeuda_materias_detalle: values.adeuda_materias_detalle,
          escuela_secundaria: values.escuela_secundaria,
          titulo_terciario_univ: !!values.titulo_terciario_univ,
          incumbencia: !!values.incumbencia,
          curso_introductorio_aprobado: !!values.curso_introductorio_aprobado,
          libreta_entregada: !!values.libreta_entregada,
          articulo_7: !!values.articulo_7,
          es_certificacion_docente: !!(
            isCertDoc ||
            (checklistQ.data as ChecklistDTO | undefined)?.es_certificacion_docente
          ),
        },
      };

      const payloadExtra = payload.datos_extra as Record<string, unknown> || {};
      if (Object.keys(payloadExtra).length) {
        payload.datos_extra = payloadExtra;
      }

      const carreraValue = Number(carrera_id);
      if (Number.isFinite(carreraValue) && carreraValue > 0) {
        payload.carrera_id = carreraValue;
      }

      return apiUpdatePreinscripcion(codigo, payload);
    },
    onSuccess: () => {
      enqueueSnackbar("Cambios guardados", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo, "checklist"] });
      qc.invalidateQueries({ queryKey: ["preins-busq-sec"] });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
    },
    onError: (err) => {
      console.error("Save error:", err);
      enqueueSnackbar("No se pudo guardar los cambios", { variant: "error" });
    }
  });

  const mUploadFoto = useMutation({
    mutationFn: async (file: File) => {
      if (!data?.id) throw new Error("ID faltante");
      return await apiUploadPreDoc(data.id, "foto4x4", file);
    },
    onSuccess: () => {
      enqueueSnackbar("Foto subida", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", data?.id, "docs"] });
    },
    onError: () => enqueueSnackbar("No se pudo subir la foto", { variant: "error" })
  });

  const mConfirm = useMutation({
    mutationFn: async (checklist: ChecklistDTO) => {
      return apiConfirmarPreinscripcion(codigo, checklist);
    },
    onSuccess: () => {
      enqueueSnackbar("Preinscripción confirmada", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo, "checklist"] });
      qc.invalidateQueries({ queryKey: ["preins-busq-sec"] });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
      onActionSuccess?.();
    },
    onError: () => enqueueSnackbar("No se pudo confirmar", { variant: "error" })
  });

  const mObservar = useMutation({
    mutationFn: (motivo: string) => apiObservarPreinscripcion(codigo, motivo),
    onSuccess: () => {
      enqueueSnackbar("Marcada como observada", { variant: "info" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      onActionSuccess?.();
    },
    onError: () => enqueueSnackbar("No se pudo observar", { variant: "error" })
  });

  const mRechazar = useMutation({
    mutationFn: (motivo: string) => apiRechazarPreinscripcion(codigo, motivo),
    onSuccess: () => {
      enqueueSnackbar("Preinscripción rechazada", { variant: "warning" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      onActionSuccess?.();
    },
    onError: () => enqueueSnackbar("No se pudo rechazar", { variant: "error" })
  });

  const mCambiarCarrera = useMutation({
    mutationFn: (carrera_id: number) => apiCambiarCarrera(codigo, carrera_id),
    onSuccess: () => {
      enqueueSnackbar("Profesorado actualizado", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripcion", codigo] });
      qc.invalidateQueries({ queryKey: ["preinscripciones", "estudiante", estudianteDni] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "No se pudo cambiar el profesorado";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const mDelete = useMutation({
    mutationFn: () => {
      if (!data?.id) throw new Error("ID de preinscripción no encontrado");
      return eliminarPreinscripcion(data.id);
    },
    onSuccess: () => {
      enqueueSnackbar("Preinscripción eliminada permanentemente", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["preinscripciones"] });
      if (onActionSuccess) {
        onActionSuccess();
      } else {
        navigate("/preinscripciones");
      }
    },
    onError: () => enqueueSnackbar("No se pudo eliminar la preinscripción", { variant: "error" })
  });

  const agregarCarreraMutation = useMutation({
    mutationFn: ({ carreraId, anio }: { carreraId: number; anio?: number }) =>
      agregarCarreraPreinscripcion(codigo, carreraId, anio),
    onSuccess: (resp, _vars, _ctx) => {
      enqueueSnackbar((resp as any).message || 'Profesorado agregado', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['preinscripciones', 'estudiante', estudianteDni] });
      if ((resp as any).data?.codigo) {
        navigate(`/secretaria/confirmar-inscripcion?codigo=${(resp as any).data.codigo}`);
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'No se pudo agregar el profesorado';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  return {
    data, isLoading, isError,
    checklistQ, carrerasQ, preinsEstudianteQ, docsQ,
    estudianteDni,
    mUpdate, mUploadFoto, mConfirm, mObservar, mRechazar, mCambiarCarrera, mDelete, agregarCarreraMutation,
  };
}
