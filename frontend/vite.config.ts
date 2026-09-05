import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		host: true,
		hmr: { host: "localhost" },
		proxy: {
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				secure: false,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	optimizeDeps: {
		include: ["@emotion/react", "@emotion/styled", "react-google-recaptcha-v3"],
	},
	build: {
		minify: true,
		// Sin sourcemaps: se publicaban junto al bundle y quedaban descargables
		// (https://<dominio>/assets/*.js.map devolvia 200), con lo cual el codigo
		// fuente completo era publico. No hay servicio de error tracking que los
		// consuma, asi que no se pierde nada. Si alguna vez se suma uno, la opcion
		// es "hidden": genera el mapa pero no lo referencia desde el bundle.
		sourcemap: false,
		chunkSizeWarningLimit: 2100,
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setupTests.ts",
	},
});
