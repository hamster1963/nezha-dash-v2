import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Get git commit hash
const getGitHash = () => {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch (e) {
		console.log(e);
		return "unknown";
	}
};

const getVendorChunkName = (moduleId: string) => {
	const normalizedId = moduleId.replace(/\\/g, "/");

	if (!normalizedId.includes("/node_modules/")) {
		return null;
	}

	const packagePath = normalizedId.split("/node_modules/").pop();
	if (!packagePath) {
		return null;
	}

	const packageName = packagePath.split("/")[0];
	return packageName || null;
};

// https://vite.dev/config/
export default defineConfig({
	base: "/",
	define: {
		"import.meta.env.VITE_GIT_HASH": JSON.stringify(getGitHash()),
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		https: {
			key: fs.readFileSync("./.cert/key.pem"),
			cert: fs.readFileSync("./.cert/cert.pem"),
		},
		proxy: {
			"/api/v1/ws/server": {
				target: "ws://localhost:8008",
				changeOrigin: true,
				ws: true,
			},
			"/api/v1/": {
				target: "http://localhost:8008",
				changeOrigin: true,
			},
		},
		headers: {
			"Cache-Control": "no-store",
			Pragma: "no-cache",
		},
	},
	test: {
		environment: "jsdom",
		environmentOptions: {
			jsdom: {
				url: "https://localhost/",
			},
		},
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		css: true,
		include: ["src/test/**/*.{test,spec}.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			reportsDirectory: "./coverage",
			thresholds: {
				statements: 86,
				branches: 74,
				functions: 86,
				lines: 86,
			},
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx}",
				"src/**/*.spec.{ts,tsx}",
				"src/test/**",
				"src/types/**",
				"src/main.tsx",
				"src/i18n.js",
				"src/vite-env.d.ts",
			],
		},
	},
	build: {
		rolldownOptions: {
			output: {
				entryFileNames: `assets/[name].[hash].js`,
				chunkFileNames: `assets/[name].[hash].js`,
				assetFileNames: `assets/[name].[hash].[ext]`,
				codeSplitting: {
					groups: [
						{
							name: getVendorChunkName,
							test: /[\\/]node_modules[\\/]/,
						},
					],
				},
			},
		},
		chunkSizeWarningLimit: 1500,
	},
});
