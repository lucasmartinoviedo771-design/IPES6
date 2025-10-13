// src/api/client.ts
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

export const client = axios.create({
  baseURL: BASE,
  withCredentials: false, // Asegúrate de que esto es lo que quieres
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
};

export const clearAuthToken = () => setAuthToken(null);

export const apiPath = (path: string) => path;

// Alias para compatibilidad con imports existentes
export const api = client;

export default client;
