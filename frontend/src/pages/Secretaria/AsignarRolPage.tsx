import React, { useState, useEffect, useCallback } from 'react';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AssignmentIcon from "@mui/icons-material/AssignmentInd";
import { useAuth } from '@/context/AuthContext';
import { client as axios } from '@/api/client';
import { PageHero } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

interface StaffUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  groups: string[];
}

interface Profesorado {
  id: number;
  nombre: string;
}

interface Asignacion {
  id: number;
  rol: string;
  turno: string | null;
  profesorado_id: number | null;
  profesorado_nombre: string;
}

const ROLES = [
  { value: 'admin',      label: 'Administrador',   requiereProf: false, requiereTurno: false },
  { value: 'secretaria', label: 'Secretaría',       requiereProf: false, requiereTurno: false },
  { value: 'bedel',      label: 'Bedel',            requiereProf: true,  requiereTurno: false, multiProf: true },
  { value: 'jefa_aaee',  label: 'Jefa A.A.E.E.',   requiereProf: false, requiereTurno: false },
  { value: 'jefes',      label: 'Jefes',            requiereProf: false, requiereTurno: false },
  { value: 'docente',    label: 'Docente',           requiereProf: false, requiereTurno: false },
  { value: 'tutor',      label: 'Tutor',             requiereProf: false, requiereTurno: true,  multiProf: true, profOpcional: true },
  { value: 'coordinador',label: 'Coordinador',      requiereProf: true,  requiereTurno: false, multiProf: false },
  { value: 'consulta',   label: 'Consulta',          requiereProf: false, requiereTurno: false },
];

const TURNOS = [
  { value: 'manana',     label: 'Mañana' },
  { value: 'tarde',      label: 'Tarde' },
  { value: 'vespertino', label: 'Vespertino' },
];

const TURNO_LABEL: Record<string, string> = {
  manana: 'Mañana', tarde: 'Tarde', vespertino: 'Vespertino',
};

const ROL_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

