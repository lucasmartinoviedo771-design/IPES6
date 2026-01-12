import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  AssignmentInd as AssignmentIcon
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import { client as axios } from '@/api/client';
import { PageHero, SectionTitlePill } from "@/components/ui/GradientTitles";
import BackButton from "@/components/ui/BackButton";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

interface User {
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

const AsignarRolPage: React.FC = () => {
  const { user: currentUser, refreshProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profesorados, setProfesorados] = useState<Profesorado[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedProfesorados, setSelectedProfesorados] = useState<number[]>([]);

  const roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'secretaria', label: 'Secretaría' },
    { value: 'bedel', label: 'Bedel' },
    { value: 'jefa_aaee', label: 'Jefa A.A.E.E.' },
    { value: 'jefes', label: 'Jefes' },
    { value: 'docente', label: 'Docente' },
    { value: 'tutor', label: 'Tutor' },
    { value: 'coordinador', label: 'Coordinador' },
    { value: 'consulta', label: 'Consulta' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, profRes] = await Promise.all([
        axios.get('management/users-list?' + new Date().getTime()),
        axios.get('profesorados/')
      ]);
      setUsers(usersRes.data);
      setProfesorados(profRes.data);

      // Si hay un usuario seleccionado, actualizarlo con los datos frescos
      if (selectedUser) {
        const updatedUser = usersRes.data.find((u: User) => u.id === selectedUser.id);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      }
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: 'assign' | 'remove', roleToRemove?: string) => {
    const role = action === 'assign' ? selectedRole : roleToRemove;

    if (!selectedUser || !role) {
      setError('Por favor seleccione un usuario y un rol');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post('management/asignar-rol', {
        user_id: selectedUser.id,
        role: role,
        profesorado_ids: role === 'bedel' ? selectedProfesorados : [],
        action: action
      });

      setSuccess(`Rol ${action === 'assign' ? 'asignado' : 'quitado'} correctamente`);
      if (action === 'assign') {
        setSelectedRole('');
        setSelectedProfesorados([]);
      }
      fetchData(); // Recargar para ver cambios
      // Si modificamos el rol del usuario actual, actualizar su perfil
      if (currentUser && selectedUser.id === currentUser.id) {
        await refreshProfile();
      }
    } catch (err: any) {
      const message = err?.message || err?.response?.data?.message || 'Error al procesar la solicitud';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const nonStudentUsers = users.filter(u => !u.groups.includes('alumno'));

  return (
    <Box sx={{ p: 3 }}>
      <BackButton fallbackPath="/secretaria" />
      <PageHero
        title="Asignar / Quitar Roles"
        subtitle="Gestione permisos y responsabilidades del personal institucional."
      />

      <Stack spacing={4}>
        <Paper sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" mb={3}>
            Nueva Asignación
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
            <Autocomplete
              sx={{ minWidth: 300, flex: 2 }}
              options={nonStudentUsers}
              getOptionLabel={(option) => `${option.last_name}, ${option.first_name} (${option.username})`}
              renderInput={(params) => <TextField {...params} label="Usuario" variant="outlined" />}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
            />

            <FormControl sx={{ minWidth: 200, flex: 1 }}>
              <InputLabel>Rol</InputLabel>
              <Select
                value={selectedRole}
                label="Rol"
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedRole === 'bedel' && (
              <Autocomplete
                multiple
                sx={{ minWidth: 300, flex: 2 }}
                options={profesorados}
                getOptionLabel={(option) => option.nombre}
                renderInput={(params) => <TextField {...params} label="Profesorados que gestiona" />}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option.nombre} {...getTagProps({ index })} />
                  ))
                }
                onChange={(_, newValue) => setSelectedProfesorados(newValue.map(p => p.id))}
              />
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <AssignmentIcon />}
              onClick={() => handleAction('assign')}
              disabled={submitting || !selectedUser || !selectedRole}
              sx={{
                height: 56,
                px: 4,
                borderRadius: 2,
                bgcolor: INSTITUTIONAL_TERRACOTTA,
                '&:hover': { bgcolor: INSTITUTIONAL_TERRACOTTA_DARK }
              }}
            >
              Asignar
            </Button>
          </Box>
        </Paper>

        {selectedUser && (
          <Paper sx={{ p: 4, borderRadius: 4 }}>
            <Typography variant="h6" mb={3}>
              Roles de {selectedUser.first_name} {selectedUser.last_name}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {selectedUser.groups.length === 0 ? (
                <Typography color="text.secondary">Este usuario no tiene roles asignados.</Typography>
              ) : (
                selectedUser.groups.map((group) => (
                  <ListItem key={group} sx={{ bgcolor: 'grey.50', mb: 1, borderRadius: 2 }}>
                    <ListItemText
                      primary={roles.find(r => r.value === group)?.label || group.toUpperCase()}
                      secondary={group === 'alumno' ? 'Rol automático de estudiante' : 'Rol administrativo'}
                    />
                    <ListItemSecondaryAction>
                      {group !== 'alumno' && (
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => handleAction('remove', group)}
                          disabled={submitting}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        )}
      </Stack>

      <Box sx={{ mt: 3 }}>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      </Box>
    </Box>
  );
};

export default AsignarRolPage;
