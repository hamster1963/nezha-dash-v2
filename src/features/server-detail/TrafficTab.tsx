import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import ChartSkeleton from "@/components/loading/ChartSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
} from "@/components/ui/chart";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { useLoginUser } from "@/hooks/use-login-user";
import { useMetricHistory } from "@/hooks/use-metric-history";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HistoricalError } from "./HistoricalError";
import {
	buildTrafficSeries,
	getTrafficGranularity,
	getTrafficQueryPeriod,
	getTrafficRangeStart,
	type TrafficGranularity,
	type TrafficRange,
	type TrafficSeriesPoint,
} from "./traffic-series";

type TrafficSelectorOption<T extends string> = {
	value: T;
	label: string;
	disabled?: boolean;
};

type TrafficMetric = "total" | "upload" | "download";

function formatBucketLabel(
	timestamp: number,
	granularity: TrafficGranularity,
	language: string,
) {
	const options: Intl.DateTimeFormatOptions =
		granularity === "hour"
			? { hour: "2-digit", minute: "2-digit" }
			: { month: "short", day: "numeric" };
	return new Intl.DateTimeFormat(language, options).format(timestamp);
}

export function TrafficTab({ server_id }: { server_id: number }) {
	const { t, i18n } = useTranslation();
	const { isAuthenticated } = useLoginUser();
	const [range, setRange] = useState<TrafficRange>("1d");
	const [selectedMetric, setSelectedMetric] = useState<TrafficMetric>("total");
	const now = Date.now();

	const selectedRange = isAuthenticated ? range : "1d";
	const queryPeriod = getTrafficQueryPeriod(selectedRange, isAuthenticated);
	const chartGranularity = getTrafficGranularity(selectedRange);
	const rangeOptions = useMemo(
		() =>
			(["1d", "7d", "30d"] as const).map((value) => ({
				value,
				label: t(`serverTraffic.period${value}`),
				disabled: !isAuthenticated && value !== "1d",
			})),
		[isAuthenticated, t],
	);
	const history = useMetricHistory(
		server_id,
		["net_in_transfer", "net_out_transfer"],
		queryPeriod,
	);

	const rangeStart = getTrafficRangeStart(selectedRange, now);
	const rangeEnd = now;
	const chartData = useMemo(
		() =>
			buildTrafficSeries(
				history.data[0] ?? [],
				history.data[1] ?? [],
				chartGranularity,
				rangeStart,
				rangeEnd,
			),
		[chartGranularity, history.data, rangeEnd, rangeStart],
	);
	const hasSamples = history.data.some((points) => points.length > 1);
	const download = chartData.reduce(
		(total, point) => total + point.download,
		0,
	);
	const upload = chartData.reduce((total, point) => total + point.upload, 0);
	const summaryMetrics: {
		key: TrafficMetric;
		label: string;
		value: string;
		color: string;
	}[] = [
		{
			key: "total",
			label: t("serverTraffic.total"),
			value: formatBytes(download + upload),
			color: "bg-[hsl(var(--chart-2))]",
		},
		{
			key: "upload",
			label: t("serverTraffic.upload"),
			value: formatBytes(upload),
			color: "bg-[hsl(var(--chart-1))]",
		},
		{
			key: "download",
			label: t("serverTraffic.download"),
			value: formatBytes(download),
			color: "bg-[hsl(var(--chart-4))]",
		},
	];
	const chartConfig = {
		download: {
			label: t("serverTraffic.download"),
			color: "hsl(var(--chart-4))",
		},
		upload: {
			label: t("serverTraffic.upload"),
			color: "hsl(var(--chart-1))",
		},
	} satisfies ChartConfig;

	return (
		<section className="flex flex-col">
			<TrafficSelector
				options={rangeOptions}
				value={selectedRange}
				onChange={setRange}
			/>

			<Card>
				{hasSamples && (
					<div className="grid grid-cols-3 overflow-hidden rounded-t-lg border-b border-neutral-200 dark:border-neutral-800">
						{summaryMetrics.map((metric, index) => (
							<button
								key={metric.key}
								type="button"
								data-active={selectedMetric === metric.key}
								aria-pressed={selectedMetric === metric.key}
								onClick={() => setSelectedMetric(metric.key)}
								className={cn(
									"flex min-w-0 flex-col justify-center gap-1 px-3 py-4 text-left transition-colors data-[active=true]:bg-muted/50 sm:px-6",
									index > 0 &&
										"border-l border-neutral-200 dark:border-neutral-800",
								)}
							>
								<span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
									<span className={`size-2 rounded-full ${metric.color}`} />
									{metric.label}
								</span>
								<span className="text-md font-semibold leading-none sm:text-xl">
									{metric.value}
								</span>
							</button>
						))}
					</div>
				)}
				<CardContent className="space-y-4 px-6 py-3">
					{!isAuthenticated && (
						<p className="text-xs text-muted-foreground">
							{t("serverTraffic.loginForMoreHistory")}
						</p>
					)}

					<HistoricalError status={history.status} />

					{hasSamples ? (
						<div>
							<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
								<h3 className="text-sm font-medium">
									{t(`serverTraffic.${chartGranularity}Trend`)}
								</h3>
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									{selectedMetric !== "upload" && (
										<LegendItem
											label={t("serverTraffic.download")}
											color="bg-[hsl(var(--chart-4))]"
										/>
									)}
									{selectedMetric !== "download" && (
										<LegendItem
											label={t("serverTraffic.upload")}
											color="bg-[hsl(var(--chart-1))]"
										/>
									)}
								</div>
							</div>
							<ChartContainer
								config={chartConfig}
								className="aspect-auto h-[280px] w-full"
							>
								{history.isLoading ? (
									<ChartSkeleton />
								) : (
									<BarChart
										accessibilityLayer
										data={chartData}
										margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
									>
										<CartesianGrid vertical={false} />
										<XAxis
											dataKey="ts"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											minTickGap={24}
											tickFormatter={(value) =>
												formatBucketLabel(
													Number(value),
													chartGranularity,
													i18n.resolvedLanguage ?? i18n.language,
												)
											}
										/>
										<YAxis
											tickLine={false}
											axisLine={false}
											tickFormatter={(value) => formatBytes(Number(value), 0)}
											width={72}
										/>
										<ChartTooltip
											isAnimationActive={false}
											content={
												<TrafficChartTooltip
													granularity={chartGranularity}
													language={i18n.resolvedLanguage ?? i18n.language}
													labels={{
														total: t("serverTraffic.total"),
														upload: t("serverTraffic.upload"),
														download: t("serverTraffic.download"),
													}}
												/>
											}
										/>
										<Bar
											dataKey="download"
											stackId="traffic"
											fill="var(--color-download)"
											hide={selectedMetric === "upload"}
											radius={
												selectedMetric === "download"
													? [4, 4, 0, 0]
													: [0, 0, 0, 0]
											}
										/>
										<Bar
											dataKey="upload"
											stackId="traffic"
											fill="var(--color-upload)"
											hide={selectedMetric === "download"}
											radius={[4, 4, 0, 0]}
										/>
									</BarChart>
								)}
							</ChartContainer>
						</div>
					) : history.isLoading ? (
						<div className="flex min-h-48 items-center justify-center">
							<ChartSkeleton />
						</div>
					) : history.status === "error" ? null : (
						<div
							role="status"
							className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"
						>
							<p>{t("serverTraffic.noData")}</p>
							<p className="text-xs">{t("serverTraffic.tsdbHint")}</p>
						</div>
					)}
				</CardContent>
			</Card>
		</section>
	);
}

function TrafficChartTooltip({
	active,
	payload,
	granularity,
	language,
	labels,
}: {
	active?: boolean;
	payload?: Array<{ payload?: TrafficSeriesPoint }>;
	granularity: TrafficGranularity;
	language: string;
	labels: { total: string; upload: string; download: string };
}) {
	const point = payload?.[0]?.payload;
	if (!active || !point) return null;

	return (
		<div className="grid min-w-32 items-start gap-1.5 overflow-hidden rounded-sm border border-border/50 bg-stone-100 text-xs dark:bg-stone-900">
			<div className="px-2.5 pt-1 font-medium">
				{formatBucketLabel(point.ts, granularity, language)}
			</div>
			<div className="grid gap-1.5 border-t border-border/50 bg-white px-2.5 py-1.5 dark:bg-black">
				<TrafficTooltipRow
					label={labels.total}
					value={formatBytes(point.upload + point.download)}
				/>
				<TrafficTooltipRow
					label={labels.upload}
					value={formatBytes(point.upload)}
					color="bg-[hsl(var(--chart-1))]"
				/>
				<TrafficTooltipRow
					label={labels.download}
					value={formatBytes(point.download)}
					color="bg-[hsl(var(--chart-4))]"
				/>
			</div>
		</div>
	);
}

function TrafficTooltipRow({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color?: string;
}) {
	return (
		<div className="flex items-center justify-between gap-6 leading-none">
			<span className="flex items-center gap-1.5 text-muted-foreground">
				{color && <span className={`size-2 rounded-full ${color}`} />}
				{label}
			</span>
			<span className="font-medium tabular-nums">{value}</span>
		</div>
	);
}

function TrafficSelector<T extends string>({
	options,
	value,
	onChange,
}: {
	options: TrafficSelectorOption<T>[];
	value: T;
	onChange: (value: T) => void;
}) {
	const values = useMemo(
		() => options.map((option) => option.value),
		[options],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(values, value);

	return (
		<div
			ref={containerRef}
			className="relative flex gap-0.5 mb-3 flex-wrap sm:-mt-5 -mt-3 p-0.5 bg-muted dark:bg-muted/40 rounded-full w-fit border border-border/60 dark:border-border"
		>
			{indicator && (
				<div
					className="active-indicator-fade-in absolute left-0 top-0 z-10 bg-white dark:bg-background rounded-full ring-1 ring-border/60 dark:ring-border/40"
					style={{
						height: indicator.height,
						transform: `translate(${indicator.x}px, ${indicator.y}px)`,
						transition: indicator.shouldAnimate
							? "transform 0.5s var(--timing), width 0.5s var(--timing), height 0.5s var(--timing)"
							: "none",
						width: indicator.width,
					}}
				/>
			)}
			{options.map((option, index) => (
				<div
					key={option.value}
					ref={setItemRef(index)}
					className="relative z-20"
				>
					<button
						type="button"
						disabled={option.disabled}
						aria-pressed={value === option.value}
						onClick={() => {
							if (value !== option.value) {
								enableIndicatorAnimation();
								onChange(option.value);
							}
						}}
						className={cn(
							"relative z-20 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
							value === option.value
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
							option.disabled && "cursor-not-allowed opacity-40 grayscale",
						)}
					>
						<span className="relative z-20">{option.label}</span>
					</button>
				</div>
			))}
		</div>
	);
}

function LegendItem({ label, color }: { label: string; color: string }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			<span className={`size-2 rounded-full ${color}`} />
			{label}
		</span>
	);
}
