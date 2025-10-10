import { Grid, Paper, Typography, Stack, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import SchoolIcon from "@mui/icons-material/School";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import ArticleIcon from "@mui/icons-material/Article";
import PersonIcon from "@mui/icons-material/Person";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventNoteIcon from "@mui/icons-material/EventNote";

const CardLink = ({ icon, title, to }: { icon: React.ReactNode; title: string; to: string }) => {
  const nav = useNavigate();
  return (
    <Paper
      onClick={() => nav(to)}
      sx={{ p:2, display:"flex", gap:1.5, alignItems:"center", cursor:"pointer",
        borderRadius:3, transition:"all .1s", "&:hover":{ boxShadow:"0 8px 24px rgba(0,0,0,.06)", transform:"translateY(-2px)" } }}
      elevation={0}
    >
      {icon}
      <Typography fontWeight={700}>{title}</Typography>
    </Paper>
  );
};

export default function SecretariaIndex(){
  return (
    <Stack gap={2}>
      <Typography variant="h5" fontWeight={800}>Secretaría</Typography>
      <Typography color="text.secondary">Centro de operaciones: altas y administración</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<SchoolIcon />} title="Cargar Profesorado" to="/secretaria/profesorado" /></Grid>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<LibraryBooksIcon />} title="Cargar Plan" to="/secretaria/plan" /></Grid>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<ArticleIcon />} title="Cargar Materias" to="/secretaria/materias" /></Grid>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<PersonIcon />} title="Cargar Docentes" to="/secretaria/docentes" /></Grid>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<AssignmentIndIcon />} title="Asignar Rol" to="/secretaria/asignar-rol" /></Grid>
        <Grid item xs={12} sm={6} md={4}><CardLink icon={<EventNoteIcon />} title="Cargar Horario" to="/secretaria/horarios" /></Grid>
      </Grid>
    </Stack>
  );
}