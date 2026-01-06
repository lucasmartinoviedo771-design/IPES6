import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import DescriptionIcon from "@mui/icons-material/Description";
import SearchIcon from "@mui/icons-material/Search";
import AttachmentIcon from "@mui/icons-material/Attachment";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import { PageHero } from "@/components/ui/GradientTitles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

import {
  buscarUsuariosMensajes,
  ConversationCountsDTO,
  ConversationCreatePayload,
  ConversationDetailDTO,
  ConversationSummaryDTO,
  ConversationStatus,
  crearConversacion,
  enviarMensaje,
  listarConversaciones,
  listarTemasMensajes,
  obtenerConversacion,
  obtenerResumenMensajes,
  solicitarCierreConversacion,
  cerrarConversacion,
  MessageTopicDTO,
  SimpleUserDTO,
  MessageDTO,
} from "@/api/mensajes";
import { useAuth } from "@/context/AuthContext";
import { hasAnyRole, isOnlyStudent } from "@/utils/roles";

const ROLE_OPTIONS = [
  { value: "alumno", label: "Estudiantes" },
  { value: "docente", label: "Docentes" },
  { value: "bedel", label: "Bedeles" },
  { value: "tutor", label: "Tutores" },
  { value: "coordinador", label: "Coordinadores" },
  { value: "secretaria", label: "Secretaría" },
  { value: "admin", label: "Administradores" },
  { value: "jefa_aaee", label: "Jefa de AAEE" },
  { value: "jefes", label: "Jefes" },
  { value: "consulta", label: "Consulta" },
];

const MASS_ROLE_RULES: Record<string, string[] | null> = {
  admin: null,
  secretaria: null,
  jefa_aaee: null,
  jefes: null,
  coordinador: ["alumno", "docente"],
  tutor: ["alumno"],
  bedel: ["alumno"],
  preinscripciones: [],
  consulta: [],
  alumno: [],
};


interface ConversationFilters {
  status?: ConversationStatus | "";
  unreadOnly?: boolean;
  topicId?: number | "";
}

interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationIds: number[]) => void;
}

const DEFAULT_FILTERS: ConversationFilters = {
  status: "open",
  unreadOnly: false,
  topicId: "",
};

