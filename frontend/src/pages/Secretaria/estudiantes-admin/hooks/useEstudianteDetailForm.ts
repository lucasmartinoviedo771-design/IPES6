import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { EstudianteAdminDetailDTO } from "@/api/estudiantes";
import { DetailFormValues, DetailDocumentacionForm, EstadoLegajo, normalizeDoc } from "../types";

export function useEstudianteDetailForm() {
  const form = useForm<DetailFormValues>({
    defaultValues: {
      dni: "",
      apellido: "",
      nombre: "",
      telefono: "",
      domicilio: "",
      estado_legajo: "PEN",
      must_change_password: false,
      activo: true,
      fecha_nacimiento: "",
      anio_ingreso: "",
      genero: "",
      observaciones: "",
      cuil: "",
      documentacion: normalizeDoc(),
      curso_introductorio_aprobado: false,
      libreta_entregada: false,
      nacionalidad: "",
      estado_civil: "",
      localidad_nac: "",
      provincia_nac: "",
      pais_nac: "",
      emergencia_telefono: "",
      emergencia_parentesco: "",
      sec_titulo: "",
      sec_establecimiento: "",
      sec_fecha_egreso: "",
      sec_localidad: "",
      sec_provincia: "",
      sec_pais: "",
      sup1_titulo: "",
      sup1_establecimiento: "",
      sup1_fecha_egreso: "",
      sup1_localidad: "",
      sup1_provincia: "",
      sup1_pais: "",
      cud_informado: false,
      condicion_salud_informada: false,
      condicion_salud_detalle: "",
      trabaja: false,
      empleador: "",
      horario_trabajo: "",
      domicilio_trabajo: "",
    },
  });

  return form;
}

export function useAnioIngresoOptions() {
  return useMemo(() => {
    const start = 2010;
    const current = new Date().getFullYear();
    const values: string[] = [];
    for (let year = current; year >= start; year -= 1) {
      values.push(String(year));
    }
    return values;
  }, []);
}

export function useDocumentacionSideEffects(
  docValues: DetailDocumentacionForm,
  setValue: ReturnType<typeof useForm<DetailFormValues>>["setValue"],
  getValues: ReturnType<typeof useForm<DetailFormValues>>["getValues"],
) {
  const mainDocKeys: Array<keyof DetailDocumentacionForm> = [
    "titulo_secundario_legalizado",
    "certificado_titulo_en_tramite",
    "analitico_legalizado",
  ];

  const anyMainSelected = docValues.es_certificacion_docente
    ? false
    : mainDocKeys.some((key) => Boolean(docValues[key]));

  useEffect(() => {
    if (!docValues.es_certificacion_docente) {
      if (docValues.titulo_terciario_univ) {
        setValue("documentacion.titulo_terciario_univ" as const, false, { shouldDirty: true });
      }
      if (docValues.incumbencia) {
        setValue("documentacion.incumbencia" as const, false, { shouldDirty: true });
      }
    } else {
      if (docValues.certificado_alumno_regular_sec) {
        setValue("documentacion.certificado_alumno_regular_sec" as const, false, { shouldDirty: true });
      }
      if (docValues.adeuda_materias) {
        setValue("documentacion.adeuda_materias" as const, false, { shouldDirty: true });
        setValue("documentacion.adeuda_materias_detalle" as const, "", { shouldDirty: true });
        setValue("documentacion.escuela_secundaria" as const, "", { shouldDirty: true });
      }
    }
  }, [
    docValues.es_certificacion_docente,
    docValues.titulo_terciario_univ,
    docValues.incumbencia,
    docValues.certificado_alumno_regular_sec,
    docValues.adeuda_materias,
    setValue,
  ]);

  useEffect(() => {
    if (!docValues) return;

    const docs_base = [
      docValues.dni_legalizado,
      docValues.certificado_salud,
      docValues.fotos_4x4,
      docValues.folios_oficio,
    ];

    let isComplete = false;

    if (docValues.es_certificacion_docente) {
      isComplete = docs_base.every(Boolean) && docValues.titulo_terciario_univ && docValues.incumbencia;
    } else {
      const tituloSecOk = Boolean(docValues.titulo_secundario_legalizado);
      const art7Ok = Boolean(docValues.articulo_7);

      isComplete = docs_base.every(Boolean) && (tituloSecOk || art7Ok);
    }

    const nextEstado: EstadoLegajo = isComplete ? "COM" : "INC";
    const currentEstado = getValues("estado_legajo");

    // Solo actualizar si hay una diferencia real. Comparamos como strings para evitar fallos del compilador TS.
    if (String(nextEstado) !== String(currentEstado)) {
      setValue("estado_legajo", nextEstado, { shouldDirty: true, shouldValidate: true });
    }
  }, [JSON.stringify(docValues), setValue, getValues]);

  const handleMainDocChange = (target: typeof mainDocKeys[number]) => (_: unknown, checked: boolean) => {
    mainDocKeys.forEach((key) => {
      setValue(`documentacion.${key}` as const, key === target ? checked : false, { shouldDirty: true });
    });
    if (checked) {
      setValue("documentacion.certificado_alumno_regular_sec" as const, false, { shouldDirty: true });
      setValue("documentacion.adeuda_materias" as const, false, { shouldDirty: true });
      setValue("documentacion.adeuda_materias_detalle" as const, "", { shouldDirty: true });
      setValue("documentacion.escuela_secundaria" as const, "", { shouldDirty: true });
    }
  };

  const handleAdeudaChange = (_: unknown, checked: boolean) => {
    setValue("documentacion.adeuda_materias" as const, checked, { shouldDirty: true });
    if (!checked) {
      setValue("documentacion.adeuda_materias_detalle" as const, "", { shouldDirty: true });
      setValue("documentacion.escuela_secundaria" as const, "", { shouldDirty: true });
    }
  };

  const handleEstudianteRegularChange = (_: unknown, checked: boolean) => {
    setValue("documentacion.certificado_alumno_regular_sec" as const, checked, { shouldDirty: true });
  };

  return { anyMainSelected, handleMainDocChange, handleAdeudaChange, handleEstudianteRegularChange };
}

