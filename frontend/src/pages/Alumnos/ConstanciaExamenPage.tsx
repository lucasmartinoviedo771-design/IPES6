import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { obtenerConstanciasExamen, ConstanciaExamenDTO } from "@/api/alumnos";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { generarConstanciaExamenPDF } from "@/utils/constanciaExamenPdf";
import { useAuth } from "@/context/AuthContext";

const ConstanciaExamenPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");
  const [dniInput, setDniInput] = useState<string>("");
  const [dniFiltro, setDniFiltro] = useState<string>("");
  const [destinatario, setDestinatario] = useState<string>("");

  const roles = (user?.roles || []) as string[];
  const isAlumno = roles.length > 0 && roles.every((rol) => rol.toLowerCase() === "alumno");
  const dniObjetivo = isAlumno ? user?.dni ?? "" : dniFiltro;

  const constanciasQuery = useQuery<ConstanciaExamenDTO[]>({
    queryKey: ["constancias-examen", dniObjetivo || null],
    queryFn: () => obtenerConstanciasExamen(dniObjetivo ? { dni: dniObjetivo } : undefined),
    enabled: isAlumno || (dniObjetivo?.length ?? 0) === 8,
  });

  const constancias = constanciasQuery.data ?? [];

  const destinatarioTexto = useMemo(
    () => (destinatario.trim().length > 0 ? destinatario.trim() : "A quien corresponda"),
    [destinatario],
  );

  const selectedConstancia = useMemo(() => {
    if (!selectedId) return null;
    const id = Number(selectedId);
    return constancias.find((item) => item.inscripcion_id === id) ?? null;
  }, [selectedId, constancias]);

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    setSelectedId(event.target.value);
  };

  const handleDownload = () => {
    if (!selectedConstancia) {
      enqueueSnackbar("Seleccioná un examen para descargar la constancia.", { variant: "warning" });
      return;
    }
    generarConstanciaExamenPDF(selectedConstancia, { destinatario: destinatarioTexto });
  };

  useEffect(() => {
    if (isAlumno) {
      setDniFiltro("");
      return;
    }
    const timeout = setTimeout(() => {
      setDniFiltro(dniInput.replace(/\D/g, "").slice(0, 8));
    }, 400);
    return () => clearTimeout(timeout);
  }, [dniInput, isAlumno]);
  const isSearching = constanciasQuery.isFetching && (isAlumno || dniObjetivo.length === 8);

  const puedeBuscar = isAlumno || dniObjetivo.length === 8;
  const emptyMessage = puedeBuscar
    ? "Todavía no se registran mesas rendidas con resultado para este estudiante."
    : "Ingresa un DNI para buscar las constancias de examen.";

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 960, mx: "auto" }}>
      <BackButton fallbackPath="/alumnos" />
      <PageHero
        title="Constancia de examen"
        subtitle="Descargá un comprobante de la mesa rendida. Incluye la materia, fecha, modalidad y condición registrada."
      />

      <Card>
        <CardContent>
          <Stack spacing={3}>
            {!isAlumno && (
              <TextField
                label="DNI del estudiante"
                value={dniInput}
                onChange={(event) => setDniInput(event.target.value)}
                size="small"
                placeholder="Ej: 12345678"
                helperText="Ingresa el DNI para buscar las constancias."
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              />
            )}
            <TextField
              label="Destinatario"
              value={destinatario}
              onChange={(event) => setDestinatario(event.target.value)}
              size="small"
              placeholder="A quien corresponda"
              helperText='Se mostrará en la constancia. Si lo dejás vacío se usará "A quien corresponda".'
            />
            {constancias.length > 0 ? (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel id="constancia-select-label">Mesa rendida</InputLabel>
                  <Select
                    labelId="constancia-select-label"
                    label="Mesa rendida"
                    value={selectedId}
                    onChange={handleSelectChange}
                  >
                    {constancias.map((item) => (
                      <MenuItem key={item.inscripcion_id} value={String(item.inscripcion_id)}>
                        {item.materia} · {item.mesa_tipo} ({new Date(item.mesa_fecha).toLocaleDateString()})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedConstancia && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Detalle
                    </Typography>
                    <Stack spacing={0.5}>
                      <Typography><strong>Materia:</strong> {selectedConstancia.materia}</Typography>
                      <Typography>
                        <strong>Fecha:</strong> {new Date(selectedConstancia.mesa_fecha).toLocaleDateString()} ·{" "}
                        {selectedConstancia.mesa_tipo} · {selectedConstancia.mesa_modalidad}
                      </Typography>
                      <Typography>
                        <strong>Condición:</strong> {selectedConstancia.condicion_display}
                        {selectedConstancia.nota ? ` (nota ${selectedConstancia.nota})` : ""}
                      </Typography>
                      <Typography>
                        <strong>Libro / Folio:</strong> {selectedConstancia.libro ?? "-"} / {selectedConstancia.folio ?? "-"}
                      </Typography>
                    </Stack>
                  </Box>
                )}

                <Stack direction="row" justifyContent="flex-end">
                  <Button variant="contained" onClick={handleDownload} disabled={!selectedConstancia}>
                    Descargar constancia
                  </Button>
                </Stack>
              </>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {isSearching && <CircularProgress size={18} thickness={5} />}
                  <Typography>
                    {isSearching ? "Buscando constancias..." : emptyMessage}
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConstanciaExamenPage;
