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
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import { HistoricalError } from "./HistoricalError";
import type { RealtimeSeries } from "./realtime-series";
export function ConnectChart({
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
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { tcp, udp } = selectServerMetrics(now, data);

	const history = useMetricHistory(data.id, ["tcp_conn", "udp_conn"], period);
	const connectHistoricalData = combineMetricHistory(
		history.data,
		(timestamp, primary, secondary) => ({
			timeStamp: String(timestamp),
			tcp: primary,
			udp: secondary,
		}),
	);

	const chartConfig = {
		tcp: {
			label: "TCP",
		},
		udp: {
			label: "UDP",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? series.connect : connectHistoricalData;
	const isConnectLoading = history.isLoading;

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
							<div className="flex flex-col w-12">
								<p className="text-xs text-muted-foreground">TCP</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-1))]" />
									<p className="text-xs font-medium">{tcp}</p>
								</div>
							</div>
							<div className="flex flex-col w-12">
								<p className=" text-xs text-muted-foreground">UDP</p>
								<div className="flex items-center gap-1">
									<span className="relative inline-flex  size-1.5 rounded-full bg-[hsl(var(--chart-4))]" />
									<p className="text-xs font-medium">{udp}</p>
								</div>
							</div>
						</section>
					</div>
					<HistoricalError status={history.status} />
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isConnectLoading ? (
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
									interval="preserveStartEnd"
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
												const label = name === "tcp" ? "TCP" : "UDP";
												return (
													<div className="flex flex-1 items-center justify-between leading-none">
														<span className="text-muted-foreground">
															{label}
														</span>
														<span className="ml-2 font-medium text-foreground tabular-nums">
															{Number(value).toFixed(0)}
														</span>
													</div>
												);
											}}
										/>
									}
								/>
								<Line
									isAnimationActive={false}
									dataKey="tcp"
									type="linear"
									stroke="hsl(var(--chart-1))"
									strokeWidth={1}
									dot={false}
								/>
								<Line
									isAnimationActive={false}
									dataKey="udp"
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
