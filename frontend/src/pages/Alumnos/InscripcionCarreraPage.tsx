import React, { useState } from 'react';
import { Button, TextField, Typography, Box, Alert } from '@mui/material';
import { solicitarInscripcionCarrera } from '@/api/alumnos';

const InscripcionCarreraPage: React.FC = () => {
  const [carreraId, setCarreraId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!carreraId) {
      setError("Por favor, ingresa el ID de la carrera.");
      return;
    }
    try {
      const response = await solicitarInscripcionCarrera({ carrera_id: carreraId });
      setMessage(response.message);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al solicitar inscripción a carrera.");
      setMessage(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Solicitud de Inscripción a Carrera</Typography>
      <Typography variant="body1" paragraph>Aquí podrás solicitar tu inscripción a una carrera.</Typography>
      
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        label="ID de Carrera"
        type="number"
        fullWidth
        value={carreraId ?? ''}
        onChange={(e) => setCarreraId(Number(e.target.value))}
        sx={{ mb: 2 }}
      />
      <Button variant="contained" onClick={handleSubmit}>Enviar Solicitud</Button>
    </Box>
  );
};

export default InscripcionCarreraPage;
