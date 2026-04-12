import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteForever";
import DescriptionIcon from "@mui/icons-material/Description";
import LockResetIcon from "@mui/icons-material/LockReset";
import GavelIcon from "@mui/icons-material/Gavel";
import { Control, UseFormHandleSubmit, UseFormWatch } from "react-hook-form";
import { EstudianteAdminDetailDTO } from "@/api/estudiantes";
import { DetailFormValues, DetailDocumentacionForm, condicionColorMap } from "../types";
import { EstudianteDetailForm } from "./EstudianteDetailForm";

type Props = {
  open: boolean;
  onClose: () => void;
  detailQuery: {
    data?: EstudianteAdminDetailDTO;
    isLoading: boolean;
    isFetching: boolean;
  };
  selectedDni: string | null;
  condicionCalculada: string;
  control: Control<DetailFormValues>;
  handleSubmit: UseFormHandleSubmit<DetailFormValues>;
  watch: UseFormWatch<DetailFormValues>;
  setValue: (name: any, value: any, options?: any) => void;
  onSubmit: (values: DetailFormValues) => void;
  anioIngresoOptions: string[];
  docValues: DetailDocumentacionForm;
  anyMainSelected: boolean;
  handleMainDocChange: (target: keyof DetailDocumentacionForm) => (_: unknown, checked: boolean) => void;
  handleAdeudaChange: (_: unknown, checked: boolean) => void;
  handleEstudianteRegularChange: (_: unknown, checked: boolean) => void;
  updateIsPending: boolean;
  deleteIsPending: boolean;
  resetPassIsPending?: boolean;
  onDeleteClick: () => void;
  onResetPassword?: () => void;
  onAutorizarRendir?: (autorizado: boolean, observacion: string) => void;
  autorizarRendirIsPending?: boolean;
};

export function EstudianteDetailDialog({
  open,
  onClose,
  detailQuery,
  selectedDni,
  condicionCalculada,
  control,
  handleSubmit,
  watch,
  setValue,
  onSubmit,
  anioIngresoOptions,
  docValues,
  anyMainSelected,
  handleMainDocChange,
  handleAdeudaChange,
  handleEstudianteRegularChange,
  updateIsPending,
  deleteIsPending,
  resetPassIsPending,
  onDeleteClick,
  onResetPassword,
  onAutorizarRendir,
  autorizarRendirIsPending,
}: Props) {
  const estudiante = detailQuery.data;
  const [autorizadoSwitch, setAutorizadoSwitch] = useState(false);
  const [autorizadoObs, setAutorizadoObs] = useState("");

  useEffect(() => {
    if (estudiante) {
      setAutorizadoSwitch(estudiante.autorizado_rendir ?? false);
      setAutorizadoObs(estudiante.autorizado_rendir_observacion ?? "");
    }
  }, [estudiante]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={resetPassIsPending ? <CircularProgress size={16} color="inherit" /> : <LockResetIcon />}
                  onClick={onResetPassword}
                  disabled={resetPassIsPending || updateIsPending}
                >
                  Resetear Contraseña
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

            <EstudianteDetailForm
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
            />

            {onAutorizarRendir && (
              <Paper
                variant="outlined"
                sx={{ p: 2, borderColor: autorizadoSwitch ? "warning.main" : "divider", bgcolor: autorizadoSwitch ? "warning.50" : "background.paper" }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GavelIcon fontSize="small" color={autorizadoSwitch ? "warning" : "disabled"} />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Autorización excepcional para rendir finales
                    </Typography>
                    {autorizadoSwitch && (
                      <Chip label="AUTORIZADO" color="warning" size="small" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Permite al estudiante rendir exámenes finales aunque tenga el legajo incompleto. Solo Secretaría y Bedelía pueden modificar esto.
                  </Typography>
                  <Divider />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autorizadoSwitch}
                        onChange={(e) => setAutorizadoSwitch(e.target.checked)}
                        color="warning"
                      />
                    }
                    label={autorizadoSwitch ? "Autorizado para rendir" : "No autorizado"}
                  />
                  <TextField
                    label="Motivo / Observación"
                    value={autorizadoObs}
                    onChange={(e) => setAutorizadoObs(e.target.value)}
                    size="small"
                    multiline
                    rows={2}
                    fullWidth
                    placeholder="Ej: Autorizado por resolución del 12/04/2026 — pendiente entrega de analítico"
                  />
                  <Box>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      disabled={autorizarRendirIsPending}
                      startIcon={autorizarRendirIsPending ? <CircularProgress size={14} color="inherit" /> : <GavelIcon />}
                      onClick={() => onAutorizarRendir(autorizadoSwitch, autorizadoObs)}
                    >
                      Guardar autorización
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Stack>
        ) : (
          <Alert severity="error">No se pudo cargar la ficha del estudiante.</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Button
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onDeleteClick}
          disabled={updateIsPending || deleteIsPending}
        >
          Eliminar estudiante
        </Button>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<CloseIcon />} onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="submit"
            form="estudiante-admin-form"
            variant="contained"
            startIcon={updateIsPending ? <CircularProgress size={18} color="inherit" /> : undefined}
            disabled={updateIsPending || deleteIsPending}
          >
            {updateIsPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
