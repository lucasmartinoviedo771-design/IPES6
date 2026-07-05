import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getDefaultHomeRoute } from "@/utils/roles";

export default function AuthCallbackPage() {
		const { user, loading, refreshProfile } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		(async () => {
			// Manually trigger a profile refresh to get the user data from the new session
			try {
				const freshUser = await refreshProfile();
				if (freshUser) {
					const uniqueRoles = new Set<string>();

					const rawRoles = freshUser?.roles ?? [];
					rawRoles.forEach((r) => {
						const norm = r.toLowerCase().trim();
						if (norm === "estudiantes") uniqueRoles.add("estudiante");
						else if (norm === "docentes") uniqueRoles.add("docente");
						else if (norm === "bedel_secretaria")
							uniqueRoles.add("bedel_secretaria");
						else if (norm.startsWith("bedel")) uniqueRoles.add("bedel");
						else if (norm.startsWith("secretaria"))
							uniqueRoles.add("secretaria");
						else uniqueRoles.add(norm);
					});

					const assignments = freshUser?.role_assignments ?? [];
					assignments.forEach((asg) => {
						const norm = asg.role.toLowerCase().trim();
						if (norm === "estudiantes") uniqueRoles.add("estudiante");
						else if (norm === "docentes") uniqueRoles.add("docente");
						else if (norm === "bedel_secretaria")
							uniqueRoles.add("bedel_secretaria");
						else if (norm.startsWith("bedel")) uniqueRoles.add("bedel");
						else if (norm.startsWith("secretaria"))
							uniqueRoles.add("secretaria");
						else uniqueRoles.add(norm);
					});

					if (freshUser?.is_superuser) {
						uniqueRoles.add("admin");
					}

					const hasMultipleOptions =
						uniqueRoles.size > 1 ||
						(freshUser?.role_assignments &&
							freshUser.role_assignments.length > 1);

					if (hasMultipleOptions) {
						navigate("/seleccionar-rol", { replace: true });
					} else {
						const onlyRole = Array.from(uniqueRoles)[0] || "";
						if (onlyRole) {
							const assignment = freshUser?.role_assignments?.[0];
							if (assignment && assignment.profesorado_id) {
								localStorage.setItem(
									"ipes_active_role",
									`${onlyRole}:${assignment.profesorado_id}`,
								);
							} else {
								localStorage.setItem("ipes_active_role", onlyRole);
							}
						}
						const target = getDefaultHomeRoute(freshUser);
						navigate(target, { replace: true });
					}
				} else {
					navigate("/login", { replace: true });
				}
			} catch {
				navigate("/login", { replace: true });
			}
		})();
	}, [navigate, refreshProfile]);

	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
			}}
		>
			<CircularProgress />
			<Typography sx={{ mt: 2 }}>Autenticando...</Typography>
		</Box>
	);
}