const AsignarRolPage: React.FC = () => {
  const { user: currentUser, refreshProfile } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [selectedProfesorados, setSelectedProfesorados] = useState<Profesorado[]>([]);
  const [editingAsig, setEditingAsig] = useState<Asignacion | null>(null);

  const rolConfig = ROLES.find(r => r.value === selectedRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, profRes] = await Promise.all([
        axios.get('staff?' + Date.now()),
        axios.get('profesorados/'),
      ]);
      setUsers(usersRes.data);
      setProfesorados(profRes.data);
      if (selectedUser) {
        const updated = usersRes.data.find((u: StaffUser) => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    } catch {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  const fetchAsignaciones = useCallback(async (userId: number) => {
    try {
      const { data } = await axios.get(`staff/${userId}/asignaciones`);
      setAsignaciones(data);
    } catch {
      setAsignaciones([]);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selectedUser) fetchAsignaciones(selectedUser.id);
    else setAsignaciones([]);
  }, [selectedUser]);

  // Reset campos de asignación al cambiar rol (solo si no estamos editando)
  useEffect(() => {
    if (!editingAsig) {
      setSelectedTurno('');
      setSelectedProfesorados([]);
      setError(null);
    }
  }, [selectedRole]);

  const handleStartEdit = (asig: Asignacion) => {
    setEditingAsig(asig);
    setSelectedRole(asig.rol);
    setSelectedTurno(asig.turno ?? '');
    setSelectedProfesorados(
      asig.profesorado_id
        ? profesorados.filter(p => p.id === asig.profesorado_id)
        : []
    );
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingAsig(null);
    setSelectedRole('');
    setSelectedTurno('');
    setSelectedProfesorados([]);
    setError(null);
  };

  const handleAssign = async () => {
    if (!selectedUser || !selectedRole) { setError('Seleccioná un usuario y un rol'); return; }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // Si estamos editando: primero eliminamos la asignación anterior
      if (editingAsig) {
        await axios.post('staff/roles', {
          user_id: selectedUser.id,
          role: editingAsig.rol,
          profesorado_ids: editingAsig.profesorado_id ? [editingAsig.profesorado_id] : [],
          action: 'remove',
        });
      }

      await axios.post('staff/roles', {
        user_id: selectedUser.id,
        role: selectedRole,
        profesorado_ids: selectedProfesorados.map(p => p.id),
        turno: selectedTurno || null,
        action: 'assign',
      });

      setSuccess(editingAsig ? 'Asignación actualizada correctamente.' : 'Rol asignado correctamente.');
      setEditingAsig(null);
      setSelectedRole('');
      setSelectedTurno('');
      setSelectedProfesorados([]);
      await fetchData();
      await fetchAsignaciones(selectedUser.id);
      if (currentUser?.id === selectedUser.id) await refreshProfile();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al asignar el rol.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRole = async (role: string) => {
    if (!selectedUser) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.post('staff/roles', {
        user_id: selectedUser.id,
        role,
        profesorado_ids: [],
        action: 'remove',
      });
      setSuccess(`Rol "${ROL_LABEL[role] ?? role}" quitado correctamente.`);
      await fetchData();
      await fetchAsignaciones(selectedUser.id);
      if (currentUser?.id === selectedUser.id) await refreshProfile();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al quitar el rol.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAsignacion = async (asig: Asignacion) => {
    if (!selectedUser) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.post('staff/roles', {
        user_id: selectedUser.id,
        role: asig.rol,
        profesorado_ids: asig.profesorado_id ? [asig.profesorado_id] : [],
        action: 'remove',
      });
      setSuccess('Asignación eliminada.');
      await fetchData();
      await fetchAsignaciones(selectedUser.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al eliminar la asignación.');
    } finally {
      setSubmitting(false);
    }
  };

  const nonStudentUsers = users.filter(u => !u.groups.includes('estudiante'));

  // Roles del usuario que tienen asignaciones detalladas
  const rolesConAsignacion = new Set(asignaciones.map(a => a.rol));
  // Roles simples (sin profesorado ni turno)
  const rolesSinAsignacion = (selectedUser?.groups ?? []).filter(
    g => !rolesConAsignacion.has(g) && g !== 'estudiante'
  );

  const isFormValid = () => {
    if (!selectedUser || !selectedRole) return false;
    if (rolConfig?.requiereTurno && !selectedTurno) return false;
    if (rolConfig?.requiereProf && !rolConfig.profOpcional && selectedProfesorados.length === 0) return false;
    return true;
  };

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Asignar / Quitar Roles"
        subtitle="Gestione permisos y responsabilidades del personal institucional."
      />

      <Stack spacing={3}>
        {/* Formulario de asignación */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>
            {editingAsig ? `Editando: ${ROL_LABEL[editingAsig.rol] ?? editingAsig.rol}` : 'Nueva asignación'}
          </Typography>
          {editingAsig && (
            <Alert severity="info" sx={{ mb: 2 }} action={
              <Button size="small" onClick={handleCancelEdit}>Cancelar</Button>
            }>
              Modificá los campos y hacé clic en Guardar para actualizar la asignación.
            </Alert>
          )}

          <Stack spacing={2}>
            {/* Usuario */}
            <Autocomplete
              options={nonStudentUsers}
              getOptionLabel={u => `${u.last_name}, ${u.first_name} (${u.username})`}
              renderInput={params => <TextField {...params} label="Usuario" />}
              value={selectedUser}
              onChange={(_, v) => { setSelectedUser(v); setSelectedRole(''); }}
            />

            {/* Rol */}
            <FormControl>
              <InputLabel>Rol</InputLabel>
              <Select value={selectedRole} label="Rol" onChange={e => setSelectedRole(e.target.value)}>
                {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Turno — solo para tutores (requerido) */}
            {rolConfig?.requiereTurno && (
              <FormControl required>
                <InputLabel>Turno *</InputLabel>
                <Select value={selectedTurno} label="Turno *" onChange={e => setSelectedTurno(e.target.value)}>
                  {TURNOS.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                  El tutor cubre este turno. Podés asignarle profesorados específicos o dejar vacío para cubrir todos.
                </Typography>
              </FormControl>
            )}

            {/* Profesorados */}
            {(rolConfig?.requiereProf || (rolConfig?.profOpcional && rolConfig?.requiereTurno)) && (
              <Autocomplete
                multiple={rolConfig?.multiProf !== false}
                options={profesorados}
                getOptionLabel={p => p.nombre}
                renderInput={params => (
                  <TextField
                    {...params}
                    label={
                      rolConfig?.profOpcional
                        ? 'Profesorados (opcional — vacío = todos del turno)'
                        : rolConfig?.multiProf === false
                        ? 'Profesorado *'
                        : 'Profesorados *'
                    }
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option.nombre} size="small" {...getTagProps({ index })} />
                  ))
                }
                value={selectedProfesorados}
                onChange={(_, v) => setSelectedProfesorados(Array.isArray(v) ? v : v ? [v] : [])}
              />
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <AssignmentIcon />}
                onClick={handleAssign}
                disabled={submitting || !isFormValid()}
                sx={{ bgcolor: INSTITUTIONAL_TERRACOTTA, '&:hover': { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK } }}
              >
                {editingAsig ? 'Guardar cambios' : 'Asignar'}
              </Button>
              {editingAsig && (
                <Button variant="outlined" onClick={handleCancelEdit} disabled={submitting}>
                  Cancelar
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        {/* Roles y asignaciones del usuario seleccionado */}
        {selectedUser && (
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Roles de {selectedUser.first_name} {selectedUser.last_name}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {asignaciones.length === 0 && rolesSinAsignacion.length === 0 ? (
              <Typography color="text.secondary">Este usuario no tiene roles asignados.</Typography>
            ) : (
              <List disablePadding>
                {/* Roles con asignación detallada (bedel, tutor, coordinador) */}
                {asignaciones.map(asig => (
                  <ListItem
                    key={asig.id}
                    sx={{
                      bgcolor: editingAsig?.id === asig.id ? 'primary.50' : 'grey.50',
                      border: editingAsig?.id === asig.id ? '1px solid' : '1px solid transparent',
                      borderColor: editingAsig?.id === asig.id ? 'primary.main' : 'transparent',
                      mb: 1, borderRadius: 2, pr: 11,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{ROL_LABEL[asig.rol] ?? asig.rol}</Typography>
                          {asig.turno && (
                            <Chip label={`Turno ${TURNO_LABEL[asig.turno] ?? asig.turno}`} size="small" color="primary" variant="outlined" />
                          )}
                        </Stack>
                      }
                      secondary={asig.profesorado_nombre}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" color="primary" disabled={submitting} onClick={() => handleStartEdit(asig)} sx={{ mr: 0.5 }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" color="error" disabled={submitting} onClick={() => handleRemoveAsignacion(asig)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}

                {/* Roles simples (sin profesorado) */}
                {rolesSinAsignacion.map(group => (
                  <ListItem key={group} sx={{ bgcolor: 'grey.50', mb: 1, borderRadius: 2, pr: 7 }}>
                    <ListItemText
                      primary={<Typography fontWeight={600}>{ROL_LABEL[group] ?? group.toUpperCase()}</Typography>}
                      secondary="Rol sin asignación específica"
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" color="error" disabled={submitting} onClick={() => handleRemoveRole(group)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        )}

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      </Stack>
    </Box>
  );
};

export default AsignarRolPage;
