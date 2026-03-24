import { ConversationStatus } from "@/api/mensajes";
import { SimpleUserDTO } from "@/api/mensajes";

export interface ConversationFilters {
  status?: ConversationStatus | "";
  unreadOnly?: boolean;
  topicId?: number | "";
  q?: string;
}

export interface NewConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationIds: number[]) => void;
}

export const DEFAULT_FILTERS: ConversationFilters = {
  status: "open",
  unreadOnly: false,
  topicId: "",
  q: "",
};

export const ROLE_OPTIONS = [
  { value: "estudiante", label: "Estudiantes" },
  /*
  { value: "docente", label: "Docentes" },
  */
  { value: "bedel", label: "Bedeles" },
  /*
  { value: "tutor", label: "Tutores" },
  { value: "coordinador", label: "Coordinadores" },
  { value: "secretaria", label: "Secretaría" },
  { value: "admin", label: "Administradores" },
  { value: "jefa_aaee", label: "Jefa de AAEE" },
  { value: "jefes", label: "Jefes" },
  { value: "consulta", label: "Consulta" },
  */
];

export const MASS_ROLE_RULES: Record<string, string[] | null> = {
  /*
  admin: null,
  secretaria: null,
  jefa_aaee: null,
  jefes: null,
  coordinador: ["estudiante", "docente"],
  tutor: ["estudiante"],
  */
  bedel: ["estudiante"],
  /*
  preinscripciones: [],
  consulta: [],
  */
  estudiante: [],
};
