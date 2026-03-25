import { Outlet, Route } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/router/guards";
import { lazyPage } from "@/utils/lazy";

const PrimeraCargaPage = lazyPage(() => import("@/pages/admin/PrimeraCargaPage"));
const ActaExamenPrimeraCargaPage = lazyPage(() => import("@/pages/admin/ActaExamenPrimeraCargaPage"));
const HistorialActasPage = lazyPage(() => import("@/pages/admin/HistorialActasPage"));
const HistorialMesasPandemiaPage = lazyPage(() => import("@/pages/admin/HistorialMesasPandemiaPage"));
const HistorialRegularidadesPage = lazyPage(() => import("@/pages/admin/HistorialRegularidadesPage"));
const HistoricoRegularidadPage = lazyPage(() => import("@/pages/admin/HistoricoRegularidadPage"));
const HistorialEquivalenciasPage = lazyPage(() => import("@/pages/admin/HistorialEquivalenciasPage"));
const SystemLogsPage = lazyPage(() => import("@/pages/SystemLogsPage"));
const AuditoriaInconsistenciasPage = lazyPage(() => import("@/pages/Bedeles/AuditoriaInconsistenciasPage"));

const ActaPrintPage = lazyPage(() => import("@/pages/admin/ActaPrintPage"));

const adminRoles: string[] = ["admin", "secretaria", "bedel", "titulos", "jefatura", "coordinador"];

export const buildAdminRoutes = () => (
  <>
    <Route
      element={(
        <ProtectedRoute roles={adminRoles}>
          <AppShell>
            <Outlet />
          </AppShell>
        </ProtectedRoute>
      )}
    >
      <Route path="/admin/primera-carga" element={<PrimeraCargaPage />} />
      <Route path="/admin/primera-carga/actas-examen" element={<ActaExamenPrimeraCargaPage />} />
      <Route path="/admin/primera-carga/historial-actas" element={<HistorialActasPage />} />
      <Route path="/admin/primera-carga/historico-regularidad" element={<HistoricoRegularidadPage />} />
      <Route path="/admin/primera-carga/historial-mesas-pandemia" element={<HistorialMesasPandemiaPage />} />
      <Route path="/admin/primera-carga/historial-regularidades" element={<HistorialRegularidadesPage />} />
      <Route path="/admin/primera-carga/historial-equivalencias" element={<HistorialEquivalenciasPage />} />
      <Route path="/admin/auditoria-inconsistencias" element={<AuditoriaInconsistenciasPage />} />
    </Route>

    <Route
      path="/admin/actas/:actaId/print"
      element={(
        <ProtectedRoute roles={adminRoles}>
          <ActaPrintPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/system/logs"
      element={(
        <ProtectedRoute roles={["admin"]}>
          <AppShell>
            <SystemLogsPage />
          </AppShell>
        </ProtectedRoute>
      )}
    />
  </>
);
