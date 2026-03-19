import React, { useMemo } from "react";
import { Box, Typography, Stack } from "@mui/material";
import { HorarioTablaDTO, HorarioMateriaCeldaDTO } from "@/api/estudiantes";

// Colores institucionales por profesorado (ajustables)
const PROFESORADO_COLORS: Record<number, string> = {
  1: "#FCD5B4", // Geografía (Naranja claro)
  2: "#FFFF99", // Lengua (Amarillo)
  3: "#C6EFCE", // Biología (Verde)
  4: "#D9E1F2", // Inglés (Azul)
  5: "#E2EFDA", // Primaria
  6: "#FCE4D6", // Inicial
  // Se pueden añadir más según sea necesario
};

const DEFAULT_COLOR = "#F2F2F2";

type InstitutionalScheduleFormatProps = {
  tabla: HorarioTablaDTO;
  salon?: string;
  cuatrimestre?: string;
};

const cellKey = (dia: number, orden: number) => `${dia}-${orden}`;

const InstitutionalScheduleFormat: React.FC<InstitutionalScheduleFormatProps> = ({
  tabla,
  salon = "---",
  cuatrimestre,
}) => {
  const bgColor = PROFESORADO_COLORS[tabla.profesorado_id] || DEFAULT_COLOR;

  const dias = useMemo(() => [...tabla.dias].sort((a, b) => a.numero - b.numero), [tabla.dias]);
  const franjas = useMemo(() => [...tabla.franjas].sort((a, b) => a.orden - b.orden), [tabla.franjas]);

  const celdas = useMemo(() => {
    const map = new Map<string, any>();
    tabla.celdas.forEach((celda) => {
      map.set(cellKey(celda.dia_numero, celda.franja_orden), celda);
    });
    return map;
  }, [tabla.celdas]);

  const renderMateria = (materia: HorarioMateriaCeldaDTO) => {
    // Si queremos filtrar por cuatrimestre
    if (cuatrimestre && materia.regimen !== "ANUAL" && materia.cuatrimestre !== cuatrimestre) {
        return null;
    }

    return (
      <Box 
        sx={{ 
          position: "relative",
          width: "100%", 
          height: "100%", 
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          p: 0.5,
          ...(materia.es_cuatrimestral && {
             background: `linear-gradient(to top right, transparent calc(50% - 0.5px), #bdbdbd, transparent calc(50% + 0.5px))`
          })
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: "600", fontSize: "0.75rem", lineHeight: 1.1 }}>
          {materia.materia_nombre}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: "0.65rem", mt: 0.5, fontStyle: "italic" }}>
          {materia.docentes.length ? `Prof. ${materia.docentes[0]}` : "Sin Docente"}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ 
      width: "100%", 
      fontFamily: "'Roboto', sans-serif",
      bgcolor: "white",
      color: "black",
      "@media print": {
        breakInside: "avoid",
        mb: 4
      }
    }}>
      {/* HEADER INSTITUCIONAL */}
      <Box sx={{ 
        border: "2px solid black", 
        bgcolor: bgColor, 
        p: 1, 
        textAlign: "center",
        borderBottom: "none"
      }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", textTransform: "uppercase" }}>
          PROFESORADO DE EDUCACIÓN SECUNDARIA EN {tabla.profesorado_nombre.replace("Profesorado de Educación Secundaria en ", "")}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: "bold" }}>
          Plan Nº {tabla.plan_resolucion || "---"}
        </Typography>
      </Box>

      {/* SUB-HEADER (TURNO, AÑO, SALON) */}
      <Box sx={{ 
        border: "2px solid black", 
        borderTop: "1px solid black",
        p: 0.5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: bgColor,
        px: 4
      }}>
        <Typography sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>
          TURNO {tabla.turno_nombre.toUpperCase()}
        </Typography>
        <Typography sx={{ fontWeight: "bold", fontSize: "1.2rem", textDecoration: "underline" }}>
          {tabla.anio_plan_label.toUpperCase()}
        </Typography>
        <Typography sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>
          Salón: {salon}
        </Typography>
      </Box>

      {/* TABLA DE HORARIOS */}
      <Box sx={{ display: "grid", gridTemplateColumns: "70px 35px repeat(6, 1fr) 35px 70px", border: "1px solid black" }}>
        {/* Cabecera de tabla */}
        {[ "H. R.", "H.C.", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "H.C.", "H. R." ].map((head, i) => (
          <Box key={i} sx={{ 
            border: "1px solid black", 
            p: 0.5, 
            textAlign: "center", 
            fontWeight: "bold", 
            fontSize: "0.7rem",
            bgcolor: i < 2 || i > 7 ? "#E0E0E0" : "transparent"
          }}>
            {head}
          </Box>
        ))}

        {/* Filas de horarios */}
        {franjas.map((franja, fIdx) => (
          <React.Fragment key={franja.orden}>
            {/* Hora Reloj (Izquierda) */}
            <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold" }}>
              {franja.desde}<br/>{franja.hasta}
            </Box>
            {/* Hora Cátedra (Izquierda) */}
            <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {franja.orden}º
            </Box>

            {/* Días de la semana */}
            {dias.map((dia) => {
              const entry = celdas.get(cellKey(dia.numero, franja.orden));
              const materias = entry?.materias || [];
              return (
                <Box key={dia.numero} sx={{ 
                  border: "1px solid black", 
                  minHeight: "50px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {materias.map(renderMateria)}
                </Box>
              );
            })}

            {/* Hora Cátedra (Derecha) */}
            <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {franja.orden}º
            </Box>
             {/* Hora Reloj (Derecha) */}
             <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold" }}>
              {franja.desde}<br/>{franja.hasta}
            </Box>
          </React.Fragment>
        ))}
      </Box>

      {/* PIE DE PAGINA / OBSERVACIONES */}
      <Box sx={{ mt: 1, p: 1, border: "2px solid black", display: "flex", alignItems: "flex-start", gap: 3 }}>
        <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: "bold", display: "block", textDecoration: "underline" }}>
                OBSERVACIONES:
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                {tabla.observaciones || "---"}
            </Typography>
        </Box>
        
        {/* Leyenda de materias cuatrimestrales */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ border: "1px solid black", p: 0.5 }}>
            <Box sx={{ 
                width: 40, height: 25, border: "1px solid black",
                background: `linear-gradient(to top right, transparent calc(50% - 0.5px), #000, transparent calc(50% + 0.5px))`
            }} />
            <Typography variant="caption" sx={{ fontSize: "0.6rem", width: 140 }}>
                Celdas con línea diagonal - corresponden a materias cuatrimestrales
            </Typography>
        </Stack>
      </Box>
    </Box>
  );
};

export default InstitutionalScheduleFormat;
