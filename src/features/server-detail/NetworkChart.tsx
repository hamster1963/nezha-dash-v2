import { useTranslation } from "react-i18next";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import ChartSkeleton from "@/components/loading/ChartSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import {
	combineMetricHistory,
	useMetricHistory,
} from "@/hooks/use-metric-history";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function NetworkChart({
	now,
	data,
	series,
	period,
}: {
	now: number;
	data: NezhaServer;
	series: RealtimeSeries;
	period: ChartPeriod;
}) {
	const { t } = useTranslation();

	const { backgroundImage: customBackgroundImage } = useRuntimeConfig();

	const { up, down } = selectServerMetrics(now, data);

	const history = useMetricHistory(
		data.id,
		["net_out_speed", "net_in_speed"],
		period,
	);
	const networkHistoricalData = combineMetricHistory(
		history.data,
		(timestamp, primary, secondary) => ({
			timeStamp: String(timestamp),
			upload: primary / 1024 / 1024,
			download: secondary / 1024 / 1024,
		}),
	);

	const displayData =
		period === "realtime" ? series.network : networkHistoricalData;
	const isNetworkLoading = history.isLoading;

	let maxDownload = Math.max(...displayData.map((item) => item.download));
	maxDownload = Math.ceil(maxDownload);
	if (maxDownload < 1) {
		maxDownload = 1;
	}

	const chartConfig = {
		upload: {
			label: "Upload",
		},
		download: {
			label: "Download",
		},
	} satisfies ChartConfig;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center">
						<section className="flex items-center gap-4">
							<div className="flex flex-col w-20">
								<p className="text-xs text-muted-foreground">
									{t("serverDetailChart.upload")}
								</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-1))]" />
									<p className="text-xs font-medium">
										{up >= 1024
											? `${(up / 1024).toFixed(2)}G/s`
											: up >= 1
												? `${up.toFixed(2)}M/s`
												: `${(up * 1024).toFixed(2)}K/s`}
									</p>
								</div>
							</div>
							<div className="flex flex-col w-20">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.download")}
								</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-4))]" />
									<p className="text-xs font-medium">
										{down >= 1024
											? `${(down / 1024).toFixed(2)}G/s`
											: down >= 1
												? `${down.toFixed(2)}M/s`
												: `${(down * 1024).toFixed(2)}K/s`}
									</p>
								</div>
							</div>
						</section>
					</div>
					<HistoricalError status={history.status} />
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isNetworkLoading ? (
							<ChartSkeleton />
						) : (
							<LineChart
								syncId="serverDetailCharts"
								syncMethod="value"
								accessibilityLayer
								data={displayData}
								margin={{
									top: 12,
									left: 12,
									right: 12,
								}}
							>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="timeStamp"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={200}
									interval="preserveStartEnd"
									tickFormatter={(value) => formatRelativeTime(value)}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									mirror={true}
									tickMargin={-15}
									type="number"
									minTickGap={50}
									interval="preserveStartEnd"
									domain={[1, maxDownload]}
									tickFormatter={(value) => `${value.toFixed(0)}M/s`}
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator="dot"
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value, name) => {
												const label =
													name === "upload"
														? t("serverDetailChart.upload")
														: t("serverDetailChart.download");
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(2)} MB/s
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Line
									isAnimationActive={false}
									dataKey="upload"
									type="linear"
									stroke="hsl(var(--chart-1))"
									strokeWidth={1}
									dot={false}
								/>
								<Line
									isAnimationActive={false}
									dataKey="download"
									type="linear"
									stroke="hsl(var(--chart-4))"
									strokeWidth={1}
									dot={false}
								/>
							</LineChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}
