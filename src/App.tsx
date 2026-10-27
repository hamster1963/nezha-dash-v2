import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Route,
	BrowserRouter as Router,
	Routes,
	useLocation,
} from "react-router-dom";

import { DashCommand } from "./components/DashCommand";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header, { RefreshToast } from "./components/Header";
import LocalErrorBoundary from "./components/LocalErrorBoundary";
import { ServerDetailPageLoading } from "./components/loading/ServerDetailLoading";
import RetryableLazy from "./components/RetryableLazy";
import { useBackground } from "./hooks/use-background";
import { useTheme } from "./hooks/use-theme";
import { InjectContext } from "./lib/inject";
import { fetchSetting } from "./lib/nezha-api";
import { refreshRuntimeConfig, useRuntimeConfig } from "./lib/runtime-config";
import {
	getPreloadedServerDetail,
	loadServerDetail,
	preloadServerDetail,
} from "./lib/server-detail-preload";
import { safeLocalStorage } from "./lib/storage";
import { cn } from "./lib/utils";
import ErrorPage from "./pages/ErrorPage";
import Server from "./pages/Server";

const loadNotFound = () => import("./pages/NotFound");
function ServerDetail({
	configurationLoading,
}: {
	configurationLoading: boolean;
}) {
	const { t } = useTranslation();
	if (configurationLoading) return <ServerDetailPageLoading />;
	// 已完成预加载时直接渲染，避免 lazy 首次读取已兑现 Promise 仍短暂挂起。
	return (
		<RetryableLazy
			load={loadServerDetail}
			getPreloaded={getPreloadedServerDetail}
			componentProps={{}}
			fallback={<ServerDetailPageLoading />}
			title={t("error.detailPageFailed")}
		/>
	);
}

// Route checker component
const RouteChecker: React.FC = () => {
	return <MainApp />;
};

const toError = (error: unknown) => {
	if (!error) return null;
	return error instanceof Error ? error : new Error(String(error));
};

const MainApp: React.FC = () => {
	const { pathname } = useLocation();
	const {
		data: settingData,
		error,
		isPending: settingsPending,
	} = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});
	const { i18n } = useTranslation();
	const { setTheme } = useTheme();
	const customCode = settingData?.data?.config?.custom_code ?? "";
	const [initialization, setInitialization] = useState<{
		code: string;
		status: "loading" | "ready" | "error";
		error?: Error;
	}>({ code: "", status: "loading" });
	const { forceTheme, mobileBackgroundImage: customMobileBackgroundImage } =
		useRuntimeConfig();
	const { backgroundImage: customBackgroundImage } = useBackground();

	useEffect(() => {
		// Preloading is optional; lazy routing retains its normal error boundary.
		preloadServerDetail();
	}, []);

	useEffect(() => {
		if (settingsPending) return;
		const controller = new AbortController();
		let cleanup: (() => void) | undefined;
		setInitialization({ code: customCode, status: "loading" });
		const initialize = async () => {
			try {
				cleanup = await InjectContext(customCode, {
					signal: controller.signal,
				});
				if (controller.signal.aborted) {
					cleanup?.();
					return;
				}
				refreshRuntimeConfig();
				setInitialization({ code: customCode, status: "ready" });
			} catch (error) {
				if (!controller.signal.aborted) {
					refreshRuntimeConfig();
					setInitialization({
						code: customCode,
						status: "error",
						error:
							toError(error) ?? new Error("Custom code initialization failed"),
					});
				}
			}
		};
		void initialize();
		return () => {
			controller.abort();
			cleanup?.();
		};
	}, [customCode, settingsPending]);

	const language = settingData?.data?.config?.language;
	useEffect(() => {
		const savedLanguage = safeLocalStorage.getItem("language");
		if (language && !savedLanguage)
			void Promise.resolve(i18n.changeLanguage(language)).catch(
				() => undefined,
			);
	}, [language, i18n]);

	useEffect(() => {
		if (forceTheme === "dark" || forceTheme === "light") {
			setTheme(forceTheme);
		}
	}, [forceTheme, setTheme]);

	const initialBackendError = !settingData ? toError(error) : null;

	const configurationLoading =
		settingsPending ||
		initialization.code !== customCode ||
		initialization.status === "loading";

	return (
		<ErrorBoundary>
			{initialization.status === "error" && (
				<div role="alert">
					Custom code initialization failed: {initialization.error?.message}
				</div>
			)}
			{/* 固定定位的背景层 */}
			{customBackgroundImage && (
				<div
					className={cn(
						"fixed inset-0 z-0 bg-cover min-h-lvh bg-no-repeat bg-center dark:brightness-75",
						{
							"hidden sm:block": customMobileBackgroundImage,
						},
					)}
					style={{ backgroundImage: `url(${customBackgroundImage})` }}
				/>
			)}
			{customMobileBackgroundImage && (
				<div
					className={cn(
						"fixed inset-0 z-0 bg-cover min-h-lvh bg-no-repeat bg-center sm:hidden dark:brightness-75",
					)}
					style={{ backgroundImage: `url(${customMobileBackgroundImage})` }}
				/>
			)}
			<div
				className={cn("app-shell flex w-full flex-col", {
					"bg-background": !customBackgroundImage,
				})}
			>
				<main className="flex z-20 min-h-0 flex-1 flex-col gap-4 p-4 md:p-10 md:pt-8">
					<RefreshToast />
					<Header configurationLoading={configurationLoading} />
					<DashCommand />
					<LocalErrorBoundary resetKey={pathname} allowReload>
						<Routes>
							<Route
								path="/"
								element={
									<Server
										backendError={initialBackendError}
										configurationLoading={configurationLoading}
									/>
								}
							/>
							<Route
								path="/server/:id"
								element={
									<ServerDetail configurationLoading={configurationLoading} />
								}
							/>
							<Route path="/error" element={<ErrorPage />} />
							<Route
								path="*"
								element={
									<RetryableLazy
										load={loadNotFound}
										componentProps={{}}
										fallback={null}
									/>
								}
							/>
						</Routes>
					</LocalErrorBoundary>
					<Footer />
				</main>
			</div>
		</ErrorBoundary>
	);
};

// Main App wrapper with router
const App: React.FC = () => {
	return (
		<Router basename={import.meta.env.BASE_URL}>
			<RouteChecker />
		</Router>
	);
};

export default App;
