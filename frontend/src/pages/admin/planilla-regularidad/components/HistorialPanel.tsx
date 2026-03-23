import React from 'react';
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { UseQueryResult } from '@tanstack/react-query';

interface HistorialPanelProps {
  isReadOnly: boolean;
  selectedMateria?: any;
  profesoradoId: number | '';
  historyQuery: UseQueryResult<any[], Error>;
  historyMenuAnchor: HTMLElement | null;
  isHistoryOpen: boolean;
  handleOpenHistory: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleCloseHistory: () => void;
  handleImportFromPlanilla: (id: number) => void;
  handleAutoCalculateAll: () => void;
  handleCopyStudents: () => void;
  handlePasteStudents: () => void;
  handleClearRows: () => void;
  handleAddRow: () => void;
  rowsToAdd: string;
  setRowsToAdd: (value: string) => void;
}

export const HistorialPanel: React.FC<HistorialPanelProps> = ({
  isReadOnly,
  selectedMateria,
  profesoradoId,
  historyQuery,
  historyMenuAnchor,
  isHistoryOpen,
  handleOpenHistory,
  handleCloseHistory,
  handleImportFromPlanilla,
  handleAutoCalculateAll,
  handleCopyStudents,
  handlePasteStudents,
  handleClearRows,
  handleAddRow,
  rowsToAdd,
  setRowsToAdd,
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>Detalle de estudiantes</Typography>
        {!isReadOnly && (
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={handleAutoCalculateAll}
            disabled={!selectedMateria}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Sugerir situaciones académicas
          </Button>
        )}
        {/* Exportar/Copiar listado - Disponible siempre incluso en Solo Lectura */}
        <Tooltip title="Exportar/Copiar lista de estudiantes para usar en otra planilla">
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={handleCopyStudents}
            sx={{ borderRadius: 2, textTransform: 'none', ml: 1 }}
          >
            Exportar alumnos
          </Button>
        </Tooltip>
      </Box>
      {!isReadOnly && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Typography variant="body2" sx={{ mr: 1, fontSize: '0.85rem' }}>Agregar filas al final:</Typography>
            <TextField
              size="small"
              type="number"
              value={rowsToAdd}
              onChange={(e) => setRowsToAdd(e.target.value)}
              sx={{ width: 60 }}
              disabled={isReadOnly}
              inputProps={{ min: 1, sx: { py: 0.5, px: 1 } }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddCircleOutlineIcon fontSize="small" />}
              onClick={() => handleAddRow()}
              disabled={isReadOnly}
              sx={{ textTransform: 'none', px: 1, minWidth: 'auto' }}
            >
              Agregar
            </Button>

            <Button
              variant="outlined"
              size="small"
              color="primary"
              startIcon={historyQuery.isFetching ? <CircularProgress size={16} /> : <HistoryIcon fontSize="small" />}
              onClick={handleOpenHistory}
              disabled={isReadOnly || historyQuery.isFetching}
              sx={{ textTransform: 'none', px: 1, minWidth: 'auto' }}
            >
              Importar de otra planilla
            </Button>

            <Tooltip title="Pegar lista de estudiantes exportada/copiada previamente">
              <Button
                variant="outlined"
                size="small"
                color="success"
                startIcon={<ContentPasteIcon fontSize="small" />}
                onClick={handlePasteStudents}
                disabled={isReadOnly}
                sx={{ textTransform: 'none', px: 1, minWidth: 'auto' }}
              >
                Pegar alumnos
              </Button>
            </Tooltip>

            <Menu
              anchorEl={historyMenuAnchor}
              open={isHistoryOpen}
              onClose={handleCloseHistory}
              PaperProps={{
                sx: { maxHeight: 300, width: '350px' }
              }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="overline" fontWeight={700}>Planillas recientes</Typography>
              </Box>
              <Divider />
              {historyQuery.data?.filter(p => !profesoradoId || p.profesorado_id === Number(profesoradoId)).length === 0 ? (
                <MenuItem disabled>No hay planillas previas para esta carrera</MenuItem>
              ) : (
                historyQuery.data
                  ?.filter(p => !profesoradoId || p.profesorado_id === Number(profesoradoId))
                  .slice(0, 10)
                  .map((p) => (
                    <MenuItem key={p.id} onClick={() => handleImportFromPlanilla(p.id)}>
                      <ListItemText
                        primary={`${p.materia_nombre} (${p.fecha})`}
                        secondary={`${p.cantidad_estudiantes} estudiantes - Folio: ${p.folio || '-'}`}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </MenuItem>
                  ))
              )}
            </Menu>
          </Box>

          <Tooltip title="Restablecer filas (limpiar)">
            <IconButton color="warning" size="small" onClick={handleClearRows}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};
