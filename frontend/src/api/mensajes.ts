import { client } from "@/api/client";

export type ConversationStatus = "open" | "close_requested" | "closed";

export interface MessageTopicDTO {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
}

export interface ParticipantDTO {
  id: number;
  user_id: number;
  name: string;
  roles: string[];
  can_reply: boolean;
  last_read_at?: string | null;
}

export interface MessageDTO {
  id: number;
  author_id?: number | null;
  author_name: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
}

export interface ConversationSummaryDTO {
  id: number;
  subject: string;
  topic?: string | null;
  status: ConversationStatus;
  is_massive: boolean;
  allow_student_reply: boolean;
  last_message_at?: string | null;
  unread: boolean;
  sla?: "warning" | "danger" | null;
  participants: ParticipantDTO[];
  last_message_excerpt?: string | null;
}

export interface ConversationDetailDTO extends ConversationSummaryDTO {
  messages: MessageDTO[];
}

export interface ConversationCreatePayload {
  subject?: string | null;
  topic_id?: number | null;
  body: string;
  recipients?: number[];
  roles?: string[];
  carreras?: number[];
  allow_student_reply?: boolean | null;
  context_type?: string | null;
  context_id?: string | null;
}

export interface ConversationCreateResponse {
  created_ids: number[];
  total_recipients: number;
}

export interface ConversationCountsDTO {
  unread: number;
  sla_warning: number;
  sla_danger: number;
}

export interface SimpleUserDTO {
  id: number;
  name: string;
  roles: string[];
}

export interface ConversationListFilters {
  status?: ConversationStatus;
  topic_id?: number;
  unread?: boolean;
}

export const listarTemasMensajes = async (): Promise<MessageTopicDTO[]> => {
  const { data } = await client.get<MessageTopicDTO[]>("/mensajes/temas");
  return data;
};

export const listarConversaciones = async (
  params?: ConversationListFilters,
): Promise<ConversationSummaryDTO[]> => {
  const { data } = await client.get<ConversationSummaryDTO[]>("/mensajes/conversaciones", {
    params,
  });
  return data;
};

export const obtenerConversacion = async (
  conversationId: number,
  markRead = false,
): Promise<ConversationDetailDTO> => {
  const { data } = await client.get<ConversationDetailDTO>(
    `/mensajes/conversaciones/${conversationId}`,
    { params: { mark_read: markRead ? "true" : undefined } },
  );
  return data;
};

export const crearConversacion = async (
  payload: ConversationCreatePayload,
): Promise<ConversationCreateResponse> => {
  const { data } = await client.post<ConversationCreateResponse>("/mensajes/conversaciones", payload);
  return data;
};

export const enviarMensaje = async (
  conversationId: number,
  body: string,
  attachment?: File | null,
): Promise<MessageDTO> => {
  const form = new FormData();
  form.append("body", body);
  if (attachment) {
    form.append("attachment", attachment);
  }
  const { data } = await client.post<MessageDTO>(
    `/mensajes/conversaciones/${conversationId}/mensajes`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
};

export const marcarConversacionLeida = async (conversationId: number) => {
  await client.post(`/mensajes/conversaciones/${conversationId}/leer`);
};

export const solicitarCierreConversacion = async (conversationId: number) => {
  await client.post(`/mensajes/conversaciones/${conversationId}/solicitar-cierre`);
};

export const cerrarConversacion = async (conversationId: number) => {
  await client.post(`/mensajes/conversaciones/${conversationId}/cerrar`);
};

export const obtenerResumenMensajes = async (): Promise<ConversationCountsDTO> => {
  const { data } = await client.get<ConversationCountsDTO>("/mensajes/resumen");
  return data;
};

export const buscarUsuariosMensajes = async (query: string): Promise<SimpleUserDTO[]> => {
  const { data } = await client.get<SimpleUserDTO[]>("/usuarios/buscar", {
    params: { q: query },
  });
  return data;
};
