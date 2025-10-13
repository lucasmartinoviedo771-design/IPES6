import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Button, Stack, TextField, Typography, Paper, Grid, Divider, List, ListItem, ListItemText, Alert, FormGroup, FormControlLabel, Checkbox, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { listarPreinscripciones, apiConfirmarPreinscripcion } from "@/api/preinscripciones";
import PreConfirmEditor from "@/components/preinscripcion/PreConfirmEditor";
import { useState } from "react";

type DocEstado = 'presentado' | 'pendiente' | 'observado';

export default function ConfirmarInscripcionSecretaria() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const codigo = sp.get("codigo") || "";
  const dni = sp.get("dni") || "";
  const nombre = sp.get("q") || "";

  const query = (codigo || dni || nombre).trim();
  const { data } = useQuery({
    queryKey: ["preins-busq-sec", query],
    queryFn: () => listarPreinscripciones({ q: query, limit: 10, offset: 0 }),
    enabled: !!query && !codigo,
  });

  const [docs, setDocs] = useState<{[k: string]: boolean}>(
    { dni: false, titulo_secundario: false, partida_nacimiento: false, certificado_salud: false, fotos: false }
  );
  const allDocs = Object.values(docs).every(Boolean);

  const confirmar = async () => {
    if (!codigo) return;
    await apiConfirmarPreinscripcion(codigo, { documentos: docs, estado: allDocs ? "regular" : "condicional" });
    navigate(`/secretaria`);
  };

  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>Formalizar inscripción</Typography>

      {!codigo && (
        <Paper sx={{ p:2 }}>
          <Stack gap={2}>
            <Typography variant="subtitle1" fontWeight={700}>Buscar aspirante</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField size="small" label="DNI" fullWidth value={dni} onChange={(e)=>setSp({ dni: e.target.value || "" })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField size="small" label="Apellido y Nombre" fullWidth value={nombre} onChange={(e)=>setSp({ q: e.target.value || "" })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField size="small" label="Código PRE-..." fullWidth value={codigo} onChange={(e)=>setSp({ codigo: e.target.value || "" })} />
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
                    onChange={(e)=> setSp({ codigo: String(e.target.value) })}
                    disabled={!data?.results || data.results.length === 0}
                  >
                    {(data?.results || []).map((p: any) => (
                      <MenuItem key={p.codigo} value={p.codigo}>
                        {p.alumno.apellido}, {p.alumno.nombre} — {p.codigo}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <List>
              {data?.results?.map((p: any) => (
                <ListItem key={p.codigo} button onClick={() => setSp({ codigo: p.codigo })}>
                  <ListItemText primary={`${p.alumno.apellido}, ${p.alumno.nombre}`} secondary={`DNI ${p.alumno.dni} • ${p.codigo} • ${p.carrera?.nombre || ''}`} />
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
          <Grid item xs={12} md={8}>
            <PreConfirmEditor codigo={codigo} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p:2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Documentación presentada</Typography>
              <Alert severity={allDocs ? "success" : "warning"} sx={{ my:1 }}>
                {allDocs ? "Documentación completa: quedará Regular/Inscripto." : "Faltante: quedará Condicional y se registrará pendiente."}
              </Alert>
              <FormGroup>
                <FormControlLabel control={<Checkbox checked={docs.dni} onChange={(_,v)=>setDocs(p=>({...p,dni:v}))} />} label="Fotocopia del DNI" />
                <FormControlLabel control={<Checkbox checked={docs.titulo_secundario} onChange={(_,v)=>setDocs(p=>({...p,titulo_secundario:v}))} />} label="Título Secundario (Original y Copia)" />
                <FormControlLabel control={<Checkbox checked={docs.partida_nacimiento} onChange={(_,v)=>setDocs(p=>({...p,partida_nacimiento:v}))} />} label="Partida de Nacimiento" />
                <FormControlLabel control={<Checkbox checked={docs.certificado_salud} onChange={(_,v)=>setDocs(p=>({...p,certificado_salud:v}))} />} label="Certificado de Buena Salud" />
                <FormControlLabel control={<Checkbox checked={docs.fotos} onChange={(_,v)=>setDocs(p=>({...p,fotos:v}))} />} label="Fotos tipo carnet" />
              </FormGroup>
              <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt:2 }}>
                <Button variant="outlined" onClick={()=>setDocs({ dni:false, titulo_secundario:false, partida_nacimiento:false, certificado_salud:false, fotos:false })}>Limpiar</Button>
                <Button variant="contained" color={allDocs ? "success" : "warning"} onClick={confirmar}>Confirmar Inscripción</Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
