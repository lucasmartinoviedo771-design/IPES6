import { useSearchParams } from "react-router-dom";
import { Stack, TextField, Typography, Paper, Grid, Divider, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { listarPreinscripciones } from "@/api/preinscripciones";
import PreConfirmEditor from "@/components/preinscripcion/PreConfirmEditor";
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";

const formatName = (p: any) => {
  let apellido = p.estudiante.apellido || "";
  let nombre = p.estudiante.nombres ?? p.estudiante.nombre ?? "";

  // Heurística: si apellido NO está todo ne mayúsculas y nombre SÍ (y tiene contenido), 
  // asumimos que están invertidos (el usuario puso el apellido en nombres).
  // Solo aplicamos si nombre tiene algo de largo para evitar falsos positivos con iniciales.
  const isUpper = (s: string) => s && s.length > 1 && s === s.toUpperCase();
  const isNotUpper = (s: string) => s && s !== s.toUpperCase();

  if (isNotUpper(apellido) && isUpper(nombre)) {
    return `${nombre}, ${apellido}`;
  }
  return [apellido, nombre].filter(Boolean).join(", ");
};

export default function ConfirmarInscripcionSecretaria() {
  const [sp, setSp] = useSearchParams();
  const codigo = sp.get("codigo") || "";
  const dni = sp.get("dni") || "";
  const nombre = sp.get("q") || "";

  const query = (codigo || dni || nombre).trim();
  const { data } = useQuery({
    queryKey: ["preins-busq-sec", query],
    queryFn: () => listarPreinscripciones({ search: query || undefined, limit: 20, offset: 0, exclude_confirmed: true }),

  });

  // La confirmación y el manejo de documentación se realizan dentro de PreConfirmEditor

  return (
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Formalizar inscripción"
        subtitle="Busca al aspirante y completá la confirmación presencial"
      />

      {!codigo && (
        <Paper sx={{ p: 2 }}>
          <Stack gap={2}>
            <Typography variant="h6" mb={1} fontWeight={600}>
              Buscar aspirante
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField size="small" label="DNI" fullWidth value={dni} onChange={(e) => setSp({ dni: e.target.value || "" })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField size="small" label="Apellido y Nombre" fullWidth value={nombre} onChange={(e) => setSp({ q: e.target.value || "" })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField size="small" label="Código PRE-..." fullWidth value={codigo} onChange={(e) => setSp({ codigo: e.target.value || "" })} />
              </Grid>
            </Grid>
            <Divider />
            <Typography variant="body2" color="text.secondary">Resultados</Typography>
            {/* Selector rápido de preinscripto */}
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6} lg={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="sel-preins">Seleccionar preinscripto</InputLabel>
                  <Select
                    labelId="sel-preins"
                    label="Seleccionar preinscripto"
                    value=""
                    onChange={(e) => setSp({ codigo: String(e.target.value) })}
                    disabled={!data?.results || data.results.length === 0}
                  >
                    {(data?.results || []).map((p: any) => (
                      <MenuItem key={p.codigo} value={p.codigo}>
                        {formatName(p)} — {p.codigo}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <List>
              {data?.results?.map((p: any) => (
                <ListItem key={p.codigo} button onClick={() => setSp({ codigo: p.codigo })}>
                  <ListItemText primary={formatName(p)} secondary={`DNI ${p.estudiante.dni} • ${p.codigo} • ${p.carrera?.nombre || ''}`} />
                </ListItem>
              ))}
              {!data?.results && <Typography variant="body2" color="text.secondary">Ingrese un criterio de búsqueda.</Typography>}
              {data?.results && data.results.length === 0 && <Typography variant="body2" color="text.secondary">Sin resultados.</Typography>}
            </List>
          </Stack>
        </Paper>
      )}

      {codigo && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <PreConfirmEditor codigo={codigo} />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
