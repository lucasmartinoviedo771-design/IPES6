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

import { EstadoLegajo, DetailFormValues, DEFAULT_LIMIT } from "./estudiantes-admin/types";
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
import { EstudiantesFilterBar } from "./estudiantes-admin/components/EstudiantesFilterBar";
import { EstudiantesTable } from "./estudiantes-admin/components/EstudiantesTable";
import { EstudianteDetailDialog } from "./estudiantes-admin/components/EstudianteDetailDialog";

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

  const anioIngresoOptions = useAnioIngresoOptions();

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

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDni(null);
    setConfirmDialogOpen(false);
    setDeleteConfirmOpen(false);
    setPendingDetailValues(null);
    form.reset();
  };

  const updateMutation = useUpdateEstudianteMutation(selectedDni);
  const deleteMutation = useDeleteEstudianteMutation(handleCloseDetail, () =>
    setDeleteConfirmOpen(false),
  );

  const form = useEstudianteDetailForm();
  const { reset, control, handleSubmit, watch, setValue, getValues } = form;

  const docValues = watch("documentacion");

  const { anyMainSelected, handleMainDocChange, handleAdeudaChange, handleEstudianteRegularChange } =
    useDocumentacionSideEffects(docValues, setValue, getValues);

  usePopulateFormFromDetail(detailQuery.data, reset);

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

      <EstudiantesFilterBar
        search={search}
        onSearchChange={setSearch}
        estado={estado}
        onEstadoChange={setEstado}
        carreraId={carreraId}
        onCarreraChange={setCarreraId}
        carreras={carrerasQuery.data ?? []}
        isListLoading={isListLoading}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin-estudiantes"] })}
      />

      <EstudiantesTable
        estudiantes={estudiantes}
        total={total}
        isListLoading={isListLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        onRowClick={handleOpenDetail}
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
        onDeleteClick={() => setDeleteConfirmOpen(true)}
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
    </Box>
  );
}
