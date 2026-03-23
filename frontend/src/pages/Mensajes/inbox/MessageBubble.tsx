import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AttachmentIcon from "@mui/icons-material/Attachment";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { MessageDTO } from "@/api/mensajes";

dayjs.extend(relativeTime);

export const MessageBubble: React.FC<{
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
