import { Outlet, Route } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/router/guards";
import { buildDocenteRoutes } from "./DocenteRoutes";
import { buildEstudianteRoutes } from "./EstudianteRoutes";
import { buildGeneralRoutes } from "./GeneralRoutes";
import { buildSecretariaRoutes } from "./SecretariaRoutes";

const shellRoles: string[] = [
	"secretaria",
	"admin",
	"estudiante",
	"bedel",
	"bedel_secretaria",
	"coordinador",
	"tutor",
	"jefes",
	"jefa_aaee",
	"docente",
	"equivalencias",
	"titulos",
	"attp",
	"rectorado",
];

export const buildAppShellRoutes = () => (
	<Route
		element={
			<ProtectedRoute roles={shellRoles}>
				<AppShell>
					<Outlet />
				</AppShell>
			</ProtectedRoute>
		}
	>
		{buildGeneralRoutes()}
		{buildSecretariaRoutes()}
		{buildEstudianteRoutes()}
		{buildDocenteRoutes()}
	</Route>
);
