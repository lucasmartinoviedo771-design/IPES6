import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteForever";
import DescriptionIcon from "@mui/icons-material/Description";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { enqueueSnackbar } from "notistack";

import {
  fetchEstudiantesAdmin,
  EstudianteAdminListItemDTO,
  EstudianteAdminListResponseDTO,
  fetchEstudianteAdminDetail,
  EstudianteAdminDetailDTO,
  updateEstudianteAdmin,
  eliminarEstudianteAdmin,
  EstudianteAdminDocumentacionDTO,
} from "@/api/estudiantes";
import { fetchCarreras } from "@/api/carreras";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import BackButton from "@/components/ui/BackButton";

type EstadoLegajo = "COM" | "INC" | "PEN" | "";

const ESTADO_OPTIONS: Array<{ value: EstadoLegajo; label: string; color: "success" | "warning" | "default" }> = [
  { value: "", label: "Todos", color: "default" },
  { value: "COM", label: "Completo", color: "success" },
  { value: "INC", label: "Incompleto / Condicional", color: "warning" },
  { value: "PEN", label: "Pendiente", color: "default" },
];

type DetailDocumentacionForm = {
  dni_legalizado: boolean;
  fotos_4x4: boolean;
  certificado_salud: boolean;
  folios_oficio: boolean;
  titulo_secundario_legalizado: boolean;
  certificado_titulo_en_tramite: boolean;
  analitico_legalizado: boolean;
  certificado_alumno_regular_sec: boolean;
  adeuda_materias: boolean;
  adeuda_materias_detalle: string;
  escuela_secundaria: string;
  es_certificacion_docente: boolean;
  titulo_terciario_univ: boolean;
  incumbencia: boolean;
  articulo_7: boolean;
};

type DetailFormValues = {
  dni: string;
  apellido: string;
  nombre: string;
  telefono: string;
  domicilio: string;
  estado_legajo: EstadoLegajo;
  must_change_password: boolean;
  activo: boolean;
  fecha_nacimiento: string;
  anio_ingreso: string;
  genero: string;
  observaciones: string;
  cuil: string;
  documentacion: DetailDocumentacionForm;
  curso_introductorio_aprobado: boolean;
  libreta_entregada: boolean;

  // New fields
  nacionalidad: string;
  estado_civil: string;
  localidad_nac: string;
  provincia_nac: string;
  pais_nac: string;
  emergencia_telefono: string;
  emergencia_parentesco: string;
  sec_titulo: string;
  sec_establecimiento: string;
  sec_fecha_egreso: string;
  sec_localidad: string;
  sec_provincia: string;
  sec_pais: string;
  sup1_titulo: string;
  sup1_establecimiento: string;
  sup1_fecha_egreso: string;
  sup1_localidad: string;
  sup1_provincia: string;
  sup1_pais: string;
  cud_informado: boolean;
  condicion_salud_informada: boolean;
  condicion_salud_detalle: string;
  trabaja: boolean;
  empleador: string;
  horario_trabajo: string;
  domicilio_trabajo: string;
};
const DEFAULT_LIMIT = 100;

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function normalizeDoc(detail?: EstudianteAdminDocumentacionDTO | null): DetailDocumentacionForm {
  return {
    dni_legalizado: Boolean(detail?.dni_legalizado),
    fotos_4x4: Boolean(detail?.fotos_4x4),
    certificado_salud: Boolean(detail?.certificado_salud),
    folios_oficio: Boolean(detail?.folios_oficio),
    titulo_secundario_legalizado: Boolean(detail?.titulo_secundario_legalizado),
    certificado_titulo_en_tramite: Boolean(detail?.certificado_titulo_en_tramite),
    analitico_legalizado: Boolean(detail?.analitico_legalizado),
    certificado_alumno_regular_sec: Boolean(detail?.certificado_alumno_regular_sec),
    adeuda_materias: Boolean(detail?.adeuda_materias),
    adeuda_materias_detalle: detail?.adeuda_materias_detalle ?? "",
    escuela_secundaria: detail?.escuela_secundaria ?? "",
    es_certificacion_docente: Boolean(detail?.es_certificacion_docente),
    titulo_terciario_univ: Boolean(detail?.titulo_terciario_univ),
    incumbencia: Boolean(detail?.incumbencia),
    articulo_7: Boolean(detail?.articulo_7),
  };
}

const estadoColorMap: Record<string, "default" | "success" | "warning"> = {
  COM: "success",
  INC: "warning",
  PEN: "default",
};

