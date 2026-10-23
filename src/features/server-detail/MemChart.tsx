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
import {
	combineMetricHistory,
	useMetricHistory,
} from "@/hooks/use-metric-history";
import { formatBytes } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function MemChart({
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

	const { mem, swap } = selectServerMetrics(now, data);

	const history = useMetricHistory(data.id, ["memory", "swap"], period);
	const memHistoricalData = combineMetricHistory(
		history.data,
		(timestamp, primary, secondary) => ({
			timeStamp: String(timestamp),
			mem: data.host.mem_total > 0 ? (primary / data.host.mem_total) * 100 : 0,
			swap:
				data.host.swap_total > 0 ? (secondary / data.host.swap_total) * 100 : 0,
		}),
	);

	const chartConfig = {
		mem: {
			label: "Mem",
		},
		swap: {
			label: "Swap",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? series.mem : memHistoricalData;
	const isMemLoading = history.isLoading;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<section className="flex items-center gap-4">
							<div className="flex flex-col">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.mem")}
								</p>
								<div className="flex items-center gap-2">
									<AnimatedCircularProgressBar
										className="size-3 text-[0px]"
										max={100}
										min={0}
										value={mem}
										primaryColor="hsl(var(--chart-8))"
									/>
									<p className="text-xs font-medium">{mem.toFixed(0)}%</p>
								</div>
							</div>
							<div className="flex flex-col">
								<p className=" text-xs text-muted-foreground">
									{t("serverDetailChart.swap")}
								</p>
								<div className="flex items-center gap-2">
									<AnimatedCircularProgressBar
										className="size-3 text-[0px]"
										max={100}
										min={0}
										value={swap}
										primaryColor="hsl(var(--chart-10))"
									/>
									<p className="text-xs font-medium">{swap.toFixed(0)}%</p>
								</div>
							</div>
						</section>
						<section className="flex flex-col items-end gap-0.5">
							<div className="flex text-[11px] font-medium items-center gap-2">
								{formatBytes(data.state.mem_used)} /{" "}
								{formatBytes(data.host.mem_total)}
							</div>
							<div className="flex text-[11px] font-medium items-center gap-2">
								{data.host.swap_total ? (
									<>
										swap: {formatBytes(data.state.swap_used)} /{" "}
										{formatBytes(data.host.swap_total)}
									</>
								) : (
									<>no swap</>
								)}
							</div>
						</section>
					</div>
					<HistoricalError status={history.status} />
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isMemLoading ? (
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
											formatter={(value, name) => {
												const label =
													name === "mem"
														? t("serverDetailChart.mem")
														: t("serverDetailChart.swap");
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(1)}%
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Area
									isAnimationActive={false}
									dataKey="mem"
									type="step"
									fill="hsl(var(--chart-8))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-8))"
								/>
								<Area
									isAnimationActive={false}
									dataKey="swap"
									type="step"
									fill="hsl(var(--chart-10))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-10))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}
