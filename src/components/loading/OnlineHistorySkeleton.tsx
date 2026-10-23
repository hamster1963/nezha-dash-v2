import { useTranslation } from "react-i18next";
import Bar from "@/components/loading/SkeletonBar";
import { Card, CardContent } from "@/components/ui/card";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

function Metric({ footer = true }: { footer?: boolean }) {
	return (
		<div className="flex min-w-0 flex-col items-center justify-center gap-2">
			<div className="flex h-4 items-center">
				<Bar className="h-3 w-14" />
			</div>
			<Bar className="h-7 w-24 max-w-full" />
			{footer && (
				<div className="flex h-4 max-w-full items-center">
					<Bar className="h-3 w-20 max-w-full" />
				</div>
			)}
		</div>
	);
}

export default function OnlineHistorySkeleton({ days = 1 }: { days?: number }) {
	const { t } = useTranslation();
	const { backgroundImage } = useRuntimeConfig();
	const dayCount = Math.min(31, Math.max(1, days) + 1);
	const cardClassName = cn({
		"bg-card/70": backgroundImage,
	});

	return (
		<div
			role="status"
			aria-label={t("serverOnlineHistory.loading")}
			aria-busy="true"
			data-testid="online-history-loading"
		>
			<div aria-hidden="true" className="flex flex-col gap-4">
				<div className="flex min-h-9 items-center justify-between gap-3">
					<div className="flex items-center gap-2 md:px-1">
						<Bar className="size-2 rounded-full" />
						<Bar className="h-3 w-8" />
					</div>
					<Bar className="h-9 w-36 rounded-full" />
				</div>

				<div className="px-0 py-2 md:px-6 md:py-4">
					<div className="hidden grid-cols-4 divide-x divide-stone-100 dark:divide-stone-800 md:grid">
						{Array.from({ length: 4 }, (_, index) => (
							<Metric key={index} />
						))}
					</div>
					<div className="flex flex-col gap-3 md:hidden">
						<div className="grid grid-cols-2 gap-4">
							<Metric />
							<Metric />
						</div>
						<div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-3 dark:border-stone-800">
							<Metric footer={false} />
							<Metric footer={false} />
						</div>
					</div>
				</div>

				<Card className={cardClassName}>
					<CardContent className="px-4 py-3 sm:px-5">
						<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
							<Bar className="h-4 w-28" />
							<Bar className="h-3 w-32" />
						</div>
						<div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
							{Array.from({ length: dayCount }, (_, index) => (
								<div
									key={index}
									className="flex min-w-0 flex-col gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2 dark:bg-muted/20"
								>
									<div className="flex h-4 items-center justify-between gap-2">
										<Bar className="h-3 w-20" />
										<Bar className="h-3 w-14" />
									</div>
									<Bar className="h-2 w-full rounded-full" />
									<div className="flex h-[9px] items-center justify-between">
										{Array.from({ length: 5 }, (_, tick) => (
											<Bar key={tick} className="h-1 w-2" />
										))}
									</div>
								</div>
							))}
						</div>
						<div className="mt-3 flex h-4 items-center gap-4">
							<Bar className="h-2 w-16" />
							<Bar className="h-2 w-16" />
							<Bar className="h-2 w-20" />
						</div>
					</CardContent>
				</Card>

				<Card className={cardClassName}>
					<CardContent className="px-4 py-3 sm:px-5">
						<div className="flex min-h-8 items-center justify-between gap-2">
							<Bar className="h-4 w-24" />
							<Bar className="-mt-1 -mr-2 h-[30px] w-24 self-start rounded-[8px] sm:-mr-3" />
						</div>
						<div className="mt-3 flex flex-col gap-3">
							{Array.from({ length: Math.min(3, dayCount) }, (_, index) => (
								<div key={index}>
									<div className="flex h-6 items-start justify-between gap-3">
										<Bar className="h-3 w-16" />
										<Bar className="h-3 w-20" />
									</div>
									<div className="flex flex-wrap gap-1.5">
										<Bar className="h-7 w-36" />
										<Bar className="h-7 w-40" />
									</div>
								</div>
							))}
							{dayCount > 3 && (
								<div className="flex h-8 items-center justify-center rounded-md border border-dashed border-border">
									<Bar className="h-3 w-16" />
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
