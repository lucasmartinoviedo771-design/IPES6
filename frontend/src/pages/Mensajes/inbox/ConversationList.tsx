import React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ConversationSummaryDTO, ConversationStatus } from "@/api/mensajes";
import { ConversationFilters } from "./types";

dayjs.extend(relativeTime);

const SLA_COLOR: Record<string, { color: string; icon: React.ReactNode }> = {
  warning: { color: "warning.main", icon: <WarningAmberIcon fontSize="small" /> },
  danger: { color: "error.main", icon: <ErrorOutlineIcon fontSize="small" /> },
};

interface ConversationListProps {
  conversations: ConversationSummaryDTO[];
  loadingConversations: boolean;
  selectedId: number | null;
  filters: ConversationFilters;
  onFilterChange: (filters: ConversationFilters) => void;
  onSelectConversation: (conversation: ConversationSummaryDTO) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loadingConversations,
  selectedId,
  filters,
  onFilterChange,
  onSelectConversation,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: "100%", minHeight: 520 }}>
      <Stack spacing={1.5}>
        <TextField
          label="Estado"
          select
          size="small"
          value={filters.status ?? ""}
          onChange={(e) =>
            onFilterChange({ ...filters, status: e.target.value as ConversationStatus | "" })
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
                onFilterChange({ ...filters, unreadOnly: e.target.checked })
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
                onClick={() => onSelectConversation(conversation)}
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
  );
};
