import React, { createContext, useContext, useEffect, useState } from "react";
import { client, apiPath, setAuthToken, clearAuthToken } from "@/api/client";

export type User = {
  dni: string;
  name?: string;
  roles?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: si hay token en localStorage, configuro el header y traigo /auth/profile
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }
        setAuthToken(token); // pone Authorization: Bearer <token> en el cliente
        const { data } = await client.get(apiPath("auth/profile"));
        setUser(data);
      } catch (err: any) {
        // Token inválido/expirado o endpoint aún no disponible -> limpio
        clearAuthToken();
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginId: string, password: string) => {
    const id = String(loginId).trim();
    const payload = {
      // Mandamos todas las variantes para ser compatibles con el backend
      login: id,
      username: id,
      dni: id,
      email: id,
      password: String(password).trim(),
    };

    try {
      const { data } = await client.post(apiPath("auth/login"), payload);
      // Esperamos { access, user }
      const access: string | undefined = data?.access;
      const u: User = data?.user ?? null;

      if (!access) {
        throw new Error("Respuesta inválida del servidor: falta el token.");
      }

      // Persisto token y configuro header
      localStorage.setItem("token", access);
      setAuthToken(access);

      // Si no vino el user, lo traigo de /auth/profile
      if (!u) {
        const me = await client.get(apiPath("auth/profile"));
        setUser(me.data);
        return me.data;
      }

      setUser(u);
      return u;
    } catch (err: any) {
      // Mensaje de error amigable
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (status === 400 ? "Datos inválidos." :
         status === 401 ? "Credenciales incorrectas." :
         "No se pudo iniciar sesión.");
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      // Si tenés endpoint de logout en el backend, buenísimo (opcional):
      await client.post(apiPath("auth/logout")).catch(() => {});
    } finally {
      clearAuthToken();
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};