import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { HorarioCeldaDTO, HorarioMateriaCeldaDTO, HorarioTablaDTO } from "@/api/estudiantes";

const cellKey = (dia: number, orden: number) => `${dia}-${orden}`;

const REGIMEN_LABEL: Record<string, string> = {
  ANUAL: "Anual",
  "1C": "1er Cuatrimestre",
  "2C": "2do Cuatrimestre",
};

const formatRegimen = (regimen?: string | null, cuatrimestre?: string | null) => {
  const base = regimen ? (REGIMEN_LABEL[regimen] ?? regimen) : "";
  if (base === "Anual") return base; // Si es anual, chau extra.
  const extra =
    cuatrimestre && cuatrimestre !== regimen ? (REGIMEN_LABEL[cuatrimestre] ?? cuatrimestre) : "";
  if (base && extra) return `${base} - ${extra}`;
  return base || extra || "Sin dato";
};

type HorarioTablaCardProps = {
  tabla: HorarioTablaDTO;
  cuatrimestre?: string;
};

const HorarioTablaCard: React.FC<HorarioTablaCardProps> = ({ tabla, cuatrimestre }) => {
  const dias = useMemo(
    () => [...tabla.dias].sort((a, b) => a.numero - b.numero),
    [tabla.dias],
  );
  const franjas = useMemo(
    () => [...tabla.franjas].sort((a, b) => a.orden - b.orden),
    [tabla.franjas],
  );

  const celdas = useMemo(() => {
    const map = new Map<string, HorarioCeldaDTO>();
    tabla.celdas.forEach((celda) => {
      map.set(cellKey(celda.dia_numero, celda.franja_orden), celda);
    });
    return map;
  }, [tabla.celdas]);

  const anioLabel = tabla.anio_plan_label || "Horario de cursada";
  const turnoNombre = tabla.turno_nombre ? tabla.turno_nombre.trim() : "";
  const turnoLabel = turnoNombre
    ? /\bturno\b/i.test(turnoNombre)
      ? turnoNombre
      : `Turno ${turnoNombre}`
    : "Sin turno";

  const renderMateria = (materia: HorarioMateriaCeldaDTO, index: number) => {
    const key = `${materia.materia_id}-${index}`;
    return (
      <Box
        key={key}
        sx={{
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          p: 1,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {materia.materia_nombre}
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {/* Se eliminan las etiquetas de comisiones por pedido del usuario */}
          <Typography variant="caption" color="text.secondary">
            Docentes: {materia.docentes.length ? materia.docentes.join("; ") : "Vacante"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Regimen: {formatRegimen(materia.regimen, materia.cuatrimestre)}
          </Typography>
          {materia.observaciones && (
            <Typography variant="caption" color="text.secondary">
              Observaciones: {materia.observaciones}
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  const gridTemplate = `160px repeat(${Math.max(dias.length, 1)}, minmax(140px, 1fr))`;

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Stack spacing={1} direction={{ xs: "column", md: "row" }} justifyContent="space-between">
          <Box>
            <Typography variant="h6">
              {anioLabel}
              {` - ${turnoLabel}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tabla.profesorado_nombre} - Plan {tabla.plan_resolucion || tabla.plan_id}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {tabla.cuatrimestres.map((c) => (
              <Chip
                key={c}
                size="small"
                color={c === "ANUAL" ? "default" : "primary"}
                label={REGIMEN_LABEL[c] ?? c}
              />
            ))}
          </Stack>
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box sx={{ overflowX: "auto" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              border: "1px solid",
              borderColor: "divider",
              "& > div": {
                borderRight: "1px solid",
                borderColor: "divider",
              },
              "& > div.header": {
                bgcolor: "grey.100",
              },
            }}
          >
            <Box
              className="header"
              sx={{
                p: 1.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              Horario
            </Box>
            {dias.map((dia) => (
              <Box
                key={dia.numero}
                className="header"
                sx={{
                  p: 1.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                }}
              >
                {dia.nombre}
              </Box>
            ))}
            {franjas.map((franja) => {
              const [h1, m1] = franja.desde.split(":").map(Number);
              const [h2, m2] = franja.hasta.split(":").map(Number);
              const duration = (h2 * 60 + m2) - (h1 * 60 + m1);
              const isRecreo = franja.es_recreo || (duration > 0 && duration <= 15);

              if (isRecreo) {
                return (
                  <Box 
                    key={franja.orden} 
                    sx={{ 
                      gridColumn: `1 / span ${dias.length + 1}`,
                      p: 0.5,
                      bgcolor: "grey.100",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary" }}>{franja.desde}</Typography>
                    <Typography variant="overline" sx={{ fontWeight: "bold", fontStyle: "italic", letterSpacing: 2, color: "text.secondary" }}>
                      • RECREO •
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.secondary" }}>{franja.hasta}</Typography>
                  </Box>
                );
              }

              return (
                <React.Fragment key={franja.orden}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      bgcolor: "grey.100",
                      fontWeight: 600,
                    }}
                  >
                    {franja.desde} - {franja.hasta}
                  </Box>
                  {dias.map((dia) => {
                    const entry = celdas.get(cellKey(dia.numero, franja.orden));
                    const materias =
                      entry?.materias.filter((materia) => {
                        if (!cuatrimestre) return true;
                        const valor = materia.cuatrimestre || (materia.regimen !== "ANUAL" ? materia.regimen : null);
                        return valor === cuatrimestre;
                      }) ?? [];
                    return (
                      <Box
                        key={`${franja.orden}-${dia.numero}`}
                        sx={{
                          p: materias.length ? 1 : 1.5,
                          minHeight: 96,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                          bgcolor: materias.length ? "grey.50" : "background.default",
                        }}
                      >
                        {materias.length
                          ? materias.map(renderMateria)
                          : (
                            <Typography variant="caption" color="text.secondary">
                              -
                            </Typography>
                          )}
                      </Box>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </Box>
        </Box>
        {tabla.observaciones && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
            {tabla.observaciones}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default HorarioTablaCard;
