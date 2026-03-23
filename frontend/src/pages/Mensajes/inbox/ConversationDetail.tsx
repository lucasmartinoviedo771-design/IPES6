import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import ReplyIcon from "@mui/icons-material/Reply";
import AttachmentIcon from "@mui/icons-material/Attachment";
import DescriptionIcon from "@mui/icons-material/Description";
import { UseMutationResult } from "@tanstack/react-query";
import {
  ConversationDetailDTO,
  ConversationSummaryDTO,
  MessageDTO,
} from "@/api/mensajes";
import { MessageBubble } from "./MessageBubble";

interface ConversationDetailProps {
  selectedConversation: ConversationSummaryDTO | null;
  conversationDetail: ConversationDetailDTO | undefined;
  loadingDetail: boolean;
  replyBody: string;
  replyAttachment: File | null;
  userId: number | undefined;
  sendMutation: UseMutationResult<any, any, void, any>;
  closeConversationMutation: UseMutationResult<any, any, void, any>;
  requestCloseMutation: UseMutationResult<any, any, void, any>;
  onReplyBodyChange: (value: string) => void;
  onReplyAttachmentChange: (file: File | null) => void;
}

export const ConversationDetail: React.FC<ConversationDetailProps> = ({
  selectedConversation,
  conversationDetail,
  loadingDetail,
  replyBody,
  replyAttachment,
  userId,
  sendMutation,
  closeConversationMutation,
  requestCloseMutation,
  onReplyBodyChange,
  onReplyAttachmentChange,
}) => {
  const isOwnMessage = (message: MessageDTO) => message.author_id === userId;

  return (
    <Paper variant="outlined" sx={{ p: 2, minHeight: 520, display: "flex", flexDirection: "column" }}>
      {!selectedConversation || !conversationDetail ? (
        <Stack flex={1} alignItems="center" justifyContent="center" spacing={2}>
          {loadingDetail ? (
            <CircularProgress />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Selecciona una conversación para ver el detalle.
            </Typography>
          )}
        </Stack>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <Typography variant="h6" fontWeight={700}>
              {selectedConversation.subject || "(Sin asunto)"}
            </Typography>
            <Chip
              size="small"
              label={
                selectedConversation.status === "open"
                  ? "Abierta"
                  : selectedConversation.status === "close_requested"
                    ? "Cierre solicitado"
                    : "Cerrada"
              }
              color={
                selectedConversation.status === "open"
                  ? "success"
                  : selectedConversation.status === "close_requested"
                    ? "warning"
                    : "default"
              }
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Participantes:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
            {selectedConversation.participants.map((participant) => (
              <Chip
                key={participant.id}
                label={`${participant.name} (${participant.roles.join(", ") || "sin rol"})`}
                variant="outlined"
              />
            ))}
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2} sx={{ flex: 1, overflowY: "auto" }}>
            {conversationDetail.messages.map((message) => (
              <MessageBubble key={message.id} message={message} isOwn={isOwnMessage(message)} />
            ))}
            {conversationDetail.messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No hay mensajes todavía.
              </Typography>
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          {conversationDetail.status === "closed" ? (
            <Alert severity="info">La conversación está cerrada.</Alert>
          ) : conversationDetail.participants.find((p) => p.user_id === userId)?.can_reply ? (
            <Stack spacing={1.5}>
              <TextField
                label="Responder"
                multiline
                minRows={3}
                value={replyBody}
                onChange={(e) => onReplyBodyChange(e.target.value)}
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachmentIcon />}
                >
                  Adjuntar PDF
                  <input
                    type="file"
                    hidden
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onReplyAttachmentChange(file);
                      }
                    }}
                  />
                </Button>
                {replyAttachment && (
                  <Chip
                    label={replyAttachment.name}
                    onDelete={() => onReplyAttachmentChange(null)}
                    icon={<DescriptionIcon />}
                  />
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant="contained"
                  startIcon={sendMutation.isPending ? <CircularProgress size={16} /> : <ReplyIcon />}
                  disabled={!replyBody.trim()}
                  onClick={() => sendMutation.mutate()}
                >
                  Enviar
                </Button>
              </Stack>
              {sendMutation.isError && (
                <Alert severity="error">{(sendMutation.error as Error).message}</Alert>
              )}
            </Stack>
          ) : (
            <Alert severity="info">No podés responder en esta conversación.</Alert>
          )}

          <Stack direction="row" spacing={1} mt={2} justifyContent="flex-end">
            {conversationDetail.status === "open" && (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => requestCloseMutation.mutate()}
                disabled={requestCloseMutation.isPending}
              >
                Solicitar cierre
              </Button>
            )}
            {conversationDetail.status !== "closed" && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => closeConversationMutation.mutate()}
                disabled={closeConversationMutation.isPending}
                startIcon={<CloseIcon />}
              >
                Cerrar conversación
              </Button>
            )}
          </Stack>
        </>
      )}
    </Paper>
  );
};
