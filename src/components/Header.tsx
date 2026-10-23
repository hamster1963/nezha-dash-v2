import { useQuery } from "@tanstack/react-query";
import { ImageMinus } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ThemeSwitcher";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackground } from "@/hooks/use-background";
import { useLoginUser } from "@/hooks/use-login-user";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchSetting } from "@/lib/nezha-api";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { safeSessionStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { Loader, LoadingSpinner } from "./loading/Loader";
import NumericText from "./NumericText";
import { SearchButton } from "./SearchButton";
import { Button } from "./ui/button";

interface TimeState {
	hh: number;
	mm: number;
	ss: number;
}

const useCurrentTime = () => {
	const [time, setTime] = useState<TimeState>({
		hh: DateTime.now().setLocale("en-US").hour,
		mm: DateTime.now().setLocale("en-US").minute,
		ss: DateTime.now().setLocale("en-US").second,
	});

	useEffect(() => {
		const intervalId = setInterval(() => {
			const now = DateTime.now().setLocale("en-US");
			setTime({
				hh: now.hour,
				mm: now.minute,
				ss: now.second,
			});
		}, 1000);

		return () => clearInterval(intervalId);
	}, []);

	return time;
};

function Header() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { backgroundImage, updateBackground } = useBackground();

	const { data: settingData, isLoading } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});

	const { lastData, connected, reconnect } = useWebSocketContext();

	const onlineCount = connected ? (lastData ? lastData.online || 0 : 0) : "...";

	const siteName = settingData?.data?.config?.site_name;

	const config = useRuntimeConfig();
	const customLogo = config.customLogo || "/apple-touch-icon.png";
	const customDesc = config.customDesc || t("nezha");
	const customMobileBackgroundImage = config.mobileBackgroundImage;

	useEffect(() => {
		const link =
			document.querySelector("link[rel*='icon']") ||
			document.createElement("link");
		// @ts-expect-error set link.type
		link.type = "image/x-icon";
		// @ts-expect-error set link.rel
		link.rel = "shortcut icon";
		// @ts-expect-error set link.href
		link.href = customLogo;
		document.getElementsByTagName("head")[0].appendChild(link);
	}, [customLogo]);

	useEffect(() => {
		document.title = siteName || "哪吒监控 Nezha Monitoring";
	}, [siteName]);

	const handleBackgroundToggle = () => {
		if (backgroundImage) {
			// Store the current background image before removing it
			safeSessionStorage.setItem("savedBackgroundImage", backgroundImage);
			updateBackground(undefined);
		} else {
			// Restore the saved background image
			const savedImage = safeSessionStorage.getItem("savedBackgroundImage");
			if (savedImage) {
				updateBackground(savedImage);
			}
		}
	};

	const customBackgroundImage = backgroundImage;

	return (
		<div className="mx-auto w-full max-w-5xl">
			<section className="flex items-center justify-between header-top">
				<section
					onClick={() => {
						safeSessionStorage.removeItem("selectedGroup");
						navigate("/");
					}}
					className="cursor-pointer flex items-center sm:text-base text-sm font-medium"
				>
					<div className="mr-1 flex flex-row items-center justify-start header-logo">
						<img
							width={40}
							height={40}
							alt="apple-touch-icon"
							src={customLogo}
							className="relative m-0! border-2 border-transparent h-6 w-6 object-cover object-top p-0!"
						/>
					</div>
					{isLoading ? (
						<Skeleton className="h-6 w-20 rounded-[5px] bg-muted-foreground/10 animate-none" />
					) : (
						siteName || "NEZHA"
					)}
					<Separator
						orientation="vertical"
						className="mx-2 hidden h-4 w-px md:block"
					/>
					<p className="hidden text-sm font-medium opacity-40 md:block">
						{customDesc}
					</p>
				</section>
				<section className="flex items-center gap-2 header-handles">
					<div className="hidden sm:flex items-center gap-2">
						<Links />
						<DashboardLink />
					</div>
					<SearchButton />
					<LanguageSwitcher />
					<ModeToggle />
					{(customBackgroundImage ||
						safeSessionStorage.getItem("savedBackgroundImage")) && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleBackgroundToggle}
							className={cn("rounded-full px-[9px] bg-white dark:bg-black", {
								"bg-white/70 dark:bg-black/70": customBackgroundImage,
								"hidden sm:block": customMobileBackgroundImage,
							})}
						>
							<ImageMinus className="w-4 h-4" />
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={connected ? undefined : reconnect}
						aria-label={connected ? undefined : t("retry")}
						className={cn(
							"hover:bg-white dark:hover:bg-black cursor-default rounded-full flex items-center px-[9px] bg-white dark:bg-black",
							{
								"bg-white/70 dark:bg-black/70": customBackgroundImage,
							},
						)}
					>
						{connected ? (
							<NumericText value={onlineCount} />
						) : (
							<Loader visible={true} />
						)}
						<p className="text-muted-foreground">
							{connected ? t("online") : t("offline")}
						</p>
						<span
							className={cn("h-2 w-2 rounded-full bg-green-500", {
								"bg-red-500": !connected,
							})}
						></span>
					</Button>
				</section>
			</section>
			<div className="w-full flex justify-between sm:hidden mt-1">
				<DashboardLink />
				<Links />
			</div>
			<Overview />
		</div>
	);
}

