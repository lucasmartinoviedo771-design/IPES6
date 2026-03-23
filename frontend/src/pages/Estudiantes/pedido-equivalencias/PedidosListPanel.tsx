import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { PedidoEquivalenciaDTO } from "@/api/estudiantes";

interface PedidosListPanelProps {
  pedidos: PedidoEquivalenciaDTO[];
  loadingPedidos: boolean;
  selectedId: number | null;
  eliminandoId: number | null;
  descargando: boolean;
  canGestionar: boolean;
  onSelectPedido: (pedido: PedidoEquivalenciaDTO) => void;
  onNuevoPedido: () => void;
  onEliminar: (id: number) => void;
  onDescargar: () => void;
}

export default function PedidosListPanel({
  pedidos, loadingPedidos, selectedId, eliminandoId, descargando,
  canGestionar, onSelectPedido, onNuevoPedido, onEliminar, onDescargar,
}: PedidosListPanelProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Pedidos registrados
          </Typography>
          <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={onNuevoPedido}>
            Nuevo
          </Button>
        </Stack>
        {loadingPedidos ? (
          <Typography variant="body2" color="text.secondary">
            Cargando pedidos...
          </Typography>
        ) : pedidos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Todavía no registraste pedidos en esta ventana.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {pedidos.map((pedido) => (
              <Card
                key={pedido.id}
                variant={pedido.id === selectedId ? "elevation" : "outlined"}
                sx={{
                  borderColor: pedido.id === selectedId ? "primary.main" : "divider",
                  cursor: "pointer",
                }}
                onClick={() => onSelectPedido(pedido)}
              >
                <CardContent sx={{ pb: "12px !important" }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" fontWeight={600}>
                        {pedido.profesorado_destino_nombre || "Profesorado sin nombre"}
                      </Typography>
                      <Chip
                        size="small"
                        label={pedido.estado_display}
                        color={pedido.estado === "final" ? "success" : "default"}
                      />
                    </Stack>
                    {canGestionar && (
                      <Typography variant="caption" color="text.secondary">
                        {pedido.estudiante_nombre || ""} · DNI {pedido.estudiante_dni}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <span>
                          <IconButton size="small" onClick={() => onSelectPedido(pedido)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Descargar">
                        <span>
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectPedido(pedido);
                              onDescargar();
                            }}
                            disabled={descargando && pedido.id === selectedId}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <span>
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEliminar(pedido.id);
                            }}
                            disabled={eliminandoId === pedido.id}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
