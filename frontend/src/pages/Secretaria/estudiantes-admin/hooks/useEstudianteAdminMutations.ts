import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  updateEstudianteAdmin,
  eliminarEstudianteAdmin,
  resetPasswordEstudiante,
  autorizarRendirEstudiante,
  EstudianteAdminDocumentacionDTO,
} from "@/api/estudiantes";
import { DetailFormValues, DetailDocumentacionForm } from "../types";

export function useUpdateEstudianteMutation(
  selectedDni: string | null,
  onSettled?: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { dni: string; data: Partial<DetailFormValues> }) => {
      const { dni, data } = payload;
      const documentacionPayload: Partial<EstudianteAdminDocumentacionDTO> = {};
      const doc = data.documentacion;
      if (doc) {
        [
          "dni_legalizado",
          "fotos_4x4",
          "certificado_salud",
          "titulo_secundario_legalizado",
          "certificado_titulo_en_tramite",
          "analitico_legalizado",
          "certificado_alumno_regular_sec",
          "adeuda_materias",
          "es_certificacion_docente",
          "titulo_terciario_univ",
          "incumbencia",
          "articulo_7",
        ].forEach((name) => {
          // Cast explícito a keyof DetailDocumentacionForm para acceder a 'doc'
          const key = name as keyof DetailDocumentacionForm;
          if (typeof doc[key] === "boolean") {
            // Cast explícito para asignar al DTO
            (documentacionPayload as any)[name] = doc[key];
          }
        });
        if (typeof doc.folios_oficio === "boolean") {
          documentacionPayload.folios_oficio = doc.folios_oficio ? 3 : 0;
        }
        documentacionPayload.adeuda_materias_detalle = doc.adeuda_materias_detalle.trim()
          ? doc.adeuda_materias_detalle.trim()
          : undefined;
        documentacionPayload.escuela_secundaria = doc.escuela_secundaria.trim()
          ? doc.escuela_secundaria.trim()
          : undefined;
      }

      const payloadData = {
        dni: data.dni?.trim(),
        apellido: data.apellido?.trim() || undefined,
        nombre: data.nombre?.trim() || undefined,
        telefono: data.telefono?.trim() || undefined,
        domicilio: data.domicilio?.trim() || undefined,
        estado_legajo: data.estado_legajo || undefined,
        must_change_password: data.must_change_password,
        activo: typeof data.activo === "boolean" ? data.activo : undefined,
        fecha_nacimiento: data.fecha_nacimiento?.trim() || undefined,
        documentacion: Object.keys(documentacionPayload).length ? documentacionPayload : undefined,
        anio_ingreso: data.anio_ingreso?.trim() || undefined,
        genero: data.genero?.trim() || undefined,
        observaciones: data.observaciones?.trim() || undefined,
        cuil: data.cuil?.trim() || undefined,
        curso_introductorio_aprobado: typeof data.curso_introductorio_aprobado === "boolean"
          ? data.curso_introductorio_aprobado
          : undefined,
        libreta_entregada: typeof data.libreta_entregada === "boolean"
          ? data.libreta_entregada
          : undefined,

        // New fields
        nacionalidad: data.nacionalidad?.trim() || undefined,
        estado_civil: data.estado_civil?.trim() || undefined,
        localidad_nac: data.localidad_nac?.trim() || undefined,
        provincia_nac: data.provincia_nac?.trim() || undefined,
        pais_nac: data.pais_nac?.trim() || undefined,
        emergencia_telefono: data.emergencia_telefono?.trim() || undefined,
        emergencia_parentesco: data.emergencia_parentesco?.trim() || undefined,
        sec_titulo: data.sec_titulo?.trim() || undefined,
        sec_establecimiento: data.sec_establecimiento?.trim() || undefined,
        sec_fecha_egreso: data.sec_fecha_egreso?.trim() || undefined,
        sec_localidad: data.sec_localidad?.trim() || undefined,
        sec_provincia: data.sec_provincia?.trim() || undefined,
        sec_pais: data.sec_pais?.trim() || undefined,
        sup1_titulo: data.sup1_titulo?.trim() || undefined,
        sup1_establecimiento: data.sup1_establecimiento?.trim() || undefined,
        sup1_fecha_egreso: data.sup1_fecha_egreso?.trim() || undefined,
        sup1_localidad: data.sup1_localidad?.trim() || undefined,
        sup1_provincia: data.sup1_provincia?.trim() || undefined,
        sup1_pais: data.sup1_pais?.trim() || undefined,
        cud_informado: data.cud_informado,
        condicion_salud_informada: data.condicion_salud_informada,
        condicion_salud_detalle: data.condicion_salud_detalle?.trim() || undefined,
        trabaja: data.trabaja,
        empleador: data.empleador?.trim() || undefined,
        horario_trabajo: data.horario_trabajo?.trim() || undefined,
        domicilio_trabajo: data.domicilio_trabajo?.trim() || undefined,
      };

      return updateEstudianteAdmin(dni, payloadData);
    },
    onSuccess: () => {
      enqueueSnackbar("Estudiante actualizado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] });
      if (selectedDni) {
        queryClient.invalidateQueries({ queryKey: ["admin-estudiante", selectedDni] });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "No se pudo actualizar";
      enqueueSnackbar(message, { variant: "error" });
    },
  });
}

export function useDeleteEstudianteMutation(
  onSuccess: () => void,
  onError: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dni: string) => eliminarEstudianteAdmin(dni),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Estudiante eliminado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] });
      onSuccess();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message || "No se pudo eliminar";
      enqueueSnackbar(msg, { variant: "error" });
      onError();
    },
  });
}
export function useResetPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dni: string) => resetPasswordEstudiante(dni),
    onSuccess: (res: any) => {
      enqueueSnackbar(res.message || "Contraseña reseteada correctamente", {
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-estudiante"] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "No se pudo resetear la contraseña";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });
}

export function useAutorizarRendirMutation(selectedDni: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ autorizado, observacion }: { autorizado: boolean; observacion: string }) =>
      autorizarRendirEstudiante(selectedDni!, { autorizado, observacion: observacion || null }),
    onSuccess: (res: any) => {
      enqueueSnackbar(res.message || "Autorización actualizada", { variant: "success" });
      if (selectedDni) {
        queryClient.invalidateQueries({ queryKey: ["admin-estudiante", selectedDni] });
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "No se pudo actualizar la autorización";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });
}
