import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { useLoginUser } from "@/hooks/use-login-user";
import {
	combineMetricHistory,
	useHistoricalData,
	useMetricHistory,
} from "@/hooks/use-metric-history";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { formatBytes } from "@/lib/format";
import { fetchSetting } from "@/lib/nezha-api";
import { selectServerMetrics } from "@/lib/server-metrics";
import { cn, formatRelativeTime, formatTime } from "@/lib/utils";
import type {
	MetricPeriod,
	NezhaServer,
	NezhaWebsocketResponse,
} from "@/types/nezha-api";

import ChartSkeleton from "./loading/ChartSkeleton";
import { ServerDetailChartLoading } from "./loading/ServerDetailLoading";
import AnimatedCircularProgressBar from "./ui/animated-circular-progress-bar";

type ChartPeriod = "realtime" | MetricPeriod;

type gpuChartData = {
	timeStamp: string;
	gpu: number;
};

type cpuChartData = {
	timeStamp: string;
	cpu: number;
};

type processChartData = {
	timeStamp: string;
	process: number;
};

type diskChartData = {
	timeStamp: string;
	disk: number;
};

type memChartData = {
	timeStamp: string;
	mem: number;
	swap: number;
};

type networkChartData = {
	timeStamp: string;
	upload: number;
	download: number;
};

type connectChartData = {
	timeStamp: string;
	tcp: number;
	udp: number;
};

function PeriodSelector({
	selectedPeriod,
	onPeriodChange,
	isLogin,
	isTsdbEnabled,
}: {
	selectedPeriod: ChartPeriod;
	onPeriodChange: (period: ChartPeriod) => void;
	isLogin: boolean;
	isTsdbEnabled: boolean;
}) {
	const { t } = useTranslation();

	const periods = useMemo<{ value: ChartPeriod; label: string }[]>(
		() => [
			{ value: "realtime", label: t("serverDetailChart.realtime") },
			{ value: "1d", label: t("serverDetailChart.period1d") },
			{ value: "7d", label: t("serverDetailChart.period7d") },
			{ value: "30d", label: t("serverDetailChart.period30d") },
		],
		[t],
	);
	const periodValues = useMemo(
		() => periods.map((period) => period.value),
		[periods],
	);
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(periodValues, selectedPeriod);

	return (
		<TooltipProvider delayDuration={120}>
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
				{periods.map((period, index) => {
					const isHistoryPeriod = period.value !== "realtime";
					const isLockedByTsdb = !isTsdbEnabled && isHistoryPeriod;
					// Only realtime and 1d are available for non-logged-in users
					const isLockedByLogin =
						!isLockedByTsdb &&
						!isLogin &&
						period.value !== "realtime" &&
						period.value !== "1d";
					const isLocked = isLockedByTsdb || isLockedByLogin;

					const periodItem = (
						<div
							ref={setItemRef(index)}
							onClick={() => {
								if (!isLocked) {
									if (selectedPeriod !== period.value) {
										enableIndicatorAnimation();
									}
									onPeriodChange(period.value);
								}
							}}
							className={cn(
								"relative cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300",
								selectedPeriod === period.value
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground",
								isLocked && "cursor-not-allowed opacity-40 grayscale",
							)}
						>
							<div className="relative z-20 flex items-center gap-1.5">
								{period.value === "realtime" && (
									<span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 dark:bg-emerald-400"></span>
								)}
								{period.label}
							</div>
						</div>
					);

					if (isLockedByTsdb || isLockedByLogin) {
						return (
							<Tooltip key={period.value}>
								<TooltipTrigger asChild>{periodItem}</TooltipTrigger>
								<TooltipContent>
									{isLockedByTsdb
										? t(
												"serverDetailChart.tsdbRequired",
												"Enable TSDB to use historical data",
											)
										: t(
												"serverDetailChart.loginRequired",
												"Please login to view",
											)}
								</TooltipContent>
							</Tooltip>
						);
					}

					return <div key={period.value}>{periodItem}</div>;
				})}
			</div>
		</TooltipProvider>
	);
}

