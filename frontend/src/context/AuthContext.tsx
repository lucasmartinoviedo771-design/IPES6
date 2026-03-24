/**
 * @module Context/Auth
 * @description Proveedor central de Autenticación y Autorización (RBAC).
 * Gestiona el ciclo de vida de la sesión, persistencia de perfil de usuario,
 * sistema de "Keep-Alive" por actividad y el mecanismo de simulación de roles (Impersonation).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client, setUnauthorizedHandler } from "@/api/client";
import { setGlobalRoleOverride } from "@/utils/roles";

/**
 * Perfil de usuario normalizado del sistema SIGED.
 */
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
  profesorado_ids?: number[] | null;
} | null;

interface AuthContextType {
  /** Usuario actualmente autenticado */
  user: User;
  /** Indica si la sesión inicial está siendo validada */
  loading: boolean;
  /** Inicia sesión mediante DNI/Legajo y contraseña */
  login: (loginId: string, password: string) => Promise<User>;
  /** Cierra la sesión en cliente y servidor */
  logout: () => Promise<void>;
  /** Sincroniza el estado local con la base de datos del servidor */
  refreshProfile: () => Promise<User | null>;
  /** Rol temporal seleccionado (para pruebas de admin) */
  roleOverride: string | null;
  /** Cambia el rol activo para la sesión actual */
  setRoleOverride: (role: string | null) => void;
  /** Lista de roles a los que el usuario tiene acceso legítimo o por privilegios admin */
  availableRoleOptions: Array<{ value: string; label: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Configuraciones de mantenimiento de sesión */
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000; // Intento de refresco cada 2 min
const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;    // Solo si hubo actividad en los últimos 5 min

/**
 * Normaliza la entrada de roles que puede venir como String, Array o JSON String
 * desde diferentes legados del backend.
 */
const normalizeRolesInput = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.map((r) => String(r ?? "").trim()).filter((r) => r.length > 0);
  }
  if (typeof input === "string") {
    const value = input.trim();
    if (!value) return [];
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((r) => String(r ?? "").trim()).filter((r) => r.length > 0);
      } catch { /* fallback */ }
    }
    return value.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
  }
  return [];
};

/**
 * Mapea la respuesta cruda del API a un objeto User tipado y normalizado.
 */
const normalizeUserPayload = (raw: unknown): User => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    roles: normalizeRolesInput(r.roles),
  } as User;
};

