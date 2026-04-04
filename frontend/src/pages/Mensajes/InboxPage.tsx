import React, { useEffect, useMemo, useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageHero } from "@/components/ui/GradientTitles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

import {
  ConversationCountsDTO,
  ConversationDetailDTO,
  ConversationSummaryDTO,
  cerrarConversacion,
  enviarMensaje,
  listarConversaciones,
  obtenerConversacion,
  obtenerResumenMensajes,
  reabrirConversacion,
  solicitarCierreConversacion,
} from "@/api/mensajes";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole } from "@/utils/roles";

import { ConversationFilters, DEFAULT_FILTERS } from "./inbox/types";
import { ConversationList } from "./inbox/ConversationList";
import { ConversationDetail } from "./inbox/ConversationDetail";
import { NewConversationDialog } from "./inbox/NewConversationDialog";

const MensajesInboxPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ConversationFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);

  const canCreateMessages = user ? hasAnyRole(user, ["admin", "secretaria", "bedel", "estudiante"]) : false;

  const { data: summary } = useQuery<ConversationCountsDTO>({
    queryKey: ["mensajes", "resumen"],
    queryFn: obtenerResumenMensajes,
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const {
    data: conversations = [],
    isLoading: loadingConversations,
    refetch: refetchList,
  } = useQuery<ConversationSummaryDTO[]>({
    queryKey: ["mensajes", "conversaciones", filters],
    queryFn: () =>
      listarConversaciones({
        status: filters.status || undefined,
        topic_id: typeof filters.topicId === "number" ? filters.topicId : undefined,
        unread: filters.unreadOnly,
      }),
  });

  const {
    data: conversationDetail,
    refetch: refetchDetail,
    isFetching: loadingDetail,
  } = useQuery<ConversationDetailDTO>({
    queryKey: ["mensajes", "conversacion", selectedId],
    queryFn: () => obtenerConversacion(selectedId!, true),
    enabled: selectedId !== null,
  });

  useEffect(() => {
    if (!selectedId && conversations && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] }).catch(() => { });
  }, [selectedId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: () => {
      if (selectedId === null) throw new Error("Seleccione una conversación");
      return enviarMensaje(selectedId, replyBody, replyAttachment ?? undefined);
    },
    onSuccess: async () => {
      setReplyBody("");
      setReplyAttachment(null);
      await refetchDetail();
      await refetchList();
      await queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] });
    },
  });

  const handleSelectConversation = async (conversation: ConversationSummaryDTO) => {
    setSelectedId(conversation.id);
  };

  const handleCreateConversation = (ids: number[]) => {
    if (ids.length > 0) {
      setSelectedId(ids[0]);
      refetchList();
      queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] }).catch(() => { });
    }
  };

  const selectedConversation = useMemo(
    () => conversations?.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const closeConversationMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Seleccione una conversación");
      return cerrarConversacion(selectedId);
    },
    onSuccess: async () => {
      await refetchDetail();
      await refetchList();
      await queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] });
    },
  });

  const requestCloseMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Seleccione una conversación");
      return solicitarCierreConversacion(selectedId);
    },
    onSuccess: async () => {
      await refetchDetail();
      await refetchList();
    },
  });

  const reabrirMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Seleccione una conversación");
      return reabrirConversacion(selectedId);
    },
    onSuccess: async () => {
      await refetchDetail();
      await refetchList();
      await queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] });
    },
  });

  return (
    <Box sx={{ p: 2 }}>
      <PageHero
        title="Mensajes"
        subtitle="Centro de comunicaciones y avisos internos"
        actions={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title="Actualizar">
              <IconButton size="small" onClick={() => refetchList()}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Badge
              color={
                summary?.sla_danger
                  ? "error"
                  : summary?.sla_warning
                    ? "warning"
                    : "primary"
              }
              badgeContent={summary?.unread ?? 0}
            >
              <MailOutlineIcon color="action" />
            </Badge>
            {canCreateMessages && (
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => setShowNewDialog(true)}>
                Nuevo mensaje
              </Button>
            )}
          </Stack>
        }
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={4} lg={3}>
          <ConversationList
            conversations={conversations}
            loadingConversations={loadingConversations}
            selectedId={selectedId}
            filters={filters}
            onFilterChange={setFilters}
            onSelectConversation={handleSelectConversation}
          />
        </Grid>

        <Grid item xs={12} md={8} lg={9}>
          <ConversationDetail
            selectedConversation={selectedConversation}
            conversationDetail={conversationDetail}
            loadingDetail={loadingDetail}
            replyBody={replyBody}
            replyAttachment={replyAttachment}
            userId={user?.id}
            sendMutation={sendMutation}
            closeConversationMutation={closeConversationMutation}
            requestCloseMutation={requestCloseMutation}
            onReplyBodyChange={setReplyBody}
            onReplyAttachmentChange={setReplyAttachment}
            reopenMutation={reabrirMutation}
          />
        </Grid>
      </Grid>

      <NewConversationDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreated={handleCreateConversation}
      />
    </Box>
  );
};

export default MensajesInboxPage;
