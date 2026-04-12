import React, { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useSnackbar } from "notistack";
import { PageHero } from "@/components/ui/GradientTitles";
import { TramitesNavTabs } from "@/components/ui/TramitesNavTabs";
import { listarCambiosComisionPendientes, autorizarCambioComision, SolicitudCambioComisionDTO } from "@/api/estudiantes";
import { getErrorMessage } from "@/utils/errors";

type DialogMode = "aprobar" | "rechazar" | null;

const CambioComisionAdminPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [solicitudes, setSolicitudes] = useState<SolicitudCambioComisionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [dniFilter, setDniFilter] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<SolicitudCambioComisionDTO | null>(null);
  const [disposicion, setDisposicion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarCambiosComisionPendientes(dniFilter.length >= 7 ? { dni: dniFilter } : {});
      setSolicitudes(data);
    } catch (e) {
      enqueueSnackbar(getErrorMessage(e, "No se pudieron cargar las solicitudes."), { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [dniFilter, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = (sol: SolicitudCambioComisionDTO, mode: DialogMode) => {
    setSelected(sol);
    setDialogMode(mode);
    setDisposicion("");
    setObservaciones("");
  };

  const handleClose = () => {
    if (saving) return;
    setDialogMode(null);
    setSelected(null);
  };

  const handleSubmit = async () => {
    if (!selected || !dialogMode) return;
    if (dialogMode === "aprobar" && !disposicion.trim()) {
      enqueueSnackbar("Debe ingresar el número de disposición para aprobar.", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      await autorizarCambioComision(selected.id, {
        aprobado: dialogMode === "aprobar",
        disposicion_numero: dialogMode === "aprobar" ? disposicion.trim() : undefined,
        observaciones: observaciones.trim() || undefined,
      });
      enqueueSnackbar(
        dialogMode === "aprobar" ? "Cambio de comisión aprobado y estudiante notificado." : "Solicitud rechazada y estudiante notificado.",
        { variant: "success" }
      );
      handleClose();
      load();
    } catch (e) {
      enqueueSnackbar(getErrorMessage(e, "No se pudo procesar la solicitud."), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHero
        title="Trámites Académicos"
        subtitle="Gestioná analíticos, equivalencias y cambios de comisión."
      />
      <TramitesNavTabs />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Filtrar por DNI"
            size="small"
            value={dniFilter}
            onChange={(e) => setDniFilter(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button variant="outlined" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : "Actualizar"}
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "grey.100" } }}>
              <TableCell>Estudiante</TableCell>
              <TableCell>Materia</TableCell>
              <TableCell>Profesorado</TableCell>
              <TableCell>Comisión actual</TableCell>
              <TableCell>Comisión solicitada</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : solicitudes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No hay solicitudes pendientes.
                </TableCell>
              </TableRow>
            ) : (
              solicitudes.map((sol) => (
                <TableRow key={sol.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{sol.estudiante_nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">{sol.estudiante_dni}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{sol.materia_nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">{sol.anio}º año</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{sol.profesorado_nombre ?? "-"}</Typography>
                  </TableCell>
                  <TableCell>
                    {sol.comision_actual ? (
                      <Chip label={sol.comision_actual} size="small" variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Sin comisión</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={sol.comision_solicitada} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{sol.motivo}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{sol.created_at}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={() => handleOpen(sol, "aprobar")}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CloseIcon />}
                        onClick={() => handleOpen(sol, "rechazar")}
                      >
                        Rechazar
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!dialogMode} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === "aprobar" ? "Aprobar cambio de comisión" : "Rechazar cambio de comisión"}
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2">
                <strong>{selected.estudiante_nombre}</strong> ({selected.estudiante_dni}) —{" "}
                {selected.materia_nombre} → Comisión <strong>{selected.comision_solicitada}</strong>
              </Typography>
              {dialogMode === "aprobar" && (
                <TextField
                  label="Nº Disposición Interna"
                  value={disposicion}
                  onChange={(e) => setDisposicion(e.target.value)}
                  fullWidth
                  required
                  size="small"
                  helperText="Requerido para aprobar el cambio."
                />
              )}
              <TextField
                label={dialogMode === "aprobar" ? "Observaciones (opcional)" : "Motivo de rechazo (opcional)"}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            color={dialogMode === "aprobar" ? "success" : "error"}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? <CircularProgress size={18} /> : dialogMode === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CambioComisionAdminPage;
