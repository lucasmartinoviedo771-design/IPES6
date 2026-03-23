import { useEffect } from "react";
import { UseFormReset, UseFormSetValue } from "react-hook-form";
import { PreinscripcionDTO, ChecklistDTO } from "@/api/preinscripciones";
import { PreinscripcionForm } from "../schema";
import { defaultValues as formDefaults } from "../defaultValues";
import { getExtra, toDisplayDate } from "./utils";

export function useFormReset(
  data: PreinscripcionDTO | undefined,
  reset: UseFormReset<PreinscripcionForm>,
) {
  useEffect(() => {
    if (!data) return;
    const extra: Record<string, unknown> = data.datos_extra ?? {};

    const sanitized: PreinscripcionForm = Object.keys(formDefaults).reduce((acc, key) => {
      const k = key as keyof PreinscripcionForm;
      const dv = formDefaults[k];
      const v = getExtra(extra, k);
      const result = acc as Record<string, unknown>;
      if (v === null || v === undefined) {
        result[k] = dv;
      } else if (typeof dv === 'number') {
        const n = typeof v === 'number' ? v : Number(v);
        result[k] = Number.isFinite(n) ? n : dv;
      } else if (typeof dv === 'boolean') {
        if (typeof v === 'boolean') {
          result[k] = v;
        } else {
          const normalized = String(v).trim().toLowerCase();
          if (!normalized) {
            result[k] = dv;
          } else if (
            ['si', 'sí', 'true', '1', 'aprobado', 'aprobada', 'entregado', 'entregada', 'ok', 'presentado'].includes(normalized)
          ) {
            result[k] = true;
          } else if (
            ['no', 'false', '0', 'desaprobado', 'desaprobada', 'no_entregada', 'no entregada', 'noentregada', 'noentregado', 'pendiente', 'ausente'].includes(normalized)
          ) {
            result[k] = false;
          } else {
            result[k] = dv;
          }
        }
      } else if (typeof dv === 'string') {
        result[k] = String(v);
      } else {
        result[k] = v;
      }
      return acc;
    }, { ...formDefaults } as PreinscripcionForm);

    const estudianteDto = data.estudiante;
    sanitized.nombres = String(estudianteDto?.nombres ?? estudianteDto?.nombre ?? formDefaults.nombres);
    sanitized.apellido = String(estudianteDto?.apellido ?? formDefaults.apellido);
    sanitized.dni = String(estudianteDto?.dni ?? sanitized.dni ?? "");
    sanitized.cuil = String(estudianteDto?.cuil ?? getExtra(extra, 'cuil') ?? sanitized.cuil ?? "");
    sanitized.email = String(estudianteDto?.email ?? sanitized.email ?? "");
    sanitized.tel_movil = String(estudianteDto?.telefono ?? sanitized.tel_movil ?? "");
    sanitized.domicilio = String(estudianteDto?.domicilio ?? sanitized.domicilio ?? "");
    const rawBirthDate = estudianteDto?.fecha_nacimiento ?? getExtra(extra, 'fecha_nacimiento') ?? sanitized.fecha_nacimiento ?? "";
    sanitized.fecha_nacimiento = toDisplayDate(String(rawBirthDate));
    sanitized.nacionalidad = String(getExtra(extra, 'nacionalidad') ?? sanitized.nacionalidad ?? "");
    sanitized.estado_civil = String(getExtra(extra, 'estado_civil') ?? sanitized.estado_civil ?? "");
    sanitized.genero = String(getExtra(extra, 'genero') ?? sanitized.genero ?? "");
    sanitized.pais_nac = String(getExtra(extra, 'pais_nac') ?? sanitized.pais_nac ?? "");
    sanitized.provincia_nac = String(getExtra(extra, 'provincia_nac') ?? sanitized.provincia_nac ?? "");
    sanitized.localidad_nac = String(getExtra(extra, 'localidad_nac') ?? sanitized.localidad_nac ?? "");
    sanitized.carrera_id = Number(data.carrera?.id ?? 0);
    const cohorteFallback = getExtra(extra, 'cohorte') ?? data.anio ?? formDefaults.cohorte ?? "";
    sanitized.cohorte = cohorteFallback ? String(cohorteFallback) : String(new Date().getFullYear());

    const fotoExtra =
      getExtra(extra, 'foto_dataUrl') ||
      getExtra(extra, 'foto_4x4_dataurl') ||
      data.foto_4x4_dataurl ||
      null;
    sanitized.foto_dataUrl = fotoExtra ? String(fotoExtra) : "";
    const fotoWExtra = getExtra(extra, 'fotoW') ?? getExtra(extra, 'foto_4x4_w');
    const fotoHExtra = getExtra(extra, 'fotoH') ?? getExtra(extra, 'foto_4x4_h');
    const parsedW = Number(fotoWExtra);
    const parsedH = Number(fotoHExtra);
    sanitized.fotoW = Number.isFinite(parsedW) ? parsedW : undefined;
    sanitized.fotoH = Number.isFinite(parsedH) ? parsedH : undefined;

    reset(sanitized as any);
  }, [data, reset]);
}

export function useChecklistPrefill(
  checklistData: ChecklistDTO | null | undefined,
  setValue: UseFormSetValue<PreinscripcionForm>,
) {
  useEffect(() => {
    const cl = checklistData as ChecklistDTO | null | undefined;
    if (!cl) return;
    setValue("dni_legalizado", !!cl.dni_legalizado, { shouldDirty: false });
    setValue("fotos_4x4", !!cl.fotos_4x4, { shouldDirty: false });
    setValue("folios_oficio_ok", !!cl.folios_oficio, { shouldDirty: false });
    setValue("certificado_salud", !!cl.certificado_salud, { shouldDirty: false });
    setValue("titulo_secundario_legalizado", !!cl.titulo_secundario_legalizado, { shouldDirty: false });
    setValue("certificado_titulo_en_tramite", !!cl.certificado_titulo_en_tramite, { shouldDirty: false });
    setValue("analitico_legalizado", !!cl.analitico_legalizado, { shouldDirty: false });
    setValue("certificado_alumno_regular_sec", !!cl.certificado_alumno_regular_sec, { shouldDirty: false });
    setValue("adeuda_materias", !!cl.adeuda_materias, { shouldDirty: false });
    setValue("titulo_terciario_univ", !!cl.titulo_terciario_univ, { shouldDirty: false });
    setValue("incumbencia", !!cl.incumbencia, { shouldDirty: false });
    setValue("adeuda_materias_detalle", cl.adeuda_materias_detalle || "", { shouldDirty: false });
    setValue("escuela_secundaria", cl.escuela_secundaria || "", { shouldDirty: false });
    setValue("curso_introductorio_aprobado", !!cl.curso_introductorio_aprobado, { shouldDirty: false });
    setValue("libreta_entregada", !!cl.libreta_entregada, { shouldDirty: false });
    setValue("articulo_7", !!cl.articulo_7, { shouldDirty: false });
  }, [checklistData, setValue]);
}
