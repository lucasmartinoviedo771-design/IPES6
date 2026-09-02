import { type ComponentType, lazy, Suspense } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { INSTITUTIONAL_TERRACOTTA } from "@/styles/institutionalColors";

const SuspenseFallback = (
	<Box
		sx={{
			width: "100%",
			py: 6,
			px: 2,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			gap: 1.5,
		}}
	>
		<Box sx={{ width: "100%", maxWidth: 360 }}>
			<LinearProgress
				sx={{
					height: 4,
					borderRadius: 2,
					backgroundColor: "rgba(156, 78, 53, 0.15)",
					"& .MuiLinearProgress-bar": {
						backgroundColor: INSTITUTIONAL_TERRACOTTA,
					},
				}}
			/>
		</Box>
		<Typography
			variant="caption"
			sx={{
				color: "text.secondary",
				fontWeight: 500,
				letterSpacing: 0.3,
			}}
		>
			Cargando módulo...
		</Typography>
	</Box>
);

export const lazyPage = <P extends object>(
	importer: () => Promise<unknown>,
) => {
	const Component = lazy(async () => {
		try {
			const module = (await importer()) as Record<string, unknown>;

			// Buscador agresivo de componente (Double Default fix para Rolldown/Vite 8)
			const comp1 = module.default || module;
			const comp2 =
				comp1 && typeof comp1 === "object" && "default" in comp1
					? (comp1 as Record<string, unknown>).default
					: comp1;
			const comp3 =
				comp2 && typeof comp2 === "object" && "default" in comp2
					? (comp2 as Record<string, unknown>).default
					: comp2;

			return { default: comp3 as ComponentType<P> };
		} catch (err: any) {
			const message = String(err?.message || "").toLowerCase();
			const isChunkError =
				message.includes("failed to fetch dynamically imported module") ||
				message.includes("loading chunk") ||
				message.includes("error loading dynamic module");

			if (isChunkError && typeof window !== "undefined") {
				const lastReload = sessionStorage.getItem("last_chunk_lazy_reload");
				const now = Date.now();
				if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
					sessionStorage.setItem("last_chunk_lazy_reload", String(now));
					window.location.reload();
				}
			}
			throw err;
		}
	});

	const LazyPageWrapper = (props: P) => {
		const ComponentCast = Component as unknown as ComponentType<P>;
		return (
			<Suspense fallback={SuspenseFallback}>
				<ComponentCast {...props} />
			</Suspense>
		);
	};
	LazyPageWrapper.displayName = "LazyPageWrapper";

	return LazyPageWrapper;
};
