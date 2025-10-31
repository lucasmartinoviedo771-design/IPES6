import React, { createContext, useContext, useEffect, useState } from "react";
import { client, apiPath } from "@/api/client"; // Removed setAuthToken, clearAuthToken

export type User = {
  id?: number;
  dni: string;
  name?: string;
  roles?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async (): Promise<User | null> => {
    try {
      const { data } = await client.get(apiPath("auth/profile"));
      setUser(data);
      return data;
    } catch (err: any) {
      // If profile fetch fails, it means the cookie is invalid or missing
      setUser(null);
      // No need to clear local storage or set auth header manually
      throw err;
    }
  };

  // Bootstrap: Check for existing session via cookie
  useEffect(() => {
    (async () => {
      try {
        await refreshProfile(); // Attempt to load profile, relies on browser sending cookie
      } catch (err: any) {
        // No valid session cookie found or profile request failed
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginId: string, password: string) => {
    const id = String(loginId).trim();
    const payload = {
      login: id,
      username: id,
      dni: id,
      email: id,
      password: String(password).trim(),
    };

    try {
      const { data } = await client.post(apiPath("auth/login"), payload);
      const u: User = data?.user ?? null;

      if (!u) {
        return await refreshProfile();
      }

      setUser(u);
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn("[Auth] refresh after login failed", refreshError);
      }
      return u;
    } catch (err: any) {
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
      await client.post(apiPath("auth/logout")); // Call backend logout endpoint to clear cookie
    } catch (err: any) {
      console.error("Error during logout:", err); // Log error but still clear local state
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
