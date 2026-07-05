import {
	ArrowDownCircleIcon,
	ArrowUpCircleIcon,
} from "@heroicons/react/20/solid";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { useStatus } from "@/hooks/use-status";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import NumericText from "./NumericText";

type ServerOverviewProps = {
	online: number;
	offline: number;
	total: number;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
};

export default function ServerOverview({
	online,
	offline,
	total,
	up,
	down,
	upSpeed,
	downSpeed,
}: ServerOverviewProps) {
	const { t } = useTranslation();
	const { status, setStatus } = useStatus();

	// @ts-expect-error DisableAnimatedMan is a global variable
	const disableAnimatedMan = window.DisableAnimatedMan as boolean;

	// @ts-expect-error CustomIllustration is a global variable
	const customIllustration = window.CustomIllustration || "/animated-man.webp";

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	return (
		<section className="grid grid-cols-2 gap-4 lg:grid-cols-4 server-overview">
			<Card
				onClick={() => {
					setStatus("all");
				}}
				className={cn(
					"group cursor-pointer transition-all hover:ring-blue-500 dark:hover:ring-blue-600",
					{
						"bg-card/70": customBackgroundImage,
					},
				)}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.totalServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
							</span>
							<NumericText value={total} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				onClick={() => {
					setStatus("online");
				}}
				className={cn(
					"cursor-pointer ring-1 transition-all hover:ring-green-500 dark:hover:ring-green-600",
					{
						"bg-card/70": customBackgroundImage,
					},
					{
						"border-transparent ring-2 ring-green-500 dark:ring-green-600":
							status === "online",
					},
				)}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.onlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
							</span>
							<NumericText value={online} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				onClick={() => {
					setStatus("offline");
				}}
				className={cn(
					"cursor-pointer ring-1 transition-all hover:ring-red-500 dark:hover:ring-red-600",
					{
						"bg-card/70": customBackgroundImage,
					},
					{
						"border-transparent ring-2 ring-red-500 dark:ring-red-600":
							status === "offline",
					},
				)}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.offlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
							</span>
							<NumericText value={offline} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				className={cn(
					"group ring-1 hover:ring-purple-500 dark:hover:ring-purple-600",
					{
						"bg-card/70": customBackgroundImage,
					},
				)}
			>
				<CardContent className="flex h-full items-center relative px-6 py-3">
					<section className="flex flex-col gap-1 w-full">
						<div className="flex items-center w-full justify-between">
							<p className="text-sm font-medium md:text-base">
								{t("serverOverview.network")}
							</p>
						</div>
						<section className="flex items-start flex-row z-10 pr-0 gap-1">
							<NumericText
								value={`↑${formatBytes(up)}`}
								className="sm:text-[12px] text-[10px] text-blue-800 dark:text-blue-400  text-nowrap font-medium"
							/>
							<NumericText
								value={`↓${formatBytes(down)}`}
								className="sm:text-[12px] text-[10px]  text-purple-800 dark:text-purple-400  text-nowrap font-medium"
							/>
						</section>
						<section className="flex flex-col sm:flex-row -mr-1 sm:items-center items-start gap-1">
							<p className="text-[11px] flex items-center text-nowrap font-semibold">
								<ArrowUpCircleIcon className="size-3 mr-0.5 sm:mb-px" />
								{formatBytes(upSpeed)}/s
							</p>
							<p className="text-[11px] flex items-center  text-nowrap font-semibold">
								<ArrowDownCircleIcon className="size-3 mr-0.5" />
								{formatBytes(downSpeed)}/s
							</p>
						</section>
					</section>
					{!disableAnimatedMan && (
						<img
							className="absolute right-3 top-[-85px] z-50 w-20 scale-90 group-hover:opacity-50 md:scale-100 transition-all"
							alt={"animated-man"}
							src={customIllustration}
							loading="eager"
						/>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
