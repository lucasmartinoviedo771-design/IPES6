/**
 * @module API/Client
 * @description Cliente base de comunicaciones HTTP utilizando Axios para el SIGED IPES.
 * Centraliza la lógica de autenticación, manejo global de errores,
 * refresco automático de tokens via cookies y notificaciones (Toasts).
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "@/utils/toast";

/**
 * Prefijo base para todas las llamadas a la API del backend.
 */
const BASE = "/api";
const REFRESH_ENDPOINT = "auth/refresh/";

/**
 * Estructura de error estandarizada del backend Django Ninja.
 */
export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

/**
 * Clase de Error unificada para el frontend.
 * Convierte errores de Axios en una estructura predecible con códigos de negocio.
 */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;
  original?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string,
    original?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.original = original;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

const DEFAULT_ERROR_MESSAGE = "Ocurrió un error inesperado.";
const NETWORK_ERROR_MESSAGE = "No se pudo conectar con el servidor. Verificá tu conexión.";

/**
 * Configuración extendida para peticiones individuales.
 */
export type AppAxiosRequestConfig = AxiosRequestConfig & {
  /** Marca interna para evitar bucles de reintento */
  _retry?: boolean;
  /** Evita mostrar el Toast automático si el llamador desea manejar el error */
  suppressErrorToast?: boolean;
};

/**
 * Instancia global de Axios configurada con soporte para Cookies de sesión.
 */
export const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

type RetriableConfig = AppAxiosRequestConfig;

let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

/**
 * Setea el manejador de cierre de sesión (AuthContext).
 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/**
 * Helpers para extracción de mensajes en respuestas de error complejas.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const candidateKeys = ["message", "detail", "error"];

const extractString = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return value.map(extractString).find(Boolean) ?? null;
  if (isRecord(value)) {
    for (const key of candidateKeys) {
      const res = extractString(value[key]);
      if (res) return res;
    }
  }
  return null;
};

/**
 * Interceptor de Petición: Inyección de Token CSRF para métodos mutativos.
 */
client.interceptors.request.use((config) => {
  const method = (config.method || "").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const csrftoken = getCookie("csrftoken");
    if (csrftoken) {
      config.headers = config.headers ?? {};
      config.headers["X-CSRFToken"] = csrftoken;
    }
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Interceptor de Respuesta: Gestión de Autenticación y Errores Globales.
 */
client.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const data = error.response?.data;

    // --- REFRECHO AUTOMÁTICO (401) ---
    const isAuthRoute = config?.url?.includes("auth/");
    if (status === 401 && config && !config._retry && !isAuthRoute) {
      config._retry = true;
      if (!refreshPromise) {
        refreshPromise = client.post(REFRESH_ENDPOINT)
          .then(() => { refreshPromise = null; })
          .catch((re) => {
            refreshPromise = null;
            unauthorizedHandler?.();
            throw re;
          });
      }
      await refreshPromise;
      return client(config);
    }

    // --- NORMALIZACIÓN DE ERRORES ---
    let code = "UNKNOWN";
    let message = DEFAULT_ERROR_MESSAGE;
    let details: unknown = undefined;
    
    if (!error.response) {
      code = "NETWORK_ERROR";
      message = NETWORK_ERROR_MESSAGE;
    } else {
      code = data?.error_code || `HTTP_${status}`;
      message = data?.message || extractString(data) || message;
      details = data?.details;
    }

    const appError = new AppError(status || 0, code, message, details, data?.request_id, error);

    // Notificación automática al usuario
    const isLoginFailure = isAuthRoute && config?.url?.includes("login");
    const suppress = config?.suppressErrorToast || (status === 401 && !isLoginFailure);
    
    if (!suppress) {
      toast.error(message);
    }

    return Promise.reject(appError);
  }
);

/**
 * Utilidades exportadas.
 */
export const api = client;
export default client;

export function getCookie(name: string) {
  const value = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1]) : null;
}
