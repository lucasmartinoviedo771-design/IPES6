// src/api/client.ts
import axios, { AxiosRequestConfig } from "axios";

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

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export const client = axios.create({
  baseURL: BASE,
  withCredentials: true, // IMPORTANT: Set to true to send cookies
});

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function storeTokens(access?: string | null, refresh?: string | null) {
  try {
    if (access) {
      localStorage.setItem("token", access);
    } else {
      localStorage.removeItem("token");
    }
  } catch {
    /* ignored */
  }
  try {
    if (refresh) {
      localStorage.setItem("refresh_token", refresh);
    } else {
      localStorage.removeItem("refresh_token");
    }
  } catch {
    /* ignored */
  }
}

function getStoredRefreshToken() {
  try {
    return localStorage.getItem("refresh_token");
  } catch {
    return null;
  }
}

function getStoredAccessToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

client.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
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
  async (error) => {
    const { response, config } = error;
    const originalRequest = config as RetriableConfig;
    if (!response) {
      return Promise.reject(error);
    }
    if (response.status !== 401) {
      return Promise.reject(error);
    }

    const isAuthRoute = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");
    if (isAuthRoute) {
      storeTokens(null, null);
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    if (originalRequest?._retry) {
      storeTokens(null, null);
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      storeTokens(null, null);
      unauthorizedHandler?.();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const refreshResponse = await client.post(apiPath("auth/refresh"), { refresh: refreshToken });
      const { access, refresh } = refreshResponse.data ?? {};
      storeTokens(access ?? null, refresh ?? null);
      if (access) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${access}`;
      }
      return client(originalRequest);
    } catch (refreshError) {
      storeTokens(null, null);
      unauthorizedHandler?.();
      return Promise.reject(refreshError);
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
