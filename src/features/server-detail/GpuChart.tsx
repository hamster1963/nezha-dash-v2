import { useMemo } from "react";
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
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";

import type { gpuChartData } from "./chart-types";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function GpuChart({
	id,
	index,
	gpuStat,
	gpuName,
	gpuMemory,
	series,
	period,
}: {
	id: number;
	index: number;
	gpuStat: number;
	gpuName?: string;
	gpuMemory?: { memory_used?: number; memory_total?: number };
	series: RealtimeSeries;
	period: ChartPeriod;
}) {
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const transformGpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			gpu: value,
		}),
		[],
	);

	const {
		displayData: gpuHistoricalData,
		isLoading,
		status,
	} = useHistoricalData<gpuChartData>(id, "gpu", period, transformGpuData);

	const chartConfig = {
		gpu: {
			label: "GPU",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? (series.gpu[index] ?? []) : gpuHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<section className="flex flex-col items-center gap-2">
							{!gpuName && <p className="text-md font-medium">GPU</p>}
							{gpuName && <p className="text-xs mt-1 mb-1.5">GPU: {gpuName}</p>}
							{gpuMemory?.memory_total ? (
								<p className="text-xs text-muted-foreground">
									{gpuMemory.memory_used != null
										? formatBytes(gpuMemory.memory_used * 1024 * 1024)
										: "—"}{" "}
									/ {formatBytes(gpuMemory.memory_total * 1024 * 1024)}
								</p>
							) : null}
						</section>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">
								{gpuStat.toFixed(2)}%
							</p>
							<AnimatedCircularProgressBar
								className="size-3 text-[0px]"
								max={100}
								min={0}
								value={gpuStat}
								primaryColor="hsl(var(--chart-3))"
							/>
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
													<span className="text-muted-foreground">GPU</span>
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
									dataKey="gpu"
									type="step"
									fill="hsl(var(--chart-3))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-3))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}
