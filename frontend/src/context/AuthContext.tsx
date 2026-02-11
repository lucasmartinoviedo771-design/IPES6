import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client, apiPath, setUnauthorizedHandler, requestSessionRefresh } from "@/api/client";
import { setGlobalRoleOverride } from "@/utils/roles";

export type User = {
  id?: number;
  dni: string;
  name?: string;
  roles?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
  must_complete_profile?: boolean;
  email?: string;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  roleOverride: string | null;
  setRoleOverride: (role: string | null) => void;
  availableRoleOptions: Array<{ value: string; label: string }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;
const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false); // evita doble fetch inicial
  const [roleOverride, setRoleOverrideState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("roleOverride") || null;
    } catch {
      return null;
    }
  });
  const activityRef = useRef<number>(Date.now());
  const navigate = useNavigate();

  const redirectToLogin = useCallback(() => {
    setUser(null);
    if (window.location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const refreshProfile = async (): Promise<User | null> => {
    try {
      // Agregamos timestamp para evitar caché 301 persistente en navegadores
      const { data } = await client.get(apiPath(`auth/profile/?_t=${Date.now()}`), {
        suppressErrorToast: true,
      } as any);
      setUser(data);
      return data;
    } catch (err: any) {
      setUser(null);
      throw err;
    }
  };

  // Bootstrap: Check for existing session via cookie (solo una vez)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!bootstrapped) {
          // Race refreshProfile with a timeout
          await Promise.race([
            refreshProfile(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
          ]);
        }
      } catch (e) {
        // alert("Error de carga inicial: " + String(e)); // Uncomment for extreme debugging
        setUser(null);
      } finally {
        if (mounted) {
          setBootstrapped(true);
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [bootstrapped]);

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
    setUnauthorizedHandler(redirectToLogin);
    return () => setUnauthorizedHandler(null);
  }, [redirectToLogin]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const intervalId = window.setInterval(async () => {
      if (Date.now() - activityRef.current > ACTIVITY_WINDOW_MS) {
        return;
      }
      try {
        await requestSessionRefresh();
      } catch (err) {
        redirectToLogin();
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, redirectToLogin]);

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
      const { data } = await client.post(apiPath("auth/login/"), payload);
      const u: User = data?.user ?? null;

      if (!u) {
        throw new Error("La respuesta del servidor no contiene datos de usuario.");
      }

      setUser(u);
      return u;
    } catch (err: any) {
      // Si el error ya es un AppError (procesado por el interceptor de client.ts)
      if (err.message && (err.status || err.code)) {
        throw err;
      }

      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        (status === 400 ? "Datos inválidos." :
          status === 401 ? "Credenciales incorrectas." :
            "No se pudo iniciar sesión.");
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await client.post(apiPath("auth/logout/")); // Call backend logout endpoint to clear cookie
    } catch (err: any) {
      console.error("Error during logout:", err); // Log error but still clear local state
    } finally {
      setUser(null);
      setRoleOverride(null);
    }
  };

  const computeAvailableRoles = (currentUser: User | null): Array<{ value: string; label: string }> => {
    if (!currentUser) return [];
    const ROLE_LABELS: Record<string, string> = {
      admin: "Administrador",
      secretaria: "Secretaría",
      bedel: "Bedelía",
      docente: "Docentes",
      tutor: "Tutorías",
      coordinador: "Coordinación",
      jefes: "Jefatura",
      jefa_aaee: "Jefa A.A.E.E.",
      consulta: "Consulta",
      estudiante: "Estudiante",
      equivalencias: "Equipo de equivalencias",
      titulos: "Títulos",
      curso_intro: "Curso Introductorio",
    };
    const normalized = new Set<string>();
    (currentUser.roles ?? []).forEach((r) => {
      const role = (r || "").toLowerCase().trim();
      if (!role) return;

      if (role === "estudiantes" || role === "estudiante") {
        normalized.add("estudiante");
      } else if (role.startsWith("bedel")) {
        normalized.add("bedel");
      } else if (role.startsWith("secretaria")) {
        normalized.add("secretaria");
      } else if (role.startsWith("coordinador")) {
        normalized.add("coordinador");
      } else {
        normalized.add(role);
      }
    });

    const admin = normalized.has("admin");
    if (admin) {
      [
        "admin",
        "secretaria",
        "bedel",
        "docente",
        "tutor",
        "coordinador",
        "jefes",
        "jefa_aaee",
        "consulta",
        "estudiante",
        "equivalencias",
        "titulos",
        "curso_intro",
      ].forEach((role) => normalized.add(role));
    }
    return Array.from(normalized)
      .sort()
      .map((role) => ({ value: role, label: ROLE_LABELS[role] ?? role }));
  };

  const availableRoleOptions = useMemo(() => computeAvailableRoles(user), [user]);

  const setRoleOverride = (role: string | null) => {
    const normalized = role ? role.toLowerCase().trim() : null;
    setRoleOverrideState(normalized);
    try {
      if (normalized) {
        localStorage.setItem("roleOverride", normalized);
      } else {
        localStorage.removeItem("roleOverride");
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) {
      setGlobalRoleOverride(null);
      setRoleOverrideState(null);
      try {
        localStorage.removeItem("roleOverride");
      } catch {
        /* ignore */
      }
      return;
    }
    if (!roleOverride) {
      setGlobalRoleOverride(null);
      return;
    }
    const validRole = availableRoleOptions.some((option) => option.value === roleOverride);
    if (!validRole) {
      setGlobalRoleOverride(null);
      setRoleOverrideState(null);
      try {
        localStorage.removeItem("roleOverride");
      } catch {
        /* ignore */
      }
      return;
    }
    setGlobalRoleOverride(roleOverride);
  }, [user, roleOverride, availableRoleOptions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshProfile,
        roleOverride,
        setRoleOverride,
        availableRoleOptions,
      }}
    >
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
