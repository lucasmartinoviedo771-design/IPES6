import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { client, apiPath, setUnauthorizedHandler, storeTokens } from "@/api/client";

export type User = {
  id?: number;
  dni: string;
  name?: string;
  roles?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
  must_complete_profile?: boolean;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;
const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const activityRef = useRef<number>(Date.now());

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
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const updateActivity = () => {
      activityRef.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, updateActivity));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      storeTokens(null, null);
      setUser(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    };
    setUnauthorizedHandler(handler);
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    const intervalId = window.setInterval(async () => {
      if (Date.now() - activityRef.current > ACTIVITY_WINDOW_MS) {
        return;
      }
      let refreshToken: string | null = null;
      try {
        refreshToken = localStorage.getItem("refresh_token");
      } catch {
        refreshToken = null;
      }
      if (!refreshToken) {
        return;
      }
      try {
        const { data } = await client.post(apiPath("auth/refresh"), { refresh: refreshToken });
        if (data?.access || data?.refresh) {
          storeTokens(data?.access ?? null, data?.refresh ?? null);
        }
      } catch (err) {
        console.warn("[Auth] keep-alive refresh failed", err);
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [user]);

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
      if (data?.access || data?.refresh) {
        storeTokens(data?.access ?? null, data?.refresh ?? null);
      }

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
      storeTokens(null, null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};


// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
