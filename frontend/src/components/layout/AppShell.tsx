import { PropsWithChildren, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import { useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "react-error-boundary";
import { useQuery } from "@tanstack/react-query";
import { obtenerResumenMensajes } from "@/api/mensajes";
import { getDefaultHomeRoute, isOnlyEstudiante } from "@/utils/roles";
import ErrorBoundaryFallback from "@/components/ErrorBoundaryFallback";
import BackButton from "@/components/ui/BackButton";

import { roleLabels, roleHomeMap } from "./app-shell/constants";
import { useNavPermissions } from "./app-shell/useNavPermissions";
import { AppTopBar } from "./app-shell/AppTopBar";
import { AppSidebar } from "./app-shell/AppSidebar";
import { UserGuideDialog } from "./app-shell/UserGuideDialog";

export default function AppShell({ children }: PropsWithChildren) {
  const { user, logout, roleOverride, setRoleOverride, availableRoleOptions } = useAuth();
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("sidebarOpen");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => loc.pathname, [loc.pathname]);
  const [hasPageBack, setHasPageBack] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const detect = () => {
      const pageBack = mainRef.current?.querySelector("[data-back-button='page']");
      setHasPageBack(!!pageBack);
    };
    detect();
    const observer = new MutationObserver(() => detect());
    if (mainRef.current) {
      observer.observe(mainRef.current, { childList: true, subtree: true });
    }
    return () => observer.disconnect();
  }, [current]);

  const studentOnly = isOnlyEstudiante(user);

  const navPerms = useNavPermissions(user, roleOverride);
  const { canUseMessages } = navPerms;

  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(
      (user?.roles ?? [])
        .map((r: string) => r.toLowerCase().trim())
        .filter((r: string) => r.length > 0)
    ));

    const existingValues = new Set(roles);
    availableRoleOptions.forEach((opt: { value: string }) => {
      if (!existingValues.has(opt.value.toLowerCase())) {
        roles.push(opt.value.toLowerCase());
      }
    });

    return (roles as string[]).map((r) => ({
      value: r,
      label: roleLabels[r] || r.toUpperCase()
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [user, availableRoleOptions]);

  const showRoleSwitcher = roleOptions.length > 1;

  const previousRoleRef = useRef<string | null>(roleOverride);
  useEffect(() => {
    if (!user) return;
    if (previousRoleRef.current === roleOverride) return;
    previousRoleRef.current = roleOverride;
    if (roleOverride) {
      const destination = roleHomeMap[roleOverride] ?? "/dashboard";
      navigate(destination, { replace: true });
    } else {
      navigate(getDefaultHomeRoute(user), { replace: true });
    }
  }, [roleOverride, user, navigate]);

  useEffect(() => {
    if (!user) return;
    if (roleOverride) return;
    if (availableRoleOptions.length > 1) {
      setRoleOverride(availableRoleOptions[0].value);
    }
  }, [user, roleOverride, availableRoleOptions, setRoleOverride]);

  const { data: messageSummary } = useQuery({
    queryKey: ["mensajes", "resumen"],
    queryFn: obtenerResumenMensajes,
    enabled: canUseMessages,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const unreadMessages = messageSummary?.unread ?? 0;
  const badgeColor =
    unreadMessages === 0
      ? "default"
      : messageSummary?.sla_danger
        ? "error"
        : messageSummary?.sla_warning
          ? "warning"
          : "primary";

  useEffect(() => {
    try {
      localStorage.setItem("sidebarOpen", open ? "1" : "0");
    } catch (error) {
      console.warn("No se pudo persistir la preferencia del menú lateral", error);
    }
  }, [open]);

  return (
    <Box sx={{ display: "flex", backgroundColor: "#f1f3f9", minHeight: "100vh" }}>
      <CssBaseline />

      <AppTopBar
        open={open}
        user={user}
        roleOverride={roleOverride}
        roleOptions={roleOptions}
        showRoleSwitcher={showRoleSwitcher}
        canUseMessages={canUseMessages}
        unreadMessages={unreadMessages}
        badgeColor={badgeColor as "default" | "error" | "warning" | "primary"}
        onToggleSidebar={() => setOpen((v) => !v)}
        onGuideOpen={() => setGuideOpen(true)}
        onRoleChange={setRoleOverride}
        onLogout={logout}
      />

      <UserGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

      <AppSidebar
        open={open}
        current={current}
        user={user}
        canUseMessages={canUseMessages}
        unreadMessages={unreadMessages}
        badgeColor={badgeColor as "default" | "error" | "warning" | "primary"}
        studentOnly={studentOnly}
        dashboardVisible={navPerms.dashboardVisible}
        canPreins={navPerms.canPreins}
        canSeeCarreras={navPerms.canSeeCarreras}
        canSeeReportes={navPerms.canSeeReportes}
        canSecretaria={navPerms.canSecretaria}
        canBedeles={navPerms.canBedeles}
        canDocentesPanel={navPerms.canDocentesPanel}
        canTutoriasPanel={navPerms.canTutoriasPanel}
        canEquivalenciasPanel={navPerms.canEquivalenciasPanel}
        canTitulosPanel={navPerms.canTitulosPanel}
        canCoordinacionPanel={navPerms.canCoordinacionPanel}
        canJefaturaPanel={navPerms.canJefaturaPanel}
        canAsistenciaReportes={navPerms.canAsistenciaReportes}
        canCursoIntro={navPerms.canCursoIntro}
        canEstudiantePortal={navPerms.canEstudiantePortal}
        canEstudiantePanel={navPerms.canEstudiantePanel}
        canPrimeraCarga={navPerms.canPrimeraCarga}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
      />

      <Box
        component="main"
        ref={mainRef}
        className="app-main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          backgroundColor: "#f1f3f9",
          transition: "margin 0.3s ease",
          pt: 1,
          px: { xs: 2, md: 4 },
          pb: 1,
        }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        <ErrorBoundary FallbackComponent={ErrorBoundaryFallback} resetKeys={[current]}>
          <Box
            sx={{
              minHeight: "70vh",
              borderRadius: 4,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 60px rgba(15,23,42,0.08)",
              p: { xs: 2, md: 4 },
            }}
          >
            <Stack key={current} spacing={{ xs: 2, md: 3 }}>
              {!hasPageBack && (
                <BackButton
                  scope="global"
                  fallbackPath={user ? getDefaultHomeRoute(user) : "/"}
                  sx={{ mb: 0 }}
                />
              )}
              {children}
            </Stack>
          </Box>
        </ErrorBoundary>
      </Box>
    </Box>
  );
}
