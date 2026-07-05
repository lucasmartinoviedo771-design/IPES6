import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchEstudiantesAdmin,
  EstudianteAdminListResponseDTO,
  fetchEstudianteAdminDetail,
  EstudianteAdminDetailDTO,
} from "@/api/estudiantes";
import { fetchCarreras } from "@/api/carreras";
import FinalConfirmationDialog from "@/components/ui/FinalConfirmationDialog";
import BackButton from "@/components/ui/BackButton";
import { useAuth } from "@/context/AuthContext";
import { hasCapability } from "@/utils/roles";

import { EstadoLegajo, EstadoAcademico, DetailFormValues, DEFAULT_LIMIT } from "./estudiantes-admin/types";
import { useDebouncedValue } from "./estudiantes-admin/hooks/useDebouncedValue";
import {
  useUpdateEstudianteMutation,
  useDeleteEstudianteMutation,
} from "./estudiantes-admin/hooks/useEstudianteAdminMutations";
import {
  useEstudianteDetailForm,
  useAnioIngresoOptions,
  useDocumentacionSideEffects,
  usePopulateFormFromDetail,
} from "./estudiantes-admin/hooks/useEstudianteDetailForm";
import { useResetPasswordMutation, useAutorizarRendirMutation, useAgregarCarreraMutation } from "./estudiantes-admin/hooks/useEstudianteAdminMutations";
import { EstudiantesFilterBar } from "./estudiantes-admin/components/EstudiantesFilterBar";
import { EstudiantesTable } from "./estudiantes-admin/components/EstudiantesTable";
import { EstudianteDetailDialog } from "./estudiantes-admin/components/EstudianteDetailDialog";
import { AgregarEstudianteExternoPanel } from "./estudiantes-admin/components/AgregarEstudianteExternoPanel";

