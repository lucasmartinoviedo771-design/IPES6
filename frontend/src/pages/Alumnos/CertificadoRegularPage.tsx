import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useSnackbar } from "notistack";

import {
  descargarCertificadoRegular,
  obtenerCarrerasActivas,
  TrayectoriaCarreraDetalleDTO,
} from "@/api/alumnos";
import { useAuth } from "@/context/AuthContext";
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { hasAnyRole } from "@/utils/roles";

type SelectValue = string;

const CertificadoRegularPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const roles = user?.roles ?? [];
  const isOnlyStudent = hasAnyRole(user, ["alumno"]) && !hasAnyRole(user, ["admin", "secretaria", "bedel"]);
  const canGestionar = hasAnyRole(user, ["admin", "secretaria", "bedel"]);

  const [profesoradoId, setProfesoradoId] = useState<SelectValue>("");
  const [planId, setPlanId] = useState<SelectValue>("");
  const [dniManual, setDniManual] = useState<string>("");
  const [descargando, setDescargando] = useState(false);

  const dniObjetivo = isOnlyStudent ? (user?.dni ?? "") : dniManual.trim();

  const carrerasQuery = useQuery({
    queryKey: ["alumnos", "carreras-activas", dniObjetivo || null],
    queryFn: () => obtenerCarrerasActivas(dniObjetivo ? { dni: dniObjetivo } : {}),
    enabled: (isOnlyStudent || Boolean(dniObjetivo)) && (canGestionar || isOnlyStudent),
  });

  const carreras = carrerasQuery.data ?? [];

  useEffect(() => {
    if (!carreras.length) {
      setProfesoradoId("");
      return;
    }
    const existe = carreras.some((item) => String(item.profesorado_id) === profesoradoId);
    if (!existe) {
      setProfesoradoId(String(carreras[0].profesorado_id));
    }
  }, [carreras, profesoradoId]);

  const planesDisponibles = useMemo(() => {
    const carrera = carreras.find((item) => item.profesorado_id === Number(profesoradoId));
    return carrera?.planes ?? [];
  }, [carreras, profesoradoId]);

  useEffect(() => {
    if (!planesDisponibles.length) {
      setPlanId("");
      return;
    }
    const existe = planesDisponibles.some((plan) => String(plan.id) === planId);
    if (!existe) {
      const planPreferido = planesDisponibles.find((plan) => plan.vigente) ?? planesDisponibles[0];
      setPlanId(String(planPreferido.id));
    }
  }, [planesDisponibles, planId]);

  const puedeCambiarDni = canGestionar;
  const handleDescargar = async () => {
    if (!profesoradoId || !planId) {
      enqueueSnackbar("Selecciona un profesorado y un plan de estudio.", { variant: "warning" });
      return;
    }
    if (!dniObjetivo) {
      enqueueSnackbar("Ingresa un DNI valido.", { variant: "warning" });
      return;
    }

    setDescargando(true);
    try {
      const blob = await descargarCertificadoRegular({
        profesorado_id: Number(profesoradoId),
        plan_id: Number(planId),
        dni: puedeCambiarDni ? dniObjetivo : undefined,
      });

      if (blob.type && blob.type.includes("application/json")) {
        const text = await blob.text();
        try {
          const parsed = JSON.parse(text);
          throw new Error(parsed?.message || parsed?.detail || "No se pudo generar la constancia.");
        } catch (err) {
          throw new Error("No se pudo generar la constancia.");
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `constancia_regular_${dniObjetivo}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar("Constancia generada correctamente.", { variant: "success" });
    } catch (error) {
      let mensaje = "No se pudo generar la constancia.";
      if (isAxiosError(error)) {
        const data = error.response?.data;
        if (data instanceof Blob) {
          try {
            const texto = await data.text();
            const parsed = JSON.parse(texto);
            mensaje = parsed?.message || parsed?.detail || mensaje;
          } catch {
            mensaje = error.message || mensaje;
          }
        } else {
          mensaje =
            (error.response?.data as any)?.message ||
            (error.response?.data as any)?.detail ||
            error.message ||
            mensaje;
        }
      } else if (error instanceof Error) {
        mensaje = error.message || mensaje;
      }
      enqueueSnackbar(mensaje, { variant: "error" });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/alumnos" />
      <PageHero
        title="Constancia de alumno regular"
        subtitle="Descargá el certificado oficial del ciclo vigente según tu cohorte"
      />
      <Alert severity="warning" sx={{ mb: 2 }}>
        Registro académico sin validez administrativa. No tomar como documento definitivo de notas.
      </Alert>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="profesorado-select-label">Profesorado</InputLabel>
            <Select
              labelId="profesorado-select-label"
              label="Profesorado"
              value={profesoradoId}
              onChange={(event: SelectChangeEvent<string>) => setProfesoradoId(event.target.value)}
              disabled={carrerasQuery.isLoading || (!isOnlyStudent && !dniObjetivo) || (!isOnlyStudent && !carreras.length)}
            >
              {carreras.map((carrera: TrayectoriaCarreraDetalleDTO) => (
                <MenuItem key={carrera.profesorado_id} value={String(carrera.profesorado_id)}>
                  {carrera.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl
            fullWidth
            size="small"
            disabled={!planesDisponibles.length || carrerasQuery.isLoading || (!isOnlyStudent && !dniObjetivo)}
          >
            <InputLabel id="plan-select-label">Plan</InputLabel>
            <Select
              labelId="plan-select-label"
              label="Plan"
              value={planId}
              onChange={(event: SelectChangeEvent<string>) => setPlanId(event.target.value)}
            >
              {planesDisponibles.map((plan) => (
                <MenuItem key={plan.id} value={String(plan.id)}>
                  {plan.resolucion || `Plan ${plan.id}`}
                  {plan.vigente ? " - Vigente" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" height="100%">
            <Button
              variant="contained"
              startIcon={descargando ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              onClick={handleDescargar}
              disabled={!profesoradoId || !planId || !dniObjetivo || descargando}
            >
              Descargar constancia
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {puedeCambiarDni && (
        <Box sx={{ maxWidth: 400, mb: 3 }}>
          <TextField
            label="DNI del estudiante"
            value={dniManual}
            onChange={(event) => setDniManual(event.target.value)}
            fullWidth
            size="small"
            helperText="Ingresa el DNI del estudiante para generar la constancia."
          />
          {!dniObjetivo && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Ingresar un DNI permite cargar los profesorados y planes asociados a ese estudiante.
            </Typography>
          )}
        </Box>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 4 }}>
        Condiciones consideradas
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Una vez impresa la constancia, deberá ser firmada y sellada por la institucion para tener validez oficial.
      </Typography>
    </Box>
  );
};

export default CertificadoRegularPage;
