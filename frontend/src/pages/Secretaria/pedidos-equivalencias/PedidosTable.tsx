import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";

import { PedidoEquivalenciaDTO } from "@/api/estudiantes";
import { WORKFLOW_CHIP_COLOR, RESULTADO_LABEL, RESULTADO_COLOR, ResultadoFinal } from "./types";

interface PedidosTableProps {
  loading: boolean;
  pedidos: PedidoEquivalenciaDTO[];
  downloadingId: number | null;
  enviandoId: number | null;
  isTutor: boolean;
  isEquivalencias: boolean;
  isTitulos: boolean;
  onDescargarPDF: (pedido: PedidoEquivalenciaDTO) => void;
  onEnviarPedido: (pedido: PedidoEquivalenciaDTO) => void;
  onOpenDocumentacion: (pedido: PedidoEquivalenciaDTO) => void;
  onOpenEvaluacion: (pedido: PedidoEquivalenciaDTO) => void;
  onOpenTitulos: (pedido: PedidoEquivalenciaDTO) => void;
  onOpenNotificar: (pedido: PedidoEquivalenciaDTO) => void;
}

const PedidosTable: React.FC<PedidosTableProps> = ({
  loading,
  pedidos,
  downloadingId,
  enviandoId,
  isTutor,
  isEquivalencias,
  isTitulos,
  onDescargarPDF,
  onEnviarPedido,
  onOpenDocumentacion,
  onOpenEvaluacion,
  onOpenTitulos,
  onOpenNotificar,
}) => {
  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Cargando pedidos...
      </Typography>
    );
  }

  if (pedidos.length === 0) {
    return <Alert severity="info">No se encontraron pedidos con los filtros aplicados.</Alert>;
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Estudiante</TableCell>
              <TableCell>Profesorado destino</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Actualizado</TableCell>
              <TableCell>Seguimiento</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pedidos.map((pedido) => {
              const workflowColor = WORKFLOW_CHIP_COLOR[pedido.workflow_estado] || "default";
              const docRegistrada = Boolean(pedido.documentacion_registrada_en);
              const docPresentada = Boolean(pedido.documentacion_presentada);
              const docChipLabel = docRegistrada
                ? docPresentada
                  ? "Documentación registrada"
                  : "Sin documentación"
                : "Documentación pendiente";
              const docChipColor = docPresentada ? "success" : docRegistrada ? "warning" : "default";
              const titulosRegistrados = Boolean(pedido.titulos_registrado_en);
              const notificado = pedido.workflow_estado === "notified";
              const resultadoFinal = (pedido.resultado_final || "pendiente") as ResultadoFinal;
              const titulosLabel = titulosRegistrados
                ? pedido.titulos_documento_tipo === "ambos"
                  ? "Nota y disposición registradas"
                  : pedido.titulos_documento_tipo === "nota"
                    ? "Nota registrada"
                    : pedido.titulos_documento_tipo === "disposicion"
                      ? "Disposición registrada"
                      : "Documentación cargada"
                : "Títulos pendiente";
              const canRegistrarDocumentacion = isTutor && ["pending_docs", "review"].includes(pedido.workflow_estado);
              const canRegistrarEvaluacion = isEquivalencias && pedido.workflow_estado === "review";
              const canRegistrarTitulos = isTitulos && pedido.workflow_estado === "titulos";
              const canNotificar = isTutor && ["titulos", "notified"].includes(pedido.workflow_estado) && titulosRegistrados;
              const canEnviar = isTutor && pedido.workflow_estado === "draft";
              return (
                <TableRow key={pedido.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {pedido.estudiante_nombre || "Sin nombre"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      DNI {pedido.estudiante_dni}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{pedido.profesorado_destino_nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pedido.plan_destino_resolucion}
                    </Typography>
                  </TableCell>
                  <TableCell>{pedido.tipo === "ANEXO_A" ? "Anexo A" : "Anexo B"}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Chip
                        size="small"
                        label={pedido.estado_display}
                        color={pedido.estado === "final" ? "success" : "default"}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={pedido.workflow_estado_display}
                        color={workflowColor}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>{new Date(pedido.updated_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Chip size="small" label={docChipLabel} color={docChipColor} />
                      <Chip size="small" label={RESULTADO_LABEL[resultadoFinal]} color={RESULTADO_COLOR[resultadoFinal]} />
                      <Chip size="small" label={titulosLabel} color={titulosRegistrados ? "success" : "default"} />
                      <Chip size="small" label={notificado ? "Notificado" : "Sin notificar"} color={notificado ? "success" : "default"} />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Button
                        size="small"
                        startIcon={<DownloadIcon fontSize="small" />}
                        onClick={() => onDescargarPDF(pedido)}
                        disabled={downloadingId === pedido.id}
                      >
                        Descargar PDF
                      </Button>
                      {canEnviar && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onEnviarPedido(pedido)}
                          disabled={enviandoId === pedido.id}
                        >
                          {enviandoId === pedido.id ? "Enviando..." : "Enviar a circuito"}
                        </Button>
                      )}
                      {canRegistrarDocumentacion && (
                        <Button size="small" variant="outlined" onClick={() => onOpenDocumentacion(pedido)}>
                          Documentación
                        </Button>
                      )}
                      {canRegistrarEvaluacion && (
                        <Button size="small" variant="outlined" onClick={() => onOpenEvaluacion(pedido)}>
                          Evaluación
                        </Button>
                      )}
                      {canRegistrarTitulos && (
                        <Button size="small" variant="outlined" onClick={() => onOpenTitulos(pedido)}>
                          Títulos
                        </Button>
                      )}
                      {canNotificar && (
                        <Button size="small" variant="outlined" onClick={() => onOpenNotificar(pedido)}>
                          Notificar
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PedidosTable;
