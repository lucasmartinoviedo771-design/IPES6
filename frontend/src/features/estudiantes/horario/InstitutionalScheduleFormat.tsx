import React, { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { HorarioTablaDTO, HorarioMateriaCeldaDTO } from "@/api/estudiantes";

// Colores institucionales por profesorado (ajustables)
const PROFESORADO_COLORS: Record<number, string> = {
  1: "#FCD5B4", // Geografía (Naranja claro)
  2: "#FFFF99", // Lengua (Amarillo)
  3: "#C6EFCE", // Biología (Verde)
  4: "#D9E1F2", // Inglés (Azul)
  5: "#E2EFDA", // Primaria
  6: "#FCE4D6", // Inicial
  17: "#FCD5B4", // Historia
  // Se pueden añadir más según sea necesario
};

const cleanProfesoradoName = (name: string) => {
  return name
    .replace(/Profesorado de Educación Secundaria en/gi, "")
    .replace(/Profesorado de Educación/gi, "")
    .replace(/Profesorado en/gi, "")
    .trim();
};

const DEFAULT_COLOR = "#F2F2F2";

type InstitutionalScheduleFormatProps = {
  tabla: HorarioTablaDTO;
  salon?: string;
  cuatrimestre?: string;
};

const cellKey = (dia: number, posicion: number) => `${dia}-${posicion}`;

const InstitutionalScheduleFormat: React.FC<InstitutionalScheduleFormatProps> = ({
  tabla,
  salon = "---",
  cuatrimestre,
}) => {
  const bgColor = PROFESORADO_COLORS[tabla.profesorado_id] || DEFAULT_COLOR;

  const dias = useMemo(() => [...tabla.dias].sort((a, b) => a.numero - b.numero), [tabla.dias]);
  const franjas = useMemo(() => [...tabla.franjas].sort((a, b) => a.posicion - b.posicion), [tabla.franjas]);

  const celdas = useMemo(() => {
    const map = new Map<string, any>();
    tabla.celdas.forEach((celda) => {
      map.set(cellKey(celda.dia_numero, celda.franja_posicion), celda);
    });
    return map;
  }, [tabla.celdas]);

  const renderMateria = (materia: HorarioMateriaCeldaDTO, isMulti: boolean) => {
    // Si queremos filtrar por cuatrimestre
    if (cuatrimestre && materia.cuatrimestre !== cuatrimestre) {
        return null;
    }

    return (
      <Box 
        key={materia.materia_id}
        sx={{ 
          position: "relative",
          width: "100%", 
          flex: 1,
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          p: 0.2,
          minHeight: isMulti ? "40px" : "60px",
          borderBottom: isMulti ? "1px dashed #ccc" : "none",
          "&:last-child": { borderBottom: "none" },
          ...(materia.es_cuatrimestral && {
             background: `linear-gradient(to top right, transparent calc(50% - 0.5px), #e0e0e0, transparent calc(50% + 0.5px))`
          })
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: "600", fontSize: "0.7rem", lineHeight: 1.1, color: "black" }}>
          {materia.materia_nombre}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: "0.55rem", mt: 0.2, fontStyle: "italic", color: "#333" }}>
          {materia.docentes.length ? `Prof. ${materia.docentes[0]}` : "Sin Docente"}
        </Typography>
        {materia.es_cuatrimestral && !cuatrimestre && (
            <Typography variant="caption" sx={{ position: "absolute", bottom: 0, right: 2, fontSize: "0.5rem", fontWeight: "bold", opacity: 0.7 }}>
                {materia.cuatrimestre}
            </Typography>
        )}
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
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "1.1rem" }}>
          PROFESORADO EN {cleanProfesoradoName(tabla.profesorado_nombre)}
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
          {tabla.turno_nombre.toUpperCase()}
        </Typography>
        <Typography sx={{ fontWeight: "bold", fontSize: "1.4rem", textDecoration: "underline", flex: 1, textAlign: "center", ml: 12 }}>
          {tabla.anio_plan_label.toUpperCase().replace("ANIO", "AÑO")}
        </Typography>
        <Typography sx={{ fontWeight: "bold", fontSize: "1.1rem", minWidth: "100px", textAlign: "right" }}>
          {salon}
        </Typography>
      </Box>

      {/* TABLA DE HORARIOS */}
      <Box sx={{ 
          display: "grid", 
          gridTemplateColumns: `70px 35px repeat(${dias.length}, 1fr) 35px 70px`, 
          border: "1px solid black" 
      }}>
        {/* Cabecera de tabla */}
        <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", fontWeight: "bold", fontSize: "0.7rem", bgcolor: "#E0E0E0" }}>H. R.</Box>
        <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", fontWeight: "bold", fontSize: "0.7rem", bgcolor: "#E0E0E0" }}>H.C.</Box>
        {dias.map((dia) => (
           <Box key={dia.numero} sx={{ border: "1px solid black", p: 0.5, textAlign: "center", fontWeight: "bold", fontSize: "0.7rem" }}>
             {dia.nombre.toUpperCase()}
           </Box>
        ))}
        <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", fontWeight: "bold", fontSize: "0.7rem", bgcolor: "#E0E0E0" }}>H.C.</Box>
        <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", fontWeight: "bold", fontSize: "0.7rem", bgcolor: "#E0E0E0" }}>H. R.</Box>

        {/* Filas de horarios */}
        {franjas.map((franja, index) => {
          const [h1, m1] = franja.desde.split(":").map(Number);
          const [h2, m2] = franja.hasta.split(":").map(Number);
          const duration = (h2 * 60 + m2) - (h1 * 60 + m1);
          const isRecreo = franja.es_recreo || (duration > 0 && duration <= 15);

          if (isRecreo) {
            return (
              <React.Fragment key={`recreo-${index}`}>
                 {/* Reloj Izquierdo Recreo */}
                <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                  {franja.desde}<br/>{franja.hasta}
                </Box>
                {/* Cat Izquierda Recreo */}
                <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                  -
                </Box>

                {/* BANNER CENTRADO RECREO - Solo ocupa las columnas de los días (3 a 8 inclusive) */}
                <Box 
                  sx={{ 
                    gridColumn: "3 / 9", 
                    bgcolor: "#F5F5F5", 
                    border: "1px solid black",
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    py: 0.3,
                    gap: 4
                  }}
                >
                  <Typography sx={{ fontWeight: "bold", fontStyle: "italic", fontSize: "0.8rem", letterSpacing: 3, color: "#444" }}>
                    • R E C R E O •
                  </Typography>
                </Box>

                {/* Cat Derecha Recreo */}
                <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                  -
                </Box>
                {/* Reloj Derecho Recreo */}
                <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                  {franja.desde_sec || franja.desde}<br/>{franja.hasta_sec || franja.hasta}
                </Box>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={franja.orden}>
              {/* Hora Reloj (Izquierda) */}
              <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                {franja.desde}<br/>{franja.hasta}
              </Box>
              {/* Hora Cátedra (Izquierda) */}
              <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                {franja.orden > 0 ? `${franja.orden}º` : ""}
              </Box>

              {/* Días de la semana */}
              {dias.map((dia) => {
                const entry = celdas.get(cellKey(dia.numero, franja.posicion));
                const materias = entry?.materias || [];
                return (
                  <Box key={dia.numero} sx={{ 
                    border: "1px solid black", 
                    minHeight: "85px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    justifyContent: "stretch",
                    bgcolor: materias.length > 0 ? "white" : "transparent",
                    overflow: "hidden"
                  }}>
                    {materias
                      .filter((m: HorarioMateriaCeldaDTO) => !cuatrimestre || m.cuatrimestre === cuatrimestre)
                      .map((m: HorarioMateriaCeldaDTO) => renderMateria(m, false))
                    }
                  </Box>
                );
              })}

              {/* Hora Cátedra (Derecha) */}
              <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                {franja.orden > 0 ? `${franja.orden}º` : ""}
              </Box>
               {/* Hora Reloj (Derecha) */}
               <Box sx={{ border: "1px solid black", p: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: "bold", bgcolor: "#E0E0E0" }}>
                {franja.desde_sec || franja.desde}<br/>{franja.hasta_sec || franja.hasta}
              </Box>
            </React.Fragment>
          );
        })}
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
