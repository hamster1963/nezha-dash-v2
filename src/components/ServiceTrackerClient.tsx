import type React from "react";
import { useTranslation } from "react-i18next";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

import { Separator } from "./ui/separator";

interface ServiceTrackerProps {
	days: Array<{
		completed: boolean;
		date?: Date;
		uptime: number;
		delay: number;
	}>;
	className?: string;
	title?: string;
	uptime?: number;
	avgDelay?: number;
}

export const ServiceTrackerClient: React.FC<ServiceTrackerProps> = ({
	days,
	className,
	title,
	uptime = 100,
	avgDelay = 0,
}) => {
	const { t } = useTranslation();
	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();

	const getUptimeColor = (uptime: number) => {
		if (uptime >= 99) return "text-emerald-500";
		if (uptime >= 95) return "text-amber-500";
		return "text-rose-500";
	};

	const getDelayColor = (delay: number) => {
		if (delay < 100) return "text-emerald-500";
		if (delay < 300) return "text-amber-500";
		return "text-rose-500";
	};

	const getStatusColor = (uptime: number) => {
		if (uptime >= 99) return "bg-emerald-500";
		if (uptime >= 95) return "bg-amber-500";
		return "bg-rose-500";
	};

	return (
		<div
			className={cn(
				"w-full space-y-3 bg-white px-4 py-4  rounded-lg border bg-card text-card-foreground shadow-lg shadow-neutral-200/40 dark:shadow-none",
				className,
				{
					"bg-card/70": customBackgroundImage,
				},
			)}
		>
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"w-2.5 h-2.5 rounded-full transition-colors",
							getStatusColor(uptime),
						)}
					/>
					<span className="font-medium text-sm">{title}</span>
				</div>
				<div className="flex items-center gap-3">
					<span
						className={cn(
							"font-medium text-sm transition-colors",
							getDelayColor(avgDelay),
						)}
					>
						{avgDelay.toFixed(0)}ms
					</span>
					<Separator className="h-4" orientation="vertical" />
					<span
						className={cn(
							"font-medium text-sm transition-colors",
							getUptimeColor(uptime),
						)}
					>
						{uptime.toFixed(1)}% {t("serviceTracker.uptime")}
					</span>
				</div>
			</div>

			<div className="flex gap-[3px] p-1 rounded-lg">
				{days.map((day, index) => (
					<TooltipProvider delayDuration={50} key={index}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"relative flex-1 h-7 rounded-[8px] transition-all duration-200 cursor-help",
										"before:absolute before:inset-0 before:rounded-[4px] before:opacity-0 hover:before:opacity-100 before:bg-white/10 before:transition-opacity",
										"after:absolute after:inset-0 after:rounded-[4px] after:shadow-[inset_0_1px_--theme(--color-white/10%)]",
										day.completed
											? "bg-linear-to-b from-green-500/90 to-green-600 shadow-[0_1px_2px_--theme(--color-green-600/30%)]"
											: "bg-linear-to-b from-red-500/80 to-red-600/90 shadow-[0_1px_2px_--theme(--color-red-600/30%)]",
									)}
								/>
							</TooltipTrigger>
							<TooltipContent className="p-0 overflow-hidden rounded-[10px]">
								<div className="px-3 py-2 bg-popover">
									<p className="font-medium text-sm mb-2">
										{day.date?.toLocaleDateString()}
									</p>
									<div className="space-y-1.5">
										<div className="flex items-center justify-between gap-3">
											<span className="text-xs text-muted-foreground">
												{t("serviceTracker.uptime")}:
											</span>
											<span
												className={cn(
													"text-xs font-medium",
													day.uptime > 95 ? "text-green-500" : "text-red-500",
												)}
											>
												{day.uptime.toFixed(1)}%
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-xs text-muted-foreground">
												{t("serviceTracker.delay")}:
											</span>
											<span
												className={cn(
													"text-xs font-medium",
													day.delay < 100
														? "text-green-500"
														: day.delay < 300
															? "text-yellow-500"
															: "text-red-500",
												)}
											>
												{day.delay.toFixed(0)}ms
											</span>
										</div>
									</div>
								</div>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				))}
			</div>

			<div className="flex justify-between text-xs text-stone-500 dark:text-stone-400">
				<span>30 {t("serviceTracker.daysAgo")}</span>
				<span>{t("serviceTracker.today")}</span>
			</div>
		</div>
	);
};

export default ServiceTrackerClient;