export function usePopulateFormFromDetail(
  detailData: EstudianteAdminDetailDTO | undefined,
  reset: ReturnType<typeof useForm<DetailFormValues>>["reset"],
) {
  useEffect(() => {
    if (detailData) {
      const detail = detailData;
      const extra = detail.datos_extra ?? {};
      const toStringOrEmpty = (value: unknown) => (value === null || value === undefined ? "" : String(value));
      const formValues: DetailFormValues = {
        dni: detail.dni,
        apellido: detail.apellido ?? "",
        nombre: detail.nombre ?? "",
        telefono: detail.telefono ?? "",
        domicilio: detail.domicilio ?? "",
        estado_legajo: (detail.estado_legajo as EstadoLegajo) ?? "PEN",
        must_change_password: false, // El usuario solicitó mantener esto siempre destildado por defecto al abrir.
        activo: detail.activo !== undefined ? detail.activo : true,
        fecha_nacimiento: detail.fecha_nacimiento ? detail.fecha_nacimiento.slice(0, 10) : "",
        anio_ingreso: toStringOrEmpty(extra.anio_ingreso),
        genero: toStringOrEmpty(extra.genero),
        observaciones: toStringOrEmpty(extra.observaciones),
        cuil: toStringOrEmpty(extra.cuil),
        documentacion: normalizeDoc(detail.documentacion),
        curso_introductorio_aprobado: Boolean(detail.curso_introductorio_aprobado),
        libreta_entregada: Boolean(detail.libreta_entregada),

        nacionalidad: toStringOrEmpty(extra.nacionalidad),
        estado_civil: toStringOrEmpty(extra.estado_civil),
        localidad_nac: toStringOrEmpty(extra.localidad_nac),
        provincia_nac: toStringOrEmpty(extra.provincia_nac),
        pais_nac: toStringOrEmpty(extra.pais_nac),
        emergencia_telefono: toStringOrEmpty(extra.emergencia_telefono),
        emergencia_parentesco: toStringOrEmpty(extra.emergencia_parentesco),
        sec_titulo: toStringOrEmpty(extra.sec_titulo),
        sec_establecimiento: toStringOrEmpty(extra.sec_establecimiento),
        sec_fecha_egreso: extra.sec_fecha_egreso ? String(extra.sec_fecha_egreso).slice(0, 10) : "",
        sec_localidad: toStringOrEmpty(extra.sec_localidad),
        sec_provincia: toStringOrEmpty(extra.sec_provincia),
        sec_pais: toStringOrEmpty(extra.sec_pais),
        sup1_titulo: toStringOrEmpty(extra.sup1_titulo),
        sup1_establecimiento: toStringOrEmpty(extra.sup1_establecimiento),
        sup1_fecha_egreso: extra.sup1_fecha_egreso ? String(extra.sup1_fecha_egreso).slice(0, 10) : "",
        sup1_localidad: toStringOrEmpty(extra.sup1_localidad),
        sup1_provincia: toStringOrEmpty(extra.sup1_provincia),
        sup1_pais: toStringOrEmpty(extra.sup1_pais),
        cud_informado: Boolean(extra.cud_informado),
        condicion_salud_informada: Boolean(extra.condicion_salud_informada),
        condicion_salud_detalle: toStringOrEmpty(extra.condicion_salud_detalle),
        trabaja: Boolean(extra.trabaja),
        empleador: toStringOrEmpty(extra.empleador),
        horario_trabajo: toStringOrEmpty(extra.horario_trabajo),
        domicilio_trabajo: toStringOrEmpty(extra.domicilio_trabajo),
      };
      reset(formValues);
    }
  }, [detailData, reset]);
}
