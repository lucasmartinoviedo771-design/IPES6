import { useMemo, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import { useQuery } from "@tanstack/react-query";
import { listarPreinscripciones } from "@/api/preinscripciones";
import { useAuth } from "@/context/AuthContext";
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

  const currentSpCodigo = sp.get("codigo") || "";
  const currentSpDni = sp.get("dni") || "";
  const currentSpNombre = sp.get("q") || "";

  const [codigo, setCodigo] = useState(currentSpCodigo);
  const [dni, setDni] = useState(currentSpDni);
  const [nombre, setNombre] = useState(currentSpNombre);

  const handleSearch = () => {
    const currentSp = new URLSearchParams(sp);
    let changed = false;

    if (codigo) { currentSp.set("codigo", codigo); changed = true; }
    else { if (currentSp.has("codigo")) { currentSp.delete("codigo"); changed = true; } }

    if (dni) { currentSp.set("dni", dni); changed = true; }
    else { if (currentSp.has("dni")) { currentSp.delete("dni"); changed = true; } }

    if (nombre) { currentSp.set("q", nombre); changed = true; }
    else { if (currentSp.has("q")) { currentSp.delete("q"); changed = true; } }

    if (!codigo && !dni && !nombre) {
      setSp(new URLSearchParams(), { replace: true });
      return;
    }

    if (changed) {
      setSp(currentSp, { replace: true });
    }
  };

  useEffect(() => {
    if (currentSpCodigo !== codigo) setCodigo(currentSpCodigo);
    if (currentSpDni !== dni) setDni(currentSpDni);
    if (currentSpNombre !== nombre) setNombre(currentSpNombre);
  }, [currentSpCodigo, currentSpDni, currentSpNombre]);

  const query = (currentSpCodigo || currentSpDni || currentSpNombre).trim();
  const { data } = useQuery({
    queryKey: ["preins-busq-sec", query],
    queryFn: () => listarPreinscripciones({ search: query || undefined, limit: 20, offset: 0, exclude_confirmed: true }),
  });

  const { user } = useAuth();
  const myProfIds = user?.profesorado_ids || [];

  const results = useMemo(() => {
    if (!data?.results) return [];
    const base = [...data.results];
    if (myProfIds.length === 0) return base;

    return base.sort((a, b) => {
      const aOk = myProfIds.includes(a.carrera?.id);
      const bOk = myProfIds.includes(b.carrera?.id);
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      return 0;
    });
  }, [data?.results, myProfIds]);

  // Auto-redirect if searching by DNI/Code and we have a preferred match
  useEffect(() => {
    if (currentSpCodigo || results.length === 0) return;

    // Si buscamos por DNI y hay resultados, intentamos ir al que es "mío"
    if (currentSpDni && currentSpDni.length >= 7) {
      const mine = results.find(r => myProfIds.includes(r.carrera?.id));
      if (mine && mine.codigo) {
        setSp({ codigo: mine.codigo }, { replace: true });
      } else if (results.length === 1 && results[0].codigo) {
        // Si hay uno solo y no es mío, igual vamos para facilitar
        setSp({ codigo: results[0].codigo }, { replace: true });
      }
    }
  }, [results, currentSpCodigo, currentSpDni, myProfIds]);

  // La confirmación y el manejo de documentación se realizan dentro de PreConfirmEditor

  return (
    <Stack gap={3}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Formalizar inscripción"
        subtitle="Busca al aspirante y completá la confirmación presencial"
      />

      {!currentSpCodigo && (
        <Paper sx={{ p: 2 }}>
          <Stack gap={2}>
            <Typography variant="h6" mb={1} fontWeight={600}>
              Buscar aspirante
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField size="small" label="DNI" fullWidth value={dni} onChange={(e) => setDni(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField size="small" label="Apellido y Nombre" fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField size="small" label="Código PRE-..." fullWidth value={codigo} onChange={(e) => setCodigo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button variant="contained" fullWidth onClick={handleSearch} startIcon={<SearchIcon />}>
                  Buscar
                </Button>
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
                    onChange={(e) => {
                      const val = String(e.target.value);
                      if (val) setSp({ codigo: val });
                    }}
                    disabled={results.length === 0}
                  >
                    {results.map((p: any) => (
                      <MenuItem key={p.id} value={p.codigo} disabled={!p.codigo}>
                        {formatName(p)} — {p.codigo || "Sin Código PRE"} {myProfIds.includes(p.carrera?.id) ? "(Tu carrera ★)" : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <List>
              {results.map((p: any) => {
                const isMine = myProfIds.includes(p.carrera?.id);
                return (
                  <ListItem
                    key={p.id}
                    button
                    disabled={!p.codigo}
                    onClick={() => {
                      if (p.codigo) setSp({ codigo: p.codigo });
                    }}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      borderLeft: isMine ? '5px solid #2e7d32' : 'none',
                      bgcolor: isMine ? 'rgba(46, 125, 50, 0.04)' : 'transparent',
                      opacity: !p.codigo ? 0.5 : 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatName(p)}
                          {isMine && <Typography variant="caption" sx={{ bgcolor: 'success.main', color: 'white', px: 0.8, borderRadius: 1, fontWeight: 700 }}>MÍA</Typography>}
                          {!p.codigo && <Typography variant="caption" color="error">Inscripción corrupta (Falta código PRE)</Typography>}
                        </Box>
                      }
                      secondary={`${p.carrera?.nombre || ''} • DNI ${p.estudiante.dni} ${p.codigo ? `• ${p.codigo}` : ''}`}
                    />
                  </ListItem>
                );
              })}
              {results.length === 0 && query && <Typography variant="body2" color="text.secondary">Sin resultados.</Typography>}
              {!query && <Typography variant="body2" color="text.secondary">Ingrese un criterio de búsqueda.</Typography>}
            </List>
          </Stack>
        </Paper>
      )}

      {currentSpCodigo && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <PreConfirmEditor codigo={currentSpCodigo} />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