export default function EstudiantesAdminPage() {
  const { user } = useAuth();
  const isReadOnly = !hasCapability(user, "editar_estudiantes");
  const isAdminOrSec = !isReadOnly;
  const isRectorado = isReadOnly;
  const isAttp = isReadOnly;
  const canResetPassword = hasCapability(user, "resetear_password_estudiante");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [estado, setEstado] = useState<EstadoLegajo>("");
  const [estadoAcademico, setEstadoAcademico] = useState<EstadoAcademico>("");
  const [carreraId, setCarreraId] = useState<number | "">("");
  const [anioIngreso, setAnioIngreso] = useState<number | "">("");
  const { dni: dniParam } = useParams();
  const [selectedDni, setSelectedDni] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    if (dniParam) {
      setSelectedDni(dniParam);
      setDetailOpen(true);
    }
  }, [dniParam]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, estado, estadoAcademico, carreraId, anioIngreso]);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDetailValues, setPendingDetailValues] = useState<DetailFormValues | null>(null);

  // Nuevo estado para el modal de advertencia de materias
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeEnrollmentsWarning, setActiveEnrollmentsWarning] = useState<any[] | null>(null);

  const anioIngresoOptions = useAnioIngresoOptions(carreraId);

  const filters = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      estado_legajo: estado || undefined,
      estado_academico: estadoAcademico || undefined,
      carrera_id: typeof carreraId === "number" ? carreraId : undefined,
      anio_ingreso: typeof anioIngreso === "number" ? anioIngreso : undefined,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    }),
    [debouncedSearch, estado, estadoAcademico, carreraId, anioIngreso, page, rowsPerPage],
  );

  const queryClient = useQueryClient();

  const { data: carrerasData } = useQuery({
    queryKey: ["carreras", "admin"],
    queryFn: () => fetchCarreras(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: listData } = useQuery<EstudianteAdminListResponseDTO>({
    queryKey: ["admin-estudiantes", filters],
    queryFn: () => fetchEstudiantesAdmin(filters),
    placeholderData: (previousData) => previousData,
  });

  const { data: detailData } = useQuery<EstudianteAdminDetailDTO>({
    queryKey: ["admin-estudiante", selectedDni],
    queryFn: () => fetchEstudianteAdminDetail(selectedDni || ""),
    enabled: Boolean(selectedDni),
  });

  const form = useEstudianteDetailForm();
  const { reset, control, handleSubmit, watch, setValue, getValues } = form;

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDni(null);
    setConfirmDialogOpen(false);
    setDeleteConfirmOpen(false);
    setPendingDetailValues(null);
    setActiveEnrollmentsWarning(null);
    form.reset();
  };

  const updateMutation = useUpdateEstudianteMutation(selectedDni);
  const deleteMutation = useDeleteEstudianteMutation(handleCloseDetail, () =>
    setDeleteConfirmOpen(false),
  );
  const resetPassMutation = useResetPasswordMutation();
  const autorizarRendirMutation = useAutorizarRendirMutation(selectedDni);
  const agregarCarreraMutation = useAgregarCarreraMutation(selectedDni);

  const docValues = watch("documentacion");

  const { anyMainSelected, handleMainDocChange, handleAdeudaChange, handleEstudianteRegularChange } =
    useDocumentacionSideEffects(docValues, setValue, getValues);

  usePopulateFormFromDetail(detailData, reset);

  const onSubmit = (values: DetailFormValues) => {
    if (!selectedDni) return;
    setPendingDetailValues(values);
    setConfirmDialogOpen(true);
  };

  const handleOpenDetail = (dni: string) => {
    setSelectedDni(dni);
    setDetailOpen(true);
  };

  const handleConfirmDetailSave = () => {
    if (!selectedDni || !pendingDetailValues) {
      return;
    }
    updateMutation.mutate(
      { dni: selectedDni, data: pendingDetailValues },
      {
        onSuccess: () => {
          setPendingDetailValues(null);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
          const apiResponse = error?.response?.data?.data;
          if (apiResponse?.code === "ACTIVE_ENROLLMENTS") {
             setActiveEnrollmentsWarning(apiResponse.inscripciones || []);
          } else {
             setPendingDetailValues(null);
          }
        }
      },
    );
    setConfirmDialogOpen(false);
  };

  const handleForceBajaMaterias = () => {
    if (!selectedDni || !pendingDetailValues) return;
    
    // Forzamos el flag en las carreras que estén marcadas como BAJ
    const forcedValues = {
      ...pendingDetailValues,
      carreras_situacion: pendingDetailValues.carreras_situacion?.map(c => 
        c.estado_academico === 'BAJ' ? { ...c, force_baja_materias: true } : c
      )
    };

    updateMutation.mutate(
      { dni: selectedDni, data: forcedValues },
      {
        onSuccess: () => {
          setPendingDetailValues(null);
          setActiveEnrollmentsWarning(null);
        },
        onError: () => {
          setPendingDetailValues(null);
          setActiveEnrollmentsWarning(null);
        }
      }
    );
  };

  const handleCancelDetailSave = () => {
    if (updateMutation.isPending) {
      return;
    }
    setConfirmDialogOpen(false);
    setPendingDetailValues(null);
    setActiveEnrollmentsWarning(null);
  };

  const handleResetPassword = () => {
    if (!selectedDni) return;
    if (window.confirm(`¿Está seguro de resetear la contraseña del estudiante ${selectedDni}? La nueva clave será pass${selectedDni}`)) {
      resetPassMutation.mutate(selectedDni);
    }
  };

  const isListLoading = listQuery.isLoading || listQuery.isFetching;
  const estudiantes = listData?.items ?? [];
  const total = listData?.total ?? 0;

  const detailNombre = detailData
    ? `${detailData.apellido ?? ""} ${detailData.nombre ?? ""}`.trim() || detailData.dni
    : null;
  const confirmContextText = detailNombre
    ? `actualización de los datos del estudiante ${detailNombre}`
    : "actualización de los datos del estudiante";
  const deleteContextText = detailNombre
    ? `eliminación PERMANENTE del estudiante ${detailNombre} y todo su historial relacionado (inscripciones, notas, etc.)`
    : "eliminación permanente de este estudiante";

  const condicionCalculada = detailData?.condicion_calculada ?? "";

  return (
    <Box p={2} display="flex" flexDirection="column" gap={2}>
      <BackButton fallbackPath="/secretaria" />

      {isAdminOrSec && <AgregarEstudianteExternoPanel />}

      <EstudiantesFilterBar
        search={search}
        onSearchChange={setSearch}
        estado={estado}
        onEstadoChange={setEstado}
        estadoAcademico={estadoAcademico}
        onEstadoAcademicoChange={setEstadoAcademico}
        carreraId={carreraId}
        onCarreraChange={setCarreraId}
        anioIngreso={anioIngreso}
        onAnioIngresoChange={setAnioIngreso}
        anioIngresoOptions={anioIngresoOptions}
        carreras={carrerasData ?? []}
        isListLoading={isListLoading}
        onRefresh={() => {
          setPage(0);
          queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] });
        }}
      />

      <EstudiantesTable
        estudiantes={estudiantes}
        total={total}
        isListLoading={isListLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        onRowClick={handleOpenDetail}
        page={page}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(val: number) => {
          setRowsPerPage(val);
          setPage(0);
        }}
      />

      <EstudianteDetailDialog
        open={detailOpen}
        onClose={handleCloseDetail}
        detailQuery={detailQuery}
        selectedDni={selectedDni}
        condicionCalculada={condicionCalculada}
        control={control}
        handleSubmit={handleSubmit}
        watch={watch}
        setValue={setValue}
        onSubmit={onSubmit}
        anioIngresoOptions={anioIngresoOptions}
        docValues={docValues}
        anyMainSelected={anyMainSelected}
        handleMainDocChange={handleMainDocChange}
        handleAdeudaChange={handleAdeudaChange}
        handleEstudianteRegularChange={handleEstudianteRegularChange}
        updateIsPending={updateMutation.isPending}
        deleteIsPending={deleteMutation.isPending}
        resetPassIsPending={resetPassMutation.isPending}
        onDeleteClick={() => setDeleteConfirmOpen(true)}
        onResetPassword={handleResetPassword}
        onAutorizarRendir={(autorizado, observacion, materias_autorizadas) =>
          autorizarRendirMutation.mutate({ autorizado, observacion, materias_autorizadas: materias_autorizadas || [] })
        }
        autorizarRendirIsPending={autorizarRendirMutation.isPending}
        onAgregarCarrera={(profesorado_id, anio_ingreso) =>
          agregarCarreraMutation.mutate({ profesorado_id, anio_ingreso })
        }
        agregarCarreraIsPending={agregarCarreraMutation.isPending}
        isAttp={isAttp}
        isRectorado={isRectorado}
        canResetPassword={canResetPassword}
      />

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

      {/* Dialogo de confirmación de Baja en Cascada */}
      {activeEnrollmentsWarning && (
        <FinalConfirmationDialog
          open={Boolean(activeEnrollmentsWarning)}
          onConfirm={handleForceBajaMaterias}
          onCancel={() => {
            setActiveEnrollmentsWarning(null);
            setPendingDetailValues(null);
          }}
          contextText={`dar de baja la carrera de este estudiante. Atención: El estudiante tiene ${activeEnrollmentsWarning.length} inscripciones activas (ej: ${activeEnrollmentsWarning.map(m => m.materia).join(', ')}). Al confirmar, el sistema automáticamente dará de baja todas estas inscripciones también.`}
          confirmLabel="Sí, dar de baja carrera y materias"
          confirmColor="warning"
          loading={updateMutation.isPending}
        />
      )}
    </Box>
  );
}
