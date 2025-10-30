// src/api/client.ts
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export const client = axios.create({
  baseURL: BASE,
  withCredentials: true, // IMPORTANT: Set to true to send cookies
});

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