const SLA_COLOR: Record<string, { color: string; icon: React.ReactNode }> = {
  warning: { color: "warning.main", icon: <WarningAmberIcon fontSize="small" /> },
  danger: { color: "error.main", icon: <ErrorOutlineIcon fontSize="small" /> },
};

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const studentOnly = isOnlyStudent(user);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SimpleUserDTO[]>([]);
  const [allowStudentReply, setAllowStudentReply] = useState<boolean>(true);
  const [topicId, setTopicId] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [selectedCarreras, setSelectedCarreras] = useState<number[]>([]);

  const debouncedSearch = useDebouncedValue(search);

  const { data: topics } = useQuery<MessageTopicDTO[]>({
    queryKey: ["mensajes", "temas"],
    queryFn: listarTemasMensajes,
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchResults, isFetching: searching } = useQuery<SimpleUserDTO[]>({
    queryKey: ["mensajes", "buscar", debouncedSearch],
    queryFn: () => buscarUsuariosMensajes(debouncedSearch),
    enabled: debouncedSearch.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!open) {
      setSubject("");
      setBody("");
      setSelectedRoles([]);
      setSelectedUsers([]);
      setAllowStudentReply(true);
      setTopicId("");
      setSelectedCarreras([]);
      setSearch("");
    }
  }, [open]);

  const normalizedUserRoles = useMemo(() => {
    const roles = new Set<string>();
    if (user?.roles) {
      user.roles.forEach((role) => {
        const normalized = role.toLowerCase().trim();
        if (normalized) {
          roles.add(normalized);
        }
      });
    }
    if (user?.is_superuser || user?.is_staff) {
      roles.add("admin");
    }
    return roles;
  }, [user]);

  const allowedMassRoleValues = useMemo(() => {
    if (!normalizedUserRoles.size) {
      return [] as string[];
    }
    let allowAll = false;
    const allowed = new Set<string>();
    normalizedUserRoles.forEach((role) => {
      const rule = MASS_ROLE_RULES[role];
      if (rule === null) {
        allowAll = true;
      } else if (Array.isArray(rule)) {
        rule.forEach((value) => allowed.add(value));
      }
    });
    if (allowAll) {
      return ROLE_OPTIONS.map((option) => option.value);
    }
    return Array.from(allowed);
  }, [normalizedUserRoles]);

  const availableRoleOptions = useMemo(() => {
    if (studentOnly || allowedMassRoleValues.length === 0) {
      return [] as typeof ROLE_OPTIONS;
    }
    const allowedSet = new Set(allowedMassRoleValues);
    return ROLE_OPTIONS.filter((option) => allowedSet.has(option.value));
  }, [allowedMassRoleValues, studentOnly]);

  useEffect(() => {
    setSelectedRoles((prev) =>
      prev.filter((role) => availableRoleOptions.some((option) => option.value === role)),
    );
  }, [availableRoleOptions]);

  useEffect(() => {
    if (!selectedRoles.includes("alumno")) {
      setSelectedCarreras([]);
    }
  }, [selectedRoles]);

  const mutation = useMutation({
    mutationFn: (payload: ConversationCreatePayload) => crearConversacion(payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["mensajes", "conversaciones"] });
      await queryClient.invalidateQueries({ queryKey: ["mensajes", "resumen"] });
      onCreated(data.created_ids);
    },
  });

  const handleSubmit = () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      return;
    }
    const payload: ConversationCreatePayload = {
      subject: subject.trim(),
      body: trimmedBody,
      recipients: selectedUsers.map((u) => u.id),
      roles: selectedRoles.length ? selectedRoles : undefined,
      carreras: selectedCarreras.length ? selectedCarreras : undefined,
      allow_student_reply: allowStudentReply,
      topic_id: topicId === "" ? undefined : Number(topicId),
    };
    mutation.mutate(payload, {
      onSuccess: () => onClose(),
    });
  };

  const canCreate =
    body.trim().length > 0 &&
    (selectedUsers.length > 0 || selectedRoles.length > 0) &&
    !mutation.isPending;

  const getErrorMessage = () => {
    const err = mutation.error;
    if (!err) return null;
    if (isAxiosError(err)) {
      const data = err.response?.data as any;
      if (data?.detail) {
        if (Array.isArray(data.detail)) {
          return data.detail
            .map((item: any) => {
              const path = Array.isArray(item.loc)
                ? item.loc.filter(Boolean).join(" \u203A ")
                : "";
              const message = item.msg || item.message || JSON.stringify(item);
              return path ? `${path}: ${message}` : message;
            })
            .join(" | ");
        }
        if (typeof data.detail === "string") {
          return data.detail;
        }
      }
      if (typeof data === "string") return data;
    }
    return (err as Error).message || "No se pudo crear la conversación.";
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Nueva conversación</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
        <TextField
          label="Asunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Tema"
          select
          fullWidth
          size="small"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <MenuItem value="">Sin etiqueta</MenuItem>
          {topics?.map((topic) => (
            <MenuItem key={topic.id} value={topic.id}>
              {topic.name}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <Typography fontWeight={600} mb={1}>
            Destinatarios
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              label="Buscar usuarios (nombre, email, usuario...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              placeholder="Escribe al menos 2 caracteres"
              InputProps={{
                endAdornment: searching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : (
                  <InputAdornment position="end">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {searchResults && search.trim().length >= 2 && (
              <Paper variant="outlined" sx={{ maxHeight: 160, overflowY: "auto" }}>
                <List dense>
                  {searchResults.length === 0 && (
                    <ListItemText
                      primary="No se encontraron usuarios"
                      primaryTypographyProps={{
                        component: "span",
                        variant: "body2",
                        sx: { px: 2, py: 1.5 },
                      }}
                    />
                  )}
                  {searchResults.map((candidate) => {
                    const already = selectedUsers.some((u) => u.id === candidate.id);
                    return (
                      <ListItemButton
                        key={candidate.id}
                        onClick={() => {
                          if (!already) {
                            setSelectedUsers((prev) => [...prev, candidate]);
                          }
                        }}
                        disabled={already}
                      >
                        <ListItemText
                          disableTypography
                          primary={candidate.name}
                          secondary={candidate.roles.join(", ")}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Paper>
            )}

            {selectedUsers.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {selectedUsers.map((u) => (
                  <Chip
                    key={u.id}
                    label={u.name}
                    onDelete={() =>
                      setSelectedUsers((prev) => prev.filter((item) => item.id !== u.id))
                    }
                  />
                ))}
              </Stack>
            )}

            {availableRoleOptions.length > 0 && (
              <>
                <TextField
                  label="Roles destinatarios"
                  select
                  SelectProps={{ multiple: true }}
                  value={selectedRoles}
                  size="small"
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedRoles(typeof value === "string" ? value.split(",") : value);
                  }}
                >
                  {availableRoleOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>


                {selectedRoles.includes("alumno") && (
                  <TextField
                    label="Carreras (IDs separados por coma)"
                    helperText="Opcional: limitar estudiantes a carreras específicas"
                    value={selectedCarreras.join(",")}
                    size="small"
                    onChange={(event) => {
                      const tokens = event.target.value
                        .split(",")
                        .map((token) => Number(token.trim()))
                        .filter((num) => !Number.isNaN(num));
                      setSelectedCarreras(tokens);
                    }}
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={allowStudentReply}
                      onChange={(e) => setAllowStudentReply(e.target.checked)}
                    />
                  }
                  label="Permitir que los estudiantes respondan (para mensajes masivos)"
                />
              </>
            )}

          </Stack>
        </Box>

        <TextField
          label="Mensaje"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minRows={4}
          multiline
          fullWidth
        />
        {mutation.isError && (
          <Alert severity="error">{getErrorMessage()}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canCreate}
          startIcon={mutation.isPending ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Enviar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const MessageBubble: React.FC<{
  message: MessageDTO;
  isOwn: boolean;
}> = ({ message, isOwn }) => {
  return (
    <Stack
      direction="column"
      alignItems={isOwn ? "flex-end" : "flex-start"}
      spacing={0.5}
      sx={{ width: "100%" }}
    >
      <Typography variant="caption" color="text.secondary">
        {message.author_name} • {dayjs(message.created_at).format("DD/MM/YYYY HH:mm")}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1.5,
          maxWidth: "100%",
          borderRadius: 2,
          borderColor: isOwn ? "success.light" : "divider",
          backgroundColor: isOwn ? "rgba(46,125,50,0.08)" : "background.paper",
          whiteSpace: "pre-wrap",
        }}
      >
        <Typography variant="body2">{message.body}</Typography>
        {message.attachment_url && (
          <Button
            size="small"
            component="a"
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 1 }}
            startIcon={<AttachmentIcon fontSize="small" />}
          >
            {message.attachment_name ?? "PDF adjunto"}
          </Button>
        )}
      </Paper>
    </Stack>
  );
};

const MensajesInboxPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ConversationFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);

  const canCreateMessages = user ? hasAnyRole(user, ["admin", "secretaria", "bedel"]) : false;

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

  const isOwnMessage = (message: MessageDTO) => {
    return message.author_id === user?.id;
  };

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
          <Paper variant="outlined" sx={{ p: 1.5, height: "100%", minHeight: 520 }}>
            <Stack spacing={1.5}>
              <TextField
                label="Estado"
                select
                size="small"
                value={filters.status ?? ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value as ConversationStatus | "" }))
                }
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="open">Abiertas</MenuItem>
                <MenuItem value="close_requested">Cierre solicitado</MenuItem>
                <MenuItem value="closed">Cerradas</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={!!filters.unreadOnly}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, unreadOnly: e.target.checked }))
                    }
                  />
                }
                label="Solo no leídas"
              />
              <Divider />
            </Stack>

            <Box sx={{ mt: 1, maxHeight: "70vh", overflowY: "auto" }}>
              {loadingConversations && (
                <Stack alignItems="center" py={4}>
                  <CircularProgress size={24} />
                </Stack>
              )}
              {!loadingConversations && (!conversations || conversations.length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  No hay conversaciones para mostrar.
                </Typography>
              )}
              <List dense disablePadding>
                {conversations?.map((conversation) => {
                  const selected = conversation.id === selectedId;
                  const slaInfo = conversation.sla ? SLA_COLOR[conversation.sla] : null;
                  return (
                    <ListItemButton
                      key={conversation.id}
                      selected={selected}
                      onClick={() => handleSelectConversation(conversation)}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        alignItems: "flex-start",
                        "&.Mui-selected": {
                          backgroundColor: "rgba(46,125,50,0.12)",
                        },
                      }}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" noWrap fontWeight={conversation.unread ? 700 : 500}>
                              {conversation.subject || "(Sin asunto)"}
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                              {conversation.unread && <MarkEmailUnreadIcon fontSize="small" />}
                              {slaInfo && (
                                <Box sx={{ color: slaInfo.color }}>{slaInfo.icon}</Box>
                              )}
                            </Stack>
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                              {conversation.topic ? `${conversation.topic} • ` : ""}
                              {conversation.last_message_at
                                ? dayjs(conversation.last_message_at).fromNow()
                                : "Sin mensajes"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {conversation.last_message_excerpt || "Sin preview"}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8} lg={9}>
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
                ) : conversationDetail.participants.find((p) => p.user_id === user?.id)?.can_reply ? (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Responder"
                      multiline
                      minRows={3}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
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
                              setReplyAttachment(file);
                            }
                          }}
                        />
                      </Button>
                      {replyAttachment && (
                        <Chip
                          label={replyAttachment.name}
                          onDelete={() => setReplyAttachment(null)}
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
                    {(sendMutation.isError) && (
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





