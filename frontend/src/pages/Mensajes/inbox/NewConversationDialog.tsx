import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";
import SearchIcon from "@mui/icons-material/Search";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  buscarUsuariosMensajes,
  ConversationCreatePayload,
  crearConversacion,
  listarTemasMensajes,
  MessageTopicDTO,
  SimpleUserDTO,
} from "@/api/mensajes";
import { useAuth } from "@/context/AuthContext";
import { isOnlyEstudiante } from "@/utils/roles";
import { NewConversationDialogProps, ROLE_OPTIONS, MASS_ROLE_RULES } from "./types";
import { useDebouncedValue } from "./useDebouncedValue";

export const NewConversationDialog: React.FC<NewConversationDialogProps> = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const studentOnly = isOnlyEstudiante(user);
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
    if (!selectedRoles.includes("estudiante")) {
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

                {selectedRoles.includes("estudiante") && (
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