type links = {
	link: string;
	name: string;
};

function parseCustomLinks(customLinks: string | undefined): links[] | null {
	if (!customLinks) return null;

	try {
		const parsedLinks = JSON.parse(customLinks);

		if (!Array.isArray(parsedLinks)) {
			return null;
		}

		return parsedLinks.filter(
			(link): link is links =>
				typeof link?.link === "string" && typeof link?.name === "string",
		);
	} catch {
		return null;
	}
}

function Links() {
	const { customLinks } = useRuntimeConfig();

	const links = parseCustomLinks(customLinks);

	if (!links) return null;

	return (
		<div className="flex items-center gap-2 w-fit">
			{links.map((link, index) => {
				return (
					<a
						key={index}
						href={link.link}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
					>
						{link.name}
					</a>
				);
			})}
		</div>
	);
}

export function RefreshToast() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const { needReconnect } = useWebSocketContext();

	useEffect(() => {
		if (!needReconnect) return;
		safeSessionStorage.removeItem("needRefresh");
		const timer = setTimeout(() => navigate(0), 1000);
		return () => clearTimeout(timer);
	}, [needReconnect, navigate]);

	if (!needReconnect) return null;

	return (
		<div className="refresh-toast-animate fixed left-1/2 -translate-x-1/2 top-8 z-999 flex items-center justify-between gap-4 rounded-[50px] border border-solid bg-white px-2 py-1.5 shadow-xl shadow-black/5 dark:border-stone-700 dark:bg-stone-800 dark:shadow-none">
			<section className="flex items-center gap-1.5">
				<LoadingSpinner />
				<p className="text-[12.5px] font-medium">{t("refreshing")}...</p>
			</section>
		</div>
	);
}

function DashboardLink() {
	const { t } = useTranslation();
	const { setNeedReconnect } = useWebSocketContext();
	const previousLoginState = useRef<boolean | null>(null);
	const { isAuthenticated: isLogin, authStatus } = useLoginUser();

	useEffect(() => {
		if (authStatus === "unknown") return;
		if (
			previousLoginState.current !== null &&
			previousLoginState.current !== isLogin
		) {
			setNeedReconnect(true);
		}
		previousLoginState.current = isLogin;
	}, [isLogin, authStatus, setNeedReconnect]);

	return (
		<div className="flex items-center gap-2">
			<a
				href={"/dashboard"}
				rel="noopener noreferrer"
				className="flex items-center text-nowrap gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
			>
				{!isLogin && t("login")}
				{isLogin && t("dashboard")}
			</a>
		</div>
	);
}

function Overview() {
	const { t } = useTranslation();
	const time = useCurrentTime();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<section className={"mt-10 flex flex-col md:mt-16 header-timer"}>
			<p className="text-base font-semibold">👋 {t("overview")}</p>
			<div className="flex items-center gap-1">
				<p className="text-sm font-medium opacity-50">{t("whereTheTimeIs")}</p>
				{mounted ? (
					<div className="flex items-center font-medium text-sm">
						<span className="tabular-nums">
							{String(time.hh).padStart(2, "0")}
						</span>
						<span className="mb-px font-medium text-sm opacity-50">:</span>
						<span className="tabular-nums">
							{String(time.mm).padStart(2, "0")}
						</span>
						<span className="mb-px font-medium text-sm opacity-50">:</span>
						<span className="font-medium text-sm">
							<span className="tabular-nums">
								{String(time.ss).padStart(2, "0")}
							</span>
						</span>
					</div>
				) : (
					<Skeleton className="h-[21px] w-16 animate-none rounded-[5px] bg-muted-foreground/10" />
				)}
			</div>
		</section>
	);
}
export default Header;
