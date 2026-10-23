import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import ChartSkeleton from "@/components/loading/ChartSkeleton";
import AnimatedCircularProgressBar from "@/components/ui/animated-circular-progress-bar";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import { useHistoricalData } from "@/hooks/use-metric-history";
import { formatBytes } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import type { diskChartData } from "./chart-types";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function DiskChart({
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

	const { disk } = selectServerMetrics(now, data);

	const transformDiskData = useMemo(
		() => (timestamp: number, value: number) => {
			// Convert bytes to percentage
			const diskPercent =
				data.host.disk_total > 0 ? (value / data.host.disk_total) * 100 : 0;
			return {
				timeStamp: timestamp.toString(),
				disk: diskPercent,
			};
		},
		[data.host.disk_total],
	);

	const {
		displayData: diskHistoricalData,
		isLoading,
		status,
	} = useHistoricalData<diskChartData>(
		data.id,
		"disk",
		period,
		transformDiskData,
	);

	const chartConfig = {
		disk: {
			label: "Disk",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? series.disk : diskHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">{t("serverDetailChart.disk")}</p>
						<section className="flex flex-col items-end gap-0.5">
							<section className="flex items-center gap-2">
								<p className="text-xs text-end w-10 font-medium">
									{disk.toFixed(0)}%
								</p>
								<AnimatedCircularProgressBar
									className="size-3 text-[0px]"
									max={100}
									min={0}
									value={disk}
									primaryColor="hsl(var(--chart-5))"
								/>
							</section>
							<div className="flex text-[11px] font-medium items-center gap-2">
								{formatBytes(data.state.disk_used)} /{" "}
								{formatBytes(data.host.disk_total)}
							</div>
						</section>
					</div>
					<HistoricalError status={status} />
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
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
									domain={[0, 100]}
									tickFormatter={(value) => `${value}%`}
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
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">
														{t("serverDetailChart.disk")}
													</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(1)}%
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="disk"
									type="step"
									fill="hsl(var(--chart-5))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-5))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}