/**
 * Proveedor de Contexto de Autenticación.
 * Debe envolver toda la aplicación (en App.tsx) para habilitar hooks de seguridad.
 */
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [roleOverride, setRoleOverrideState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("roleOverride") || null;
    } catch { return null; }
  });
  
  const activityRef = useRef<number>(Date.now());
  const navigate = useNavigate();

  /**
   * Acción de emergencia ante dectete de sesión expirada (401 en client.ts).
   */
  const redirectToLogin = useCallback(() => {
    setUser(null);
    if (window.location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  /**
   * Obtiene el perfil del usuario actual.
   * Usado para validación inicial (Bootstrap) y actualizaciones de perfil.
   */
  const refreshProfile = async (): Promise<User | null> => {
    try {
      const { data } = await client.get(`auth/profile/?_t=${Date.now()}`, {
        suppressErrorToast: true,
      } as any);
      const normalized = normalizeUserPayload(data);
      setUser(normalized);
      return normalized;
    } catch (err: any) {
      setUser(null);
      throw err;
    }
  };

  /**
   * BOOTSTRAP: Intenta recuperar sesión existente al cargar/refrescar la app.
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!bootstrapped) {
          await Promise.race([
            refreshProfile(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
          ]);
        }
      } catch (e) {
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

  /** 
   * MONITOREO DE ACTIVIDAD: Detecta interacción humana para el sistema Keep-Alive.
   */
  useEffect(() => {
    const updateActivity = () => { activityRef.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, updateActivity));
    return () => events.forEach((evt) => window.removeEventListener(evt, updateActivity));
  }, []);

  /**
   * Vincula el interceptor de Axios con la lógica de UI de AuthContext.
   */
  useEffect(() => {
    setUnauthorizedHandler(redirectToLogin);
    return () => setUnauthorizedHandler(null);
  }, [redirectToLogin]);

  /** 
   * REGRESO DE SESIÓN (Keep-Alive): 
   * Refresca silenciosamente las cookies de sesión si el usuario está activo.
   */
  useEffect(() => {
    if (!user) return;
    const intervalId = window.setInterval(async () => {
      if (Date.now() - activityRef.current > ACTIVITY_WINDOW_MS) return;
      try {
        await client.post("auth/refresh/", undefined, { suppressErrorToast: true } as any);
      } catch (err) {
        redirectToLogin();
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [user, redirectToLogin]);

  const login = async (loginId: string, password: string) => {
    const id = String(loginId).trim();
    const payload = { login: id, username: id, dni: id, email: id, password: String(password).trim() };

    try {
      const { data } = await client.post("auth/login/", payload);
      const u: User = normalizeUserPayload(data?.user);
      if (!u) throw new Error("La respuesta del servidor no contiene datos de usuario.");
      setUser(u);
      return u;
    } catch (err: any) {
      if (err.message && (err.status || err.code)) throw err;
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 
                  (status === 400 ? "Datos inválidos." : status === 401 ? "Credenciales incorrectas." : "No se pudo iniciar sesión.");
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await client.post("auth/logout/");
    } catch (err: any) {
      console.error("Error during logout:", err);
    } finally {
      setUser(null);
      setRoleOverride(null);
    }
  };

  /**
   * Calcula el menú de roles disponibles.
   * Los administradores ven todos los roles del sistema para propósitos de Testing/Soporte.
   */
  const availableRoleOptions = useMemo(() => {
    if (!user) return [];
    const ROLE_LABELS: Record<string, string> = {
      admin: "Administrador", secretaria: "Secretaría", bedel: "Bedelía", 
      docente: "Docentes", tutor: "Tutorías", coordinador: "Coordinación",
      jefes: "Jefatura", jefa_aaee: "Jefa A.A.E.E.", consulta: "Consulta",
      estudiante: "Estudiante", equivalencias: "Equipo de equivalencias",
      titulos: "Títulos", curso_intro: "Curso Introductorio",
    };
    
    const normalized = new Set<string>();
    (user.roles ?? []).forEach((r) => {
      const role = (r || "").toLowerCase().trim();
      if (!role) return;
      if (role === "estudiantes") normalized.add("estudiante");
      else if (role.startsWith("bedel")) normalized.add("bedel");
      else if (role.startsWith("secretaria")) normalized.add("secretaria");
      else if (role.startsWith("coordinador")) normalized.add("coordinador");
      else normalized.add(role);
    });

    if (normalized.has("admin")) {
      Object.keys(ROLE_LABELS).forEach((role) => normalized.add(role));
    }
    return Array.from(normalized).sort().map((role) => ({ value: role, label: ROLE_LABELS[role] ?? role }));
  }, [user]);

  /**
   * Aplica un override temporal de rol (Impersonation).
   * Solo afecta al filtrado de permisos en el lado del cliente.
   */
  const setRoleOverride = (role: string | null) => {
    const normalized = role ? role.toLowerCase().trim() : null;
    setRoleOverrideState(normalized);
    try {
      if (normalized) sessionStorage.setItem("roleOverride", normalized);
      else sessionStorage.removeItem("roleOverride");
    } catch { /* ignore */ }
  };

  /** Sincroniza el override con utilidades globales de permisos */
  useEffect(() => {
    if (!user) {
      setGlobalRoleOverride(null);
      setRoleOverrideState(null);
      return;
    }
    if (!roleOverride) {
      setGlobalRoleOverride(null);
      return;
    }
    const valid = availableRoleOptions.some((opt) => opt.value === roleOverride);
    if (!valid) {
      setGlobalRoleOverride(null);
      setRoleOverrideState(null);
      return;
    }
    setGlobalRoleOverride(roleOverride);
  }, [user, roleOverride, availableRoleOptions]);

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshProfile,
      roleOverride, setRoleOverride, availableRoleOptions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook personalizado para acceder de forma segura a los datos del usuario.
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
