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

import { obtenerConstanciasExamen, ConstanciaExamenDTO } from "@/api/estudiantes";
import BackButton from "@/components/ui/BackButton";
import { PageHero } from "@/components/ui/GradientTitles";
import { generarConstanciaExamenPDF } from "@/utils/constanciaExamenPdf";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/utils/roles";

const ConstanciaExamenPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");
  const [dniInput, setDniInput] = useState<string>("");
  const [dniFiltro, setDniFiltro] = useState<string>("");
  const [destinatario, setDestinatario] = useState<string>("");
  const [profesoradoId, setProfesoradoId] = useState<string>("all");

  const isEstudiante = hasRole(user, "estudiante");
  const dniObjetivo = isEstudiante ? user?.dni ?? "" : dniFiltro;

  const constanciasQuery = useQuery<ConstanciaExamenDTO[]>({
    queryKey: ["constancias-examen", dniObjetivo || null],
    queryFn: () => obtenerConstanciasExamen(dniObjetivo ? { dni: dniObjetivo } : undefined),
    enabled: isEstudiante || (dniObjetivo?.length ?? 0) === 8,
  });

  const constancias = constanciasQuery.data ?? [];

  const carrerasDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    constancias.forEach((c) => {
      if (c.profesorado_id && c.profesorado) {
        map.set(c.profesorado_id, c.profesorado);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [constancias]);

  const filteredConstancias = useMemo(() => {
    if (profesoradoId === "all") return constancias;
    return constancias.filter((c) => String(c.profesorado_id) === profesoradoId);
  }, [constancias, profesoradoId]);

  const destinatarioTexto = useMemo(
    () => (destinatario.trim().length > 0 ? destinatario.trim() : "A quien corresponda"),
    [destinatario],
  );

  const selectedConstancia = useMemo(() => {
    if (!selectedId) return null;
    const id = Number(selectedId);
    return filteredConstancias.find((item) => item.inscripcion_id === id) ?? null;
  }, [selectedId, filteredConstancias]);

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
    if (isEstudiante) {
      setDniFiltro("");
      return;
    }
    const timeout = setTimeout(() => {
      setDniFiltro(dniInput.replace(/\D/g, "").slice(0, 8));
    }, 400);
    return () => clearTimeout(timeout);
  }, [dniInput, isEstudiante]);

  // Reset seleccion al cambiar carrera
  useEffect(() => {
    setSelectedId("");
  }, [profesoradoId]);

  const isSearching = constanciasQuery.isFetching && (isEstudiante || dniObjetivo.length === 8);

  const puedeBuscar = isEstudiante || dniObjetivo.length === 8;
  const emptyMessage = puedeBuscar
    ? "No se encontraron mesas rendidas recientes con resultado para este estudiante."
    : "Ingresa un DNI para buscar las constancias de examen.";

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 960, mx: "auto" }}>
      <BackButton fallbackPath="/estudiantes" />
      <PageHero
        title="Constancia de examen"
        subtitle="Descargá un comprobante de la mesa rendida. Incluye la materia, fecha, modalidad y condición registrada."
      />

      <Card>
        <CardContent>
          <Stack spacing={3}>
            {!isEstudiante && (
              <TextField
                label="DNI del estudiante"
                value={dniInput}
                onChange={(event) => setDniInput(event.target.value)}
                size="small"
                fullWidth
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
              fullWidth
              placeholder="A quien corresponda"
              helperText='Se mostrará en la constancia. Si lo dejás vacío se usará "A quien corresponda".'
            />

            {constancias.length > 0 ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  {carrerasDisponibles.length > 1 && (
                    <FormControl fullWidth size="small">
                      <InputLabel id="profesorado-select-label">Carrera (Filtrar)</InputLabel>
                      <Select
                        labelId="profesorado-select-label"
                        label="Carrera (Filtrar)"
                        value={profesoradoId}
                        onChange={(e) => setProfesoradoId(e.target.value)}
                      >
                        <MenuItem value="all">Todas las carreras</MenuItem>
                        {carrerasDisponibles.map((c) => (
                          <MenuItem key={c.id} value={String(c.id)}>
                            {c.nombre}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  <FormControl fullWidth size="small">
                    <InputLabel id="constancia-select-label">Mesa rendida</InputLabel>
                    <Select
                      labelId="constancia-select-label"
                      label="Mesa rendida"
                      value={selectedId}
                      onChange={handleSelectChange}
                    >
                      {filteredConstancias.map((item) => (
                        <MenuItem key={item.inscripcion_id} value={String(item.inscripcion_id)}>
                          {item.materia} · {item.mesa_tipo} (
                          {new Date(item.mesa_fecha).toLocaleDateString()})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                {selectedConstancia && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: "bold" }}>
                      DETALLE DEL EXAMEN SELECCIONADO
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Carrera:</strong> {selectedConstancia.profesorado}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Materia:</strong> {selectedConstancia.materia}{" "}
                        {selectedConstancia.materia_anio ? `(${selectedConstancia.materia_anio}° año)` : ""}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Fecha y Tipo:</strong>{" "}
                        {new Date(selectedConstancia.mesa_fecha).toLocaleDateString()} ·{" "}
                        {selectedConstancia.mesa_tipo} ({selectedConstancia.mesa_modalidad})
                      </Typography>
                      <Typography variant="body2">
                        <strong>Resultado:</strong> {selectedConstancia.condicion_display}
                        {selectedConstancia.nota ? ` - Calificación: ${selectedConstancia.nota}` : ""}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Libro / Folio:</strong> {selectedConstancia.libro ?? "-"} /{" "}
                        {selectedConstancia.folio ?? "-"}
                      </Typography>
                    </Stack>
                  </Box>
                )}

                <Stack direction="row" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handleDownload}
                    disabled={!selectedConstancia}
                    sx={{ px: 4 }}
                  >
                    Descargar constancia (PDF)
                  </Button>
                </Stack>
              </>
            ) : (
              <Stack spacing={2} sx={{ py: 4, textAlign: "center", alignItems: "center" }}>
                {isSearching ? (
                  <>
                    <CircularProgress size={32} />
                    <Typography color="text.secondary">Buscando constancias disponibles...</Typography>
                  </>
                ) : (
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConstanciaExamenPage;
