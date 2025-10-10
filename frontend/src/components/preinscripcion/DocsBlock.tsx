import React, { useEffect, useState } from "react";
import { Box, Typography, Stack, Button, TextField, LinearProgress, IconButton, List, ListItem, ListItemText } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { listarDocumentos, subirDocumento, borrarDocumento, descargarDocumento, DocItem } from "@/api/preinscripcionDocs";

type Props = { pid: number };

export default function DocsBlock({ pid }: Props) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("dni_frente");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const fetchDocs = async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await listarDocumentos(pid);
      setDocs(data.results || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [pid]);

  const handleUpload = async () => {
    if (!pid || !file) return;
    setProgress(0);
    await subirDocumento(pid, tipo, file, setProgress);
    setFile(null);
    await fetchDocs();
  };

  const handleDelete = async (id: number) => {
    if (!pid) return;
    await borrarDocumento(pid, id);
    await fetchDocs();
  };

  return (
    <Box>
        <Typography variant="h6" gutterBottom>Documentación</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <TextField
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            helperText="Ej: dni_frente, dni_dorso, foto_4x4, titulo"
            />
            <Button variant="outlined" component="label">
            Seleccionar archivo
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Button>
            <Button variant="contained" onClick={handleUpload} disabled={!file}>Subir</Button>
        </Stack>
        {progress > 0 && progress < 100 && (
            <Box mt={2}><LinearProgress variant="determinate" value={progress} /></Box>
        )}

        <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>Archivos subidos</Typography>
            {loading ? <Typography>Cargando...</Typography> : (
            <List>
                {docs.map(d => (
                <ListItem key={d.id}
                    secondaryAction={
                    <>
                        <IconButton aria-label="download" onClick={() => descargarDocumento(pid, d.id)}>
                        <DownloadIcon />
                        </IconButton>
                        <IconButton aria-label="delete" onClick={() => handleDelete(d.id)}>
                        <DeleteIcon />
                        </IconButton>
                    </>
                    }>
                    <ListItemText primary={`${d.tipo} — ${d.nombre_original}`} secondary={`${(d.tamano/1024).toFixed(1)} KB · ${d.content_type}`} />
                </ListItem>
                ))}
            </List>
            )}
        </Box>
    </Box>
  );
}
