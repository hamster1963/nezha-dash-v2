import { execSync } from "node:child_process";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Node ≥25 默认启用实验性 webstorage：其全局 localStorage 在无有效存储文件时
// 会遮蔽 jsdom 注入的同名全局（localStorage.clear 变为非函数）。测试 worker
// 进程统一禁用，保证 jsdom 的 storage 生效。
process.env.NODE_OPTIONS = [
	process.env.NODE_OPTIONS,
	"--no-experimental-webstorage",
]
	.filter(Boolean)
	.join(" ");

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

const env = loadEnv("development", process.cwd(), "");
const configuredApiTarget =
	env.NEZHA_API_PROXY_TARGET || "http://localhost:8008";
const apiTargetUrl = new URL(configuredApiTarget);
if (!["http:", "https:"].includes(apiTargetUrl.protocol)) {
	throw new Error("NEZHA_API_PROXY_TARGET must use http or https");
}
const webSocketTargetUrl = new URL(apiTargetUrl);
webSocketTargetUrl.protocol =
	apiTargetUrl.protocol === "https:" ? "wss:" : "ws:";

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
		proxy: {
			"/dashboard": {
				target: apiTargetUrl.origin,
				changeOrigin: true,
				cookieDomainRewrite: "",
			},
			"/api/v1/ws/server": {
				target: webSocketTargetUrl.origin,
				changeOrigin: true,
				headers: { origin: apiTargetUrl.origin },
				ws: true,
				cookieDomainRewrite: "",
			},
			"/api/v1/": {
				target: apiTargetUrl.origin,
				changeOrigin: true,
				headers: { origin: apiTargetUrl.origin },
				cookieDomainRewrite: "",
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
		// Target older Safari versions (iOS 15/16) explicitly, since Vite's
		// default "widely-available browsers" target only covers the latest
		// two major Safari releases and would otherwise emit syntax that
		// crashes on older WebKit engines (white screen on load).
		target: ["es2020", "safari15"],
		cssTarget: ["safari15"],
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