export default function ServerDetailChart({
	server_id,
}: {
	server_id: string;
}) {
	const { lastData, connected, messageHistory } = useWebSocketContext();
	const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("realtime");

	// Check if user is logged in
	const { data: userData, isError: isLoginError } = useLoginUser();
	const isLogin = isLoginError
		? false
		: userData
			? !!userData?.data?.id && !!document.cookie
			: false;

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});
	const isTsdbEnabled = settingData?.data?.tsdb_enabled ?? true;

	useEffect(() => {
		if (!isTsdbEnabled && selectedPeriod !== "realtime") {
			setSelectedPeriod("realtime");
		}
	}, [isTsdbEnabled, selectedPeriod]);

	// Reset period if user is not logged in and selected period is restricted
	useEffect(() => {
		if (
			isTsdbEnabled &&
			!isLogin &&
			selectedPeriod !== "realtime" &&
			selectedPeriod !== "1d"
		) {
			setSelectedPeriod("1d");
		}
	}, [isLogin, isTsdbEnabled, selectedPeriod]);

	if (!connected && !lastData) {
		return <ServerDetailChartLoading />;
	}

	const nezhaWsData = lastData;

	if (!nezhaWsData) {
		return <ServerDetailChartLoading />;
	}

	const server = nezhaWsData.servers.find((s) => s.id === Number(server_id));

	if (!server) {
		return <ServerDetailChartLoading />;
	}

	const gpuStats = server.state.gpu || [];
	const gpuList = server.host.gpu || [];
	// Newer agents also report memory per card, index-aligned with the above.
	const gpuDetails = server.state.gpus || [];

	return (
		<section className="flex flex-col">
			<PeriodSelector
				selectedPeriod={selectedPeriod}
				onPeriodChange={setSelectedPeriod}
				isLogin={isLogin}
				isTsdbEnabled={isTsdbEnabled}
			/>
			<section className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1 gap-3 server-charts">
				<CpuChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				{gpuStats.length >= 1 && gpuList.length === gpuStats.length
					? gpuList.map((gpu, index) => (
							<GpuChart
								index={index}
								id={server.id}
								now={nezhaWsData.now}
								gpuStat={gpuStats[index]}
								gpuName={gpu}
								gpuMemory={gpuDetails[index]}
								messageHistory={messageHistory}
								period={selectedPeriod}
								key={index}
							/>
						))
					: gpuStats.length > 0
						? gpuStats.map((gpu, index) => (
								<GpuChart
									index={index}
									id={server.id}
									now={nezhaWsData.now}
									gpuStat={gpu}
									gpuName={`#${index + 1}`}
									gpuMemory={gpuDetails[index]}
									messageHistory={messageHistory}
									period={selectedPeriod}
									key={index}
								/>
							))
						: null}
				<MemChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<DiskChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<ProcessChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<NetworkChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
				<ConnectChart
					now={nezhaWsData.now}
					data={server}
					messageHistory={messageHistory}
					period={selectedPeriod}
				/>
			</section>
		</section>
	);
}

