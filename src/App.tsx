import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { DashCommand } from "./components/DashCommand";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header, { RefreshToast } from "./components/Header";
import { Skeleton } from "./components/ui/skeleton";
import { useBackground } from "./hooks/use-background";
import { useTheme } from "./hooks/use-theme";
import { InjectContext } from "./lib/inject";
import { fetchSetting } from "./lib/nezha-api";
import { cn } from "./lib/utils";
import ErrorPage from "./pages/ErrorPage";
import Server from "./pages/Server";

const NotFound = lazy(() => import("./pages/NotFound"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));

function ServerDetailRouteFallback() {
	return (
		<div className="mx-auto w-full max-w-5xl px-0 flex flex-col gap-4">
			<div>
				<div className="flex flex-none items-center gap-0.5 text-xl">
					<Skeleton className="h-5 w-5 rounded-[5px] bg-muted-foreground/10 animate-none" />
					<Skeleton className="h-[20px] w-24 rounded-[5px] bg-muted-foreground/10 animate-none" />
				</div>
				<Skeleton className="flex flex-wrap gap-2 h-[81px] w-1/2 mt-3 rounded-[5px] bg-muted-foreground/10 animate-none" />
			</div>
			<section className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1 gap-3">
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
				<Skeleton className="h-[182px] w-full rounded-[5px] bg-muted-foreground/10 animate-none" />
			</section>
		</div>
	);
}

// Route checker component
const RouteChecker: React.FC = () => {
	return <MainApp />;
};

const MainApp: React.FC = () => {
	const { data: settingData, error } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});
	const { i18n } = useTranslation();
	const { setTheme } = useTheme();
	const [isCustomCodeInjected, setIsCustomCodeInjected] = useState(false);
	const { backgroundImage: customBackgroundImage } = useBackground();

	useEffect(() => {
		if (settingData?.data?.config?.custom_code) {
			InjectContext(settingData?.data?.config?.custom_code);
			setIsCustomCodeInjected(true);
		}
	}, [settingData?.data?.config?.custom_code]);

	// 检测是否强制指定了主题颜色
	const forceTheme =
		// @ts-expect-error ForceTheme is a global variable
		(window.ForceTheme as string) !== "" ? window.ForceTheme : undefined;

	useEffect(() => {
		if (forceTheme === "dark" || forceTheme === "light") {
			setTheme(forceTheme);
		}
	}, [forceTheme, setTheme]);

	if (error) {
		return <ErrorPage code={500} message={error.message} />;
	}

	if (!settingData) {
		return null;
	}

	if (settingData?.data?.config?.custom_code && !isCustomCodeInjected) {
		return null;
	}

	if (
		settingData?.data?.config?.language &&
		!localStorage.getItem("language")
	) {
		i18n.changeLanguage(settingData?.data?.config?.language);
	}

	const customMobileBackgroundImage =
		window.CustomMobileBackgroundImage !== ""
			? window.CustomMobileBackgroundImage
			: undefined;

	return (
		<ErrorBoundary>
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
				className={cn("flex min-h-screen w-full flex-col", {
					"bg-background": !customBackgroundImage,
				})}
			>
				<main className="flex z-20 min-h-[calc(100vh-calc(var(--spacing)*16))] flex-1 flex-col gap-4 p-4 md:p-10 md:pt-8">
					<RefreshToast />
					<Header />
					<DashCommand />
					<Routes>
						<Route path="/" element={<Server />} />
						<Route
							path="/server/:id"
							element={
								<Suspense fallback={<ServerDetailRouteFallback />}>
									<ServerDetail />
								</Suspense>
							}
						/>
						<Route path="/error" element={<ErrorPage />} />
						<Route
							path="*"
							element={
								<Suspense fallback={null}>
									<NotFound />
								</Suspense>
							}
						/>
					</Routes>
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
