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
		sourcemap: true,
		chunkSizeWarningLimit: 2100,
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setupTests.ts",
	},
});