function GpuChart({
	now,
	id,
	index,
	gpuStat,
	gpuName,
	gpuMemory,
	messageHistory,
	period,
}: {
	now: number;
	id: number;
	index: number;
	gpuStat: number;
	gpuName?: string;
	gpuMemory?: { memory_used?: number; memory_total?: number };
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [gpuChartData, setGpuChartData] = useState<gpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

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

	const { displayData: gpuHistoricalData, isLoading } =
		useHistoricalData<gpuChartData>(id, "gpu", period, transformGpuData);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === id);
					if (!server) return null;
					const { gpu } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						gpu: gpu[index],
					};
				})
				.filter((item): item is gpuChartData => item !== null)
				.reverse();

			setGpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, id, index, period]);

	useEffect(() => {
		if (Number.isFinite(gpuStat) && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setGpuChartData((prevData) => {
				let newData = [] as gpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, gpu: gpuStat },
						{ timeStamp: timestamp, gpu: gpuStat },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, gpu: gpuStat }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, gpuStat, historyLoaded, period]);

	const chartConfig = {
		gpu: {
			label: "GPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? gpuChartData : gpuHistoricalData;

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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
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

function CpuChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [cpuChartData, setCpuChartData] = useState<cpuChartData[]>([]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const { cpu } = selectServerMetrics(now, data);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const transformCpuData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			cpu: value,
		}),
		[],
	);

	const { displayData: cpuHistoricalData, isLoading } =
		useHistoricalData<cpuChartData>(data.id, "cpu", period, transformCpuData);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { cpu } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						cpu: cpu,
					};
				})
				.filter((item): item is cpuChartData => item !== null)
				.reverse();

			setCpuChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 更新实时数据
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setCpuChartData((prevData) => {
				let newData = [] as cpuChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, cpu: cpu },
						{ timeStamp: timestamp, cpu: cpu },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, cpu: cpu }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, cpu, period]);

	const chartConfig = {
		cpu: {
			label: "CPU",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? cpuChartData : cpuHistoricalData;

	return (
		<Card
			className={cn({
				"bg-card/70": customBackgroundImage,
			})}
		>
			<CardContent className="px-6 py-3">
				<section className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<p className="text-md font-medium">CPU</p>
						<section className="flex items-center gap-2">
							<p className="text-xs text-end w-10 font-medium">
								{cpu.toFixed(2)}%
							</p>
							<AnimatedCircularProgressBar
								className="size-3 text-[0px]"
								max={100}
								min={0}
								value={cpu}
								primaryColor="hsl(var(--chart-1))"
							/>
						</section>
					</div>
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
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
													<span className="text-muted-foreground">CPU</span>
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
									dataKey="cpu"
									type="step"
									fill="hsl(var(--chart-1))"
									fillOpacity={0.3}
									stroke="hsl(var(--chart-1))"
								/>
							</AreaChart>
						)}
					</ChartContainer>
				</section>
			</CardContent>
		</Card>
	);
}

function ProcessChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [processChartData, setProcessChartData] = useState(
		[] as processChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const { process } = selectServerMetrics(now, data);

	const transformProcessData = useMemo(
		() => (timestamp: number, value: number) => ({
			timeStamp: timestamp.toString(),
			process: value,
		}),
		[],
	);

	const { displayData: processHistoricalData, isLoading } =
		useHistoricalData<processChartData>(
			data.id,
			"process_count",
			period,
			transformProcessData,
		);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { process } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						process,
					};
				})
				.filter((item): item is processChartData => item !== null)
				.reverse();

			setProcessChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setProcessChartData((prevData) => {
				let newData = [] as processChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, process },
						{ timeStamp: timestamp, process },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, process }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, process, period]);

	const chartConfig = {
		process: {
			label: "Process",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? processChartData : processHistoricalData;

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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
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

function MemChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [memChartData, setMemChartData] = useState([] as memChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

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

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { mem, swap } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						mem,
						swap,
					};
				})
				.filter((item): item is memChartData => item !== null)
				.reverse();

			setMemChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setMemChartData((prevData) => {
				let newData = [] as memChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, mem, swap },
						{ timeStamp: timestamp, mem, swap },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, mem, swap }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, mem, swap, period]);

	const chartConfig = {
		mem: {
			label: "Mem",
		},
		swap: {
			label: "Swap",
		},
	} satisfies ChartConfig;

	const displayData = period === "realtime" ? memChartData : memHistoricalData;
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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isMemLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
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

function DiskChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [diskChartData, setDiskChartData] = useState([] as diskChartData[]);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

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

	const { displayData: diskHistoricalData, isLoading } =
		useHistoricalData<diskChartData>(
			data.id,
			"disk",
			period,
			transformDiskData,
		);

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { disk } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						disk,
					};
				})
				.filter((item): item is diskChartData => item !== null)
				.reverse();

			setDiskChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setDiskChartData((prevData) => {
				let newData = [] as diskChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, disk },
						{ timeStamp: timestamp, disk },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, disk }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, disk, period]);

	const chartConfig = {
		disk: {
			label: "Disk",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? diskChartData : diskHistoricalData;

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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isLoading ? (
							<ChartSkeleton />
						) : (
							<AreaChart
								syncId="serverDetailCharts"
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

function NetworkChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const { t } = useTranslation();
	const [networkChartData, setNetworkChartData] = useState(
		[] as networkChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

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

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { up, down } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						upload: up,
						download: down,
					};
				})
				.filter((item): item is networkChartData => item !== null)
				.reverse();

			setNetworkChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setNetworkChartData((prevData) => {
				let newData = [] as networkChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, upload: up, download: down },
						{ timeStamp: timestamp, upload: up, download: down },
					];
				} else {
					newData = [
						...prevData,
						{ timeStamp: timestamp, upload: up, download: down },
					];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, down, up, period]);

	const displayData =
		period === "realtime" ? networkChartData : networkHistoricalData;
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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isNetworkLoading ? (
							<ChartSkeleton />
						) : (
							<LineChart
								syncId="serverDetailCharts"
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

function ConnectChart({
	now,
	data,
	messageHistory,
	period,
}: {
	now: number;
	data: NezhaServer;
	messageHistory: NezhaWebsocketResponse[];
	period: ChartPeriod;
}) {
	const [connectChartData, setConnectChartData] = useState(
		[] as connectChartData[],
	);
	const hasInitialized = useRef(false);
	const [historyLoaded, setHistoryLoaded] = useState(false);

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

	// Reset when switching to realtime
	useEffect(() => {
		if (period === "realtime") {
			hasInitialized.current = false;
			setHistoryLoaded(false);
		}
	}, [period]);

	// 初始化历史数据
	useEffect(() => {
		if (period === "realtime" && !hasInitialized.current) {
			const historyData = messageHistory
				.map((wsData) => {
					const server = wsData.servers.find((s) => s.id === data.id);
					if (!server) return null;
					const { tcp, udp } = selectServerMetrics(wsData.now, server);
					return {
						timeStamp: wsData.now.toString(),
						tcp,
						udp,
					};
				})
				.filter((item): item is connectChartData => item !== null)
				.reverse();

			setConnectChartData(historyData);
			hasInitialized.current = true;
			setHistoryLoaded(true);
		}
	}, [messageHistory, data.id, period]);

	// 修改实时数据更新逻辑
	useEffect(() => {
		if (data && historyLoaded && period === "realtime") {
			const timestamp = now.toString();
			setConnectChartData((prevData) => {
				let newData = [] as connectChartData[];
				if (prevData.length === 0) {
					newData = [
						{ timeStamp: timestamp, tcp, udp },
						{ timeStamp: timestamp, tcp, udp },
					];
				} else {
					newData = [...prevData, { timeStamp: timestamp, tcp, udp }];
					if (newData.length > 30) {
						newData.shift();
					}
				}
				return newData;
			});
		}
	}, [now, data, historyLoaded, tcp, udp, period]);

	const chartConfig = {
		tcp: {
			label: "TCP",
		},
		udp: {
			label: "UDP",
		},
	} satisfies ChartConfig;

	const displayData =
		period === "realtime" ? connectChartData : connectHistoricalData;
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
					<ChartContainer
						config={chartConfig}
						className="aspect-auto h-[130px] w-full"
					>
						{isConnectLoading ? (
							<ChartSkeleton />
						) : (
							<LineChart
								syncId="serverDetailCharts"
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
