// src/api/client.ts
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { toast } from "@/utils/toast";

const fallbackBase = (() => {
  if (typeof window === "undefined") {
    return "http://localhost:8000/api";
  }
  const currentOrigin = window.location.origin;
  const isLocalOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(currentOrigin);
  if (isLocalOrigin) {
    return "http://localhost:8000/api";
  }
  return `${currentOrigin.replace(/\/$/, "")}/api`;
})();

const BASE = "/api";
const REFRESH_ENDPOINT = "auth/refresh/";

export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

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

export type AppAxiosRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  suppressErrorToast?: boolean;
};

export const client = axios.create({
  baseURL: BASE,
  withCredentials: true, // IMPORTANT: Set to true to send cookies
});

type RetriableConfig = AppAxiosRequestConfig;

let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const candidateKeys = ["message", "detail", "error"];

const extractString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const first = value.map(extractString).find(Boolean);
    return first ?? null;
  }
  if (isRecord(value)) {
    for (const key of candidateKeys) {
      const result = extractString(value[key]);
      if (result) return result;
    }
    for (const nested of Object.values(value)) {
      const result = extractString(nested);
      if (result) return result;
    }
  }
  return null;
};

const statusToCode = (status?: number): string => {
  if (!status) return "UNKNOWN";
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN";
};

const parseStructuredError = (data: unknown): ErrorResponse | null => {
  if (!isRecord(data)) return null;
  if (typeof data.error_code === "string" && typeof data.message === "string") {
    const structured: ErrorResponse = {
      error_code: data.error_code,
      message: data.message,
      details: data.details,
      request_id: typeof data.request_id === "string" ? data.request_id : undefined,
    };
    return structured;
  }
  return null;
};

const buildAppError = (error: unknown, fallbackStatus?: number): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? fallbackStatus ?? 0;
    const data = error.response?.data;
    const structured = parseStructuredError(data);
    if (structured) {
      return new AppError(
        status || 500,
        structured.error_code,
        structured.message || DEFAULT_ERROR_MESSAGE,
        structured.details,
        structured.request_id,
        error,
      );
    }
    const fallbackMessage =
      extractString(data) || error.message || DEFAULT_ERROR_MESSAGE;
    const details = isRecord(data) ? data : undefined;
    return new AppError(status || 500, statusToCode(status), fallbackMessage, details, undefined, error);
  }

  const genericMessage =
    error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
  return new AppError(fallbackStatus || 500, "UNKNOWN", genericMessage, undefined, undefined, error);
};

const notifyError = (appError: AppError, config?: AppAxiosRequestConfig) => {
  if (config?.suppressErrorToast) {
    return;
  }
  // No mostrar "No autenticado" si ya estamos en la página de login
  if (appError.status === 401 && window.location.pathname === "/login") {
    return;
  }
  toast.error(appError.message);
};

const enqueueRefresh = () => {
  if (!refreshPromise) {
    const refreshConfig: AppAxiosRequestConfig = { suppressErrorToast: true };
    refreshPromise = client.post(REFRESH_ENDPOINT, undefined, refreshConfig)
      .then(() => {
        refreshPromise = null;
      })
      .catch((err) => {
        refreshPromise = null;
        throw err;
      });
  }
  return refreshPromise;
};

export const requestSessionRefresh = () => enqueueRefresh();

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

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error;
    const originalRequest = config as RetriableConfig;

    if (!response) {
      const networkError = new AppError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE, undefined, undefined, error);
      notifyError(networkError, originalRequest);
      return Promise.reject(networkError);
    }

    if (response.status !== 401) {
      const appError = buildAppError(error, response.status);
      notifyError(appError, originalRequest);
      return Promise.reject(appError);
    }

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");
    if (isAuthRoute || originalRequest?._retry) {
      unauthorizedHandler?.();
      const appError = buildAppError(error, response.status);
      notifyError(appError, originalRequest);
      return Promise.reject(appError);
    }

    originalRequest._retry = true;
    try {
      await enqueueRefresh();
      return client(originalRequest);
    } catch (refreshError) {
      unauthorizedHandler?.();
      const appError = buildAppError(refreshError, (refreshError as AxiosError).response?.status);
      notifyError(appError, originalRequest);
      return Promise.reject(appError);
    }
  },
);

export const apiPath = (path: string) => path;

export const api = client;

export default client;

export function getCookie(name: string) {
  const value = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.split("=")[1]) : null;
}
