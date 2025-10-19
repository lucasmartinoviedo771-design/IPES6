import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

type MockMateriaHabilitada = {
  id: number;
  nombre: string;
  anio: number;
  cuatrimestre: string;
  regularidad: string;
  correlativas: { id: number; nombre: string; estado: string }[];
  comisiones: {
    id: number;
    turno: string;
    horario: string;
    cupo: number;
    disponible: number;
  }[];
};

type MockPendiente = {
  id: number;
  nombre: string;
  requiere?: string[];
  motivo?: string;
  ultimaSituacion?: string | null;
};

type MockInscripta = {
  id: number;
  nombre: string;
  comision: string;
  comprobante: string;
};

const mockData = {
  alumno: { nombre: "Ana Gómez", plan: "Profesorado en Educación Primaria", anioCal: 2025 },
  ventana: { nombre: "2.º cuatrimestre 2025", estado: "Abierta hasta 20/08" },
  habilitadas: [
    {
      id: 101,
      nombre: "Didáctica General",
      anio: 2,
      cuatrimestre: "C2",
      regularidad: "Regular",
      correlativas: [{ id: 77, nombre: "Didáctica I", estado: "Aprobada" }],
      comisiones: [
        { id: 3, turno: "Tarde", horario: "Mar y Jue 18:00–21:00", cupo: 35, disponible: 12 },
        { id: 4, turno: "Mañana", horario: "Lun y Mié 9:00–12:00", cupo: 30, disponible: 5 },
      ],
    },
    {
      id: 111,
      nombre: "Curriculum",
      anio: 2,
      cuatrimestre: "C2",
      regularidad: "Regular",
      correlativas: [],
      comisiones: [
        { id: 9, turno: "Virtual", horario: "Clases sincrónicas Jueves 20:00", cupo: 60, disponible: 42 },
      ],
    },
  ] satisfies MockMateriaHabilitada[],
  pendientes: {
    correlativa: [
      {
        id: 205,
        nombre: "Práctica II",
        requiere: ["Aprobar Didáctica General", "Completar informes de Práctica I"],
        ultimaSituacion: "Inscripta en 2024 – Libre",
      },
    ] satisfies MockPendiente[],
    legajo: [
      {
        id: 301,
        nombre: "EDL: Literatura Infantil",
        motivo: "No se puede inscribir porque el legajo está marcado como condicional (Título secundario en trámite).",
      },
    ] satisfies MockPendiente[],
  },
  inscriptas: [
    { id: 55, nombre: "Historia de la Educación", comision: "Comisión 1 – Miércoles 18:00", comprobante: "#INS-2025-1234" },
  ] satisfies MockInscripta[],
};

export default function InscripcionPreview() {
  return (
    <Box sx={{ p: 4, bgcolor: "#f9f5ea", minHeight: "100vh" }}>
      <Stack spacing={3} maxWidth={1180} mx="auto">
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Inscripción a Materias</Typography>
            <Typography color="text.secondary">
              Alumna: <strong>{mockData.alumno.nombre}</strong> • Plan: {mockData.alumno.plan}
            </Typography>
            <Typography color="text.secondary">
              Ventana actual: <strong>{mockData.ventana.nombre}</strong> ({mockData.ventana.estado})
            </Typography>
          </Box>
          <Chip color="primary" label={`Año académico ${mockData.alumno.anioCal}`} sx={{ fontWeight: 600 }} />
        </Stack>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #e3d7bc", bgcolor: "#fff" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom color="primary.dark">
            Materias habilitadas para inscribirte
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se muestran solo las materias que cumplen correlatividades y están dentro de la ventana de inscripción.
          </Typography>

          <Stack spacing={2}>
            {mockData.habilitadas.map((materia) => (
              <Box key={materia.id} sx={{ p: 2.5, borderRadius: 2, border: "1px solid #d4c4a5", bgcolor: "#fefbf4" }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6">{materia.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {materia.anio}° año • {materia.cuatrimestre} • Regularidad actual: {materia.regularidad}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                      {materia.correlativas.length === 0 ? (
                        <Chip size="small" color="success" label="Sin correlativas pendientes" />
                      ) : (
                        materia.correlativas.map((cor) => (
                          <Chip key={cor.id} size="small" color="success" label={`${cor.nombre}: ${cor.estado}`} />
                        ))
                      )}
                    </Stack>
                  </Box>

                  <Stack spacing={1} minWidth={280}>
                    {materia.comisiones.map((comision) => (
                      <Box key={comision.id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#fff" }}>
                        <Typography variant="body2" fontWeight={600}>{comision.turno}</Typography>
                        <Typography variant="body2" color="text.secondary">{comision.horario}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cupo: {comision.disponible}/{comision.cupo}
                        </Typography>
                        <Button variant="contained" size="small" sx={{ mt: 1 }}>
                          Inscribirme en esta comisión
                        </Button>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Accordion defaultExpanded sx={{ bgcolor: "#fffaf1", borderRadius: 3, border: "1px solid #e2d4b5" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>Materias pendientes / no disponibles</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Divider textAlign="left" sx={{ mb: 2 }}>Correlativas pendientes</Divider>
            <Stack spacing={2} mb={3}>
              {mockData.pendientes.correlativa.map((item) => (
                <Box key={item.id} sx={{ p: 2.5, borderRadius: 2, border: "1px dashed #d3c19c", bgcolor: "#fff" }}>
                  <Typography fontWeight={600}>{item.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">Para inscribirte necesitás:</Typography>
                  <Stack component="ul" sx={{ mt: 1, pl: 3, listStyle: "circle" }}>
                    {item.requiere?.map((req) => (
                      <Typography component="li" key={req}>{req}</Typography>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Última situación: {item.ultimaSituacion || "Sin cursadas registradas"}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Divider textAlign="left" sx={{ mb: 2 }}>Bloqueadas por legajo/administrativo</Divider>
            <Stack spacing={2}>
              {mockData.pendientes.legajo.map((item) => (
                <Box key={item.id} sx={{ p: 2, borderRadius: 2, border: "1px dashed #d3c19c", bgcolor: "#fff" }}>
                  <Typography fontWeight={600}>{item.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.motivo}</Typography>
                  <Button size="small" sx={{ mt: 1 }} variant="outlined">
                    Ver requisitos del legajo
                  </Button>
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #d8ccb0", bgcolor: "#fff" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Materias ya inscriptas en esta ventana
          </Typography>
          <Stack spacing={2}>
            {mockData.inscriptas.map((item) => (
              <Box key={item.id} sx={{ p: 2, borderRadius: 2, border: "1px solid #cbb891", bgcolor: "#f7f1df" }}>
                <Typography fontWeight={600}>{item.nombre}</Typography>
                <Typography variant="body2" color="text.secondary">{item.comision}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <Chip label="Inscripta" color="success" size="small" />
                  <Button size="small" variant="text">Descargar comprobante</Button>
                  <Button size="small" color="error" variant="outlined">Cancelar inscripción</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
