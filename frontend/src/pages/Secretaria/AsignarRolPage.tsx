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
import axios from 'axios';

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
    { value: 'tutor', label: 'Tutor' },
    { value: 'coordinador', label: 'Coordinador' },
    { value: 'consulta', label: 'Consulta' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, profRes] = await Promise.all([
        axios.get('/api/management/users-list'),
        axios.get('/api/profesorados/')
      ]);
      setUsers(usersRes.data);
      setProfesorados(profRes.data);
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
      await axios.post('/api/management/asignar-rol', {
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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al procesar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ 
        background: 'linear-gradient(135deg, #a67c52 0%, #8b6b4d 100%)',
        borderRadius: 4,
        p: 4,
        mb: 4,
        color: 'white',
        boxShadow: '0 10px 30px rgba(166, 124, 82, 0.3)'
      }}>
        <Typography variant="h4" fontWeight={800} textTransform="uppercase">Asignar / Quitar Roles</Typography>
        <Typography variant="body1" sx={{ opacity: 0.8 }}>Gestione permisos y responsabilidades del personal</Typography>
      </Box>

      <Stack spacing={4}>
        <Paper sx={{ p: 4, borderRadius: 4 }}>
          <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon color="primary" /> Nueva Asignación
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
            <Autocomplete
              sx={{ minWidth: 300, flex: 2 }}
              options={users}
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
              sx={{ height: 56, px: 4, borderRadius: 2, bgcolor: '#a67c52', '&:hover': { bgcolor: '#8b6b4d' } }}
            >
              Asignar
            </Button>
          </Box>
        </Paper>

        {selectedUser && (
          <Paper sx={{ p: 4, borderRadius: 4 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Roles actuales de <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
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