const condicionColorMap: Record<string, "default" | "success" | "warning"> = {
  Regular: "success",
  Condicional: "warning",
  Pendiente: "default",
};

export default function EstudiantesAdminPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [estado, setEstado] = useState<EstadoLegajo>("");
  const [carreraId, setCarreraId] = useState<number | "">("");
  const { dni: dniParam } = useParams();
  const [selectedDni, setSelectedDni] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (dniParam) {
      setSelectedDni(dniParam);
      setDetailOpen(true);
    }
  }, [dniParam]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDetailValues, setPendingDetailValues] = useState<DetailFormValues | null>(null);

  const anioIngresoOptions = useMemo(() => {
    const start = 2010;
    const current = new Date().getFullYear();
    const values: string[] = [];
    for (let year = current; year >= start; year -= 1) {
      values.push(String(year));
    }
    return values;
  }, []);

  const generoOptions = [
    { value: "", label: "Sin especificar" },
    { value: "F", label: "Femenino" },
    { value: "M", label: "Masculino" },
    { value: "X", label: "X" },
  ];

  const filters = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      estado_legajo: estado || undefined,
      carrera_id: typeof carreraId === "number" ? carreraId : undefined,
      limit: DEFAULT_LIMIT,
      offset: 0,
    }),
    [debouncedSearch, estado, carreraId],
  );

  const queryClient = useQueryClient();

  const carrerasQuery = useQuery({
    queryKey: ["carreras", "admin"],
    queryFn: () => fetchCarreras(),
    staleTime: 1000 * 60 * 5,
  });

  const listQuery = useQuery<EstudianteAdminListResponseDTO>({
    queryKey: ["admin-estudiantes", filters],
    queryFn: () => fetchEstudiantesAdmin(filters),
    placeholderData: (previousData) => previousData,
  });

  const detailQuery = useQuery<EstudianteAdminDetailDTO>({
    queryKey: ["admin-estudiante", selectedDni],
    queryFn: () => fetchEstudianteAdminDetail(selectedDni || ""),
    enabled: Boolean(selectedDni),
  });

  const updateMutation = useMutation({
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

  const deleteMutation = useMutation({
    mutationFn: (dni: string) => eliminarEstudianteAdmin(dni),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Estudiante eliminado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] });
      handleCloseDetail();
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error.message || "No se pudo eliminar";
      enqueueSnackbar(msg, { variant: "error" });
      setDeleteConfirmOpen(false);
    },
  });

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

  const { reset, control, handleSubmit, watch, setValue, getValues } = form;
  const docValues = watch("documentacion");

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



  useEffect(() => {
    if (detailQuery.data) {
      const detail = detailQuery.data;
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
  }, [detailQuery.data, reset]);

  const onSubmit = (values: DetailFormValues) => {
    if (!selectedDni) return;
    setPendingDetailValues(values);
    setConfirmDialogOpen(true);
  };

  const handleOpenDetail = (dni: string) => {
    setSelectedDni(dni);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDni(null);
    setConfirmDialogOpen(false);
    setDeleteConfirmOpen(false);
    setPendingDetailValues(null);
    form.reset();
  };

  const handleConfirmDetailSave = () => {
    if (!selectedDni || !pendingDetailValues) {
      return;
    }
    updateMutation.mutate(
      { dni: selectedDni, data: pendingDetailValues },
      {
        onSettled: () => {
          setPendingDetailValues(null);
        },
      },
    );
    setConfirmDialogOpen(false);
  };

  const handleCancelDetailSave = () => {
    if (updateMutation.isPending) {
      return;
    }
    setConfirmDialogOpen(false);
    setPendingDetailValues(null);
  };

  const isListLoading = listQuery.isLoading || listQuery.isFetching;
  const estudiantes = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const detailNombre = detailQuery.data
    ? `${detailQuery.data.apellido ?? ""} ${detailQuery.data.nombre ?? ""}`.trim() || detailQuery.data.dni
    : null;
  const confirmContextText = detailNombre
    ? `actualización de los datos del estudiante ${detailNombre}`
    : "actualización de los datos del estudiante";

  const deleteContextText = detailNombre
    ? `eliminación PERMANENTE del estudiante ${detailNombre} y todo su historial relacionado (inscripciones, notas, etc.)`
    : "eliminación permanente de este estudiante";

  const condicionCalculada = detailQuery.data?.condicion_calculada ?? "";

  return (
    <Box p={2} display="flex" flexDirection="column" gap={2}>
      <BackButton fallbackPath="/secretaria" />
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <TextField
          label="Buscar estudiante"
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="DNI, Apellido o Nombre"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filtro-estado">Estado legajo</InputLabel>
          <Select
            labelId="filtro-estado"
            label="Estado legajo"
            value={estado}
            onChange={(event) => setEstado(event.target.value as EstadoLegajo)}
          >
            {ESTADO_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="filtro-carrera">Carrera</InputLabel>
          <Select
            labelId="filtro-carrera"
            label="Carrera"
            value={carreraId}
            onChange={(event) => setCarreraId(event.target.value as number | "")}
          >
            <MenuItem value="">
              Todas
            </MenuItem>
            {(carrerasQuery.data ?? []).map((carrera) => (
              <MenuItem key={carrera.id} value={carrera.id}>
                {carrera.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box flexGrow={1} />
        <Tooltip title="Refrescar">
          <span>
            <IconButton
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] })}
              disabled={isListLoading}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Paper elevation={0}>
        <Box display="flex" alignItems="center" justifyContent="space-between" px={2} py={1.5}>
          <Typography variant="h6" fontWeight={700}>
            Estudiantes ({total})
          </Typography>
          {isListLoading && <CircularProgress size={20} />}
        </Box>
        <Divider />
        {listQuery.isError && (
          <Box p={2}>
            <Alert severity="error">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : "No se pudo cargar el listado."}
            </Alert>
          </Box>
        )}
        {estudiantes.length === 0 && !isListLoading && !listQuery.isError ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary">No se encontraron estudiantes con los filtros seleccionados.</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>DNI</TableCell>
                  <TableCell>Apellido y nombre</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Teléfono</TableCell>
                  <TableCell>Carreras</TableCell>
                  <TableCell>Estado legajo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estudiantes.map((item: EstudianteAdminListItemDTO) => (
                  <TableRow
                    key={item.dni}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => handleOpenDetail(item.dni)}
                  >
                    <TableCell>{item.dni}</TableCell>
                    <TableCell>{`${item.apellido}, ${item.nombre}`}</TableCell>
                    <TableCell>
                      {item.email ? (
                        <Typography
                          component="a"
                          href={`mailto:${item.email}`}
                          color="primary"
                          sx={{ textDecoration: "underline" }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {item.email}
                        </Typography>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{item.telefono || "—"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.carreras.map((carrera) => (
                          <Chip key={carrera} label={carrera} size="small" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={item.estado_legajo_display}
                          color={estadoColorMap[item.estado_legajo] ?? "default"}
                        />
                        {item.activo === false && (
                          <Chip size="small" label="Inactivo" color="error" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={detailOpen}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {detailQuery.data
            ? `Ficha del estudiante ${detailQuery.data.apellido}, ${detailQuery.data.nombre}`
            : "Ficha del estudiante"}
        </DialogTitle>
        <DialogContent dividers>
          {detailQuery.isLoading || detailQuery.isFetching ? (
            <Box p={4} textAlign="center">
              <CircularProgress />
            </Box>
          ) : detailQuery.data ? (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Carreras
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>
                  {detailQuery.data.carreras.map((carrera) => (
                    <Chip key={carrera} label={carrera} size="small" />
                  ))}
                </Stack>
              </Box>

              {condicionCalculada && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Condicion calculada
                  </Typography>
                  <Chip
                    size="small"
                    label={condicionCalculada}
                    color={condicionColorMap[condicionCalculada] ?? "default"}
                  />
                </Stack>
              )}

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Accesos rápidos (Vista estudiante)
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(`/estudiantes/trayectoria?dni=${selectedDni}`, "_blank")}
                  >
                    Trayectoria
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(`/estudiantes/horarios?dni=${selectedDni}`, "_blank")}
                  >
                    Horarios
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(`/estudiantes/inscripcion-materia?dni=${selectedDni}`, "_blank")}
                  >
                    Inscripción
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(`/estudiantes/cambio-comision?dni=${selectedDni}`, "_blank")}
                  >
                    Cambio comisión
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
                    onClick={() => window.open(`/estudiantes/certificado-regular?dni=${selectedDni}`, "_blank")}
                  >
                    Constancia Regular
                  </Button>
                </Stack>
              </Box>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Email"
                  value={detailQuery.data.email || ""}
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  label="Legajo"
                  value={detailQuery.data.legajo || ""}
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Stack>

              <form
                id="estudiante-admin-form"
                onSubmit={handleSubmit(onSubmit)}
              >
                <Stack spacing={2}>
                  <Divider>Datos Personales</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="dni"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="DNI" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="cuil"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="CUIL" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="apellido"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Apellido" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="nombre"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Nombre" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="fecha_nacimiento"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Fecha de nacimiento"
                          size="small"
                          placeholder="DD/MM/AAAA"
                          fullWidth
                        />
                      )}
                    />
                    <Controller
                      name="genero"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Genero" size="small" fullWidth>
                          {generoOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="nacionalidad"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Nacionalidad" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="estado_civil"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Estado Civil" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Divider>Lugar de Nacimiento</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="localidad_nac"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Localidad de Nacimiento" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="provincia_nac"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Provincia de Nacimiento" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="pais_nac"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="País de Nacimiento" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Divider>Contacto y Domicilio</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="telefono"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Teléfono / Celular" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="domicilio"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Domicilio" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="emergencia_telefono"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Teléfono de Emergencia" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="emergencia_parentesco"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Parentesco Emergencia" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Divider>Estudios Secundarios</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="sec_titulo"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Título Secundario" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="sec_establecimiento"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Establecimiento" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="sec_fecha_egreso"
                      control={control}
                      render={({ field }) => (
                        <TextField 
                          {...field} 
                          label="Fecha Egreso" 
                          size="small" 
                          fullWidth 
                          placeholder="DD/MM/AAAA"
                        />
                      )}
                    />
                    <Controller
                      name="sec_localidad"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Localidad" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="sec_provincia"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Provincia" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="sec_pais"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="País" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Divider>Estudios Superiores</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="sup1_titulo"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Título Superior" size="small" fullWidth />
                      )}
                    />
                    <Controller
                      name="sup1_establecimiento"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Establecimiento" size="small" fullWidth />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="sup1_fecha_egreso"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Fecha Egreso" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
                      )}
                    />
                    <Controller
                      name="sup1_localidad"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Localidad" size="small" fullWidth />
                      )}
                    />
                  </Stack>

                  <Divider>Datos Laborales</Divider>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Controller
                      name="trabaja"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="¿Trabaja?"
                        />
                      )}
                    />
                    <Controller
                      name="empleador"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Empleador" size="small" fullWidth disabled={!watch("trabaja")} />
                      )}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="horario_trabajo"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Horario de Trabajo" size="small" fullWidth disabled={!watch("trabaja")} />
                      )}
                    />
                    <Controller
                      name="domicilio_trabajo"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label="Domicilio de Trabajo" size="small" fullWidth disabled={!watch("trabaja")} />
                      )}
                    />
                  </Stack>

                  <Divider>Accesibilidad y Salud</Divider>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Controller
                      name="cud_informado"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Posee CUD"
                        />
                      )}
                    />
                    <Controller
                      name="condicion_salud_informada"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Informa condición de salud"
                        />
                      )}
                    />
                  </Stack>
                  <Controller
                    name="condicion_salud_detalle"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Detalle condición de salud / Apoyo necesario" size="small" multiline rows={2} fullWidth />
                    )}
                  />

                  <Divider>Estado de Legajo y Sistema</Divider>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Controller
                      name="estado_legajo"
                      control={control}
                      render={({ field }) => (
                        <FormControl size="small" fullWidth disabled>
                          <InputLabel>Estado legajo</InputLabel>
                          <Select {...field} label="Estado legajo">
                            {ESTADO_OPTIONS.filter((option) => option.value).map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                    <Controller
                      name="anio_ingreso"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Año de ingreso" size="small" fullWidth>
                          <MenuItem value="">Sin especificar</MenuItem>
                          {anioIngresoOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Controller
                      name="must_change_password"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Forzar cambio de clave"
                        />
                      )}
                    />
                    <Controller
                      name="activo"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} color="primary" />}
                          label="Cuenta Activa"
                        />
                      )}
                    />
                  </Stack>

                  <Controller
                    name="observaciones"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="Observaciones Administrativas" size="small" multiline rows={2} fullWidth />
                    )}
                  />

                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Seguimiento general
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Controller
                        name="curso_introductorio_aprobado"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(field.value)}
                                onChange={(event) => field.onChange(event.target.checked)}
                              />
                            }
                            label="Curso introductorio aprobado"
                          />
                        )}
                      />
                      <Controller
                        name="libreta_entregada"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(field.value)}
                                onChange={(event) => field.onChange(event.target.checked)}
                              />
                            }
                            label="Libreta entregada"
                          />
                        )}
                      />
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Documentación presentada
                    </Typography>

                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Documentos generales
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.dni_legalizado)}
                            onChange={(_, checked) => setValue("documentacion.dni_legalizado" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="DNI legalizado"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.fotos_4x4)}
                            onChange={(_, checked) => setValue("documentacion.fotos_4x4" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="Fotos 4x4 presentes"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.certificado_salud)}
                            onChange={(_, checked) => setValue("documentacion.certificado_salud" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="Certificado de salud"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.folios_oficio)}
                            onChange={(_, checked) => setValue("documentacion.folios_oficio" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="Folios oficio"
                      />
                    </Stack>

                    <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                      Título secundario
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      {docValues.es_certificacion_docente ? (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(docValues.titulo_terciario_univ)}
                              onChange={(_, checked) =>
                                setValue("documentacion.titulo_terciario_univ" as const, checked, { shouldDirty: true })
                              }
                            />
                          }
                          label="Título terciario / universitario"
                        />
                      ) : (
                        <>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(docValues.titulo_secundario_legalizado)}
                                onChange={handleMainDocChange("titulo_secundario_legalizado")}
                              />
                            }
                            label="Título secundario legalizado"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(docValues.certificado_titulo_en_tramite)}
                                onChange={handleMainDocChange("certificado_titulo_en_tramite")}
                              />
                            }
                            label="Certificado título en trámite"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(docValues.analitico_legalizado)}
                                onChange={handleMainDocChange("analitico_legalizado")}
                              />
                            }
                            label="Analítico legalizado"
                          />
                        </>
                      )}
                    </Stack>

                    <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mt: 2 }}>
                      Complementarios
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      {!docValues.es_certificacion_docente && !docValues.articulo_7 && (
                        <>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(docValues.certificado_alumno_regular_sec)}
                                onChange={handleEstudianteRegularChange}
                                disabled={anyMainSelected}
                              />
                            }
                            label="Constancia estudiante regular"
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={Boolean(docValues.adeuda_materias)}
                                onChange={handleAdeudaChange}
                                disabled={anyMainSelected}
                              />
                            }
                            label="Adeuda materias"
                          />
                        </>
                      )}
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.es_certificacion_docente)}
                            onChange={(_, checked) => setValue("documentacion.es_certificacion_docente" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="Trayecto certificación docente"
                      />
                      {docValues.es_certificacion_docente && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(docValues.incumbencia)}
                              onChange={(_, checked) =>
                                setValue("documentacion.incumbencia" as const, checked, { shouldDirty: true })
                              }
                            />
                          }
                          label="Incumbencia"
                        />
                      )}
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(docValues.articulo_7)}
                            onChange={(_, checked) => setValue("documentacion.articulo_7" as const, checked, { shouldDirty: true })}
                          />
                        }
                        label="Mayor de 25 años s/título (Art. 7mo)"
                      />
                    </Stack>

                    {docValues.adeuda_materias && !docValues.es_certificacion_docente && !docValues.articulo_7 && (
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={1}>
                        <Controller
                          name="documentacion.adeuda_materias_detalle"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Detalle adeuda materias"
                              size="small"
                              fullWidth
                            />
                          )}
                        />
                        <Controller
                          name="documentacion.escuela_secundaria"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Escuela secundaria"
                              size="small"
                              fullWidth
                            />
                          )}
                        />
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </form>
            </Stack>
          ) : (
            <Alert severity="error">No se pudo cargar la ficha del estudiante.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={updateMutation.isPending || deleteMutation.isPending}
          >
            Eliminar estudiante
          </Button>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<CloseIcon />} onClick={handleCloseDetail}>
              Cerrar
            </Button>
            <Button
              type="submit"
              form="estudiante-admin-form"
              variant="contained"
              startIcon={updateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : undefined}
              disabled={updateMutation.isPending || deleteMutation.isPending}
            >
              {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
      <FinalConfirmationDialog
        open={confirmDialogOpen}
        onConfirm={handleConfirmDetailSave}
        onCancel={handleCancelDetailSave}
        contextText={confirmContextText}
        loading={updateMutation.isPending}
      />
      <FinalConfirmationDialog
        open={deleteConfirmOpen}
        onConfirm={() => selectedDni && deleteMutation.mutate(selectedDni)}
        onCancel={() => setDeleteConfirmOpen(false)}
        contextText={deleteContextText}
        loading={deleteMutation.isPending}
        confirmColor="error"
        confirmLabel="Sí, eliminar definitivamente"
      />
    </Box>
  );
}
