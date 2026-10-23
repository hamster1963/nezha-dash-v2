import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import ChartSkeleton from "@/components/loading/ChartSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import { useHistoricalData } from "@/hooks/use-metric-history";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import type { processChartData } from "./chart-types";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function ProcessChart({
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

	const { process } = selectServerMetrics(now, data);

	const transformProcessData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			process: value,
		}),
		[],
	);

	const {
		displayData: processHistoricalData,
		isLoading,
		status,
	} = useHistoricalData<processChartData>(
		data.id,
		"process_count",
		period,
		transformProcessData,
	);

	const chartConfig = {
		process: {
			label: "Process",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? series.process : processHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">
							{t("serverDetailChart.process")}
						</p>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">{process}</p>
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
								/>
								<ChartTooltip
									isAnimationActive={false}
									content={
										<ChartTooltipContent
											indicator={"dot"}
											labelFormatter={(_, payload) => {
												return formatTime(
													Number(payload[0]?.payload?.timeStamp),
												);
											}}
											formatter={(value) => (
												<div className="flex flex-1 items-center justify-between leading-none">
													<span className="text-muted-foreground">
														{t("serverDetailChart.process")}
													</span>
													<span className="ml-2 font-medium text-foreground tabular-nums">
														{Number(value).toFixed(0)}
													</span>
												</div>
											)}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="process"
									type="step"
									fill="hsl(var(--chart-2))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-2))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}
