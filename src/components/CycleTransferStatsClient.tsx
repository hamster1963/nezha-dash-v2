import type React from "react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

interface CycleTransferStatsClientProps {
	name: string;
	from: string;
	to: string;
	max: number;
	serverStats: Array<{
		serverId: string;
		serverName: string;
		transfer: number;
		nextUpdate: string;
	}>;
	className?: string;
}

export const CycleTransferStatsClient: React.FC<
	CycleTransferStatsClientProps
> = ({ name, from, to, max, serverStats, className }) => {
	const { t } = useTranslation();
	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();
	return (
		<div
			className={cn(
				"w-full bg-white px-4 py-3.5 rounded-lg border bg-card text-card-foreground hover:shadow-xs transition-all duration-200 dark:shadow-none",
				className,
				{
					"bg-card/70": customBackgroundImage,
				},
			)}
		>
			{serverStats.map(({ serverId, serverName, transfer, nextUpdate }) => {
				const progress = (transfer / max) * 100;

				return (
					<div key={serverId} className="space-y-3">
						{/* Header */}
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
								{serverName}
							</span>
							<div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-medium">
								{name}
							</div>
						</div>

						{/* Progress Section */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<div className="flex items-baseline gap-1">
									<span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
										{formatBytes(transfer)}
									</span>
									<span className="text-xs text-neutral-500 dark:text-neutral-400">
										/ {formatBytes(max)}
									</span>
								</div>
								<span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
									{progress.toFixed(1)}%
								</span>
							</div>

							<div className="relative h-1.5">
								<div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
								<div
									className="absolute inset-0 bg-emerald-500 rounded-full transition-all duration-300"
									style={{ width: `${Math.min(progress, 100)}%` }}
								/>
							</div>
						</div>

						{/* Footer */}
						<div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
							<span>
								{new Date(from).toLocaleDateString()} -{" "}
								{new Date(to).toLocaleDateString()}
							</span>
							<span>
								{t("cycleTransfer.nextUpdate")}:{" "}
								{new Date(nextUpdate).toLocaleString()}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default CycleTransferStatsClient;
