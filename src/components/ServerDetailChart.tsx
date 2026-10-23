import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import LocalErrorBoundary from "@/components/LocalErrorBoundary";
import { ServerDetailChartLoading } from "@/components/loading/ServerDetailLoading";
import { ConnectChart } from "@/features/server-detail/ConnectChart";
import { CpuChart } from "@/features/server-detail/CpuChart";
import { DiskChart } from "@/features/server-detail/DiskChart";
import { GpuChart } from "@/features/server-detail/GpuChart";
import { MemChart } from "@/features/server-detail/MemChart";
import { NetworkChart } from "@/features/server-detail/NetworkChart";
import { PeriodSelector } from "@/features/server-detail/PeriodSelector";
import { ProcessChart } from "@/features/server-detail/ProcessChart";
import { projectRealtimeSeries } from "@/features/server-detail/realtime-series";
import { useLoginUser } from "@/hooks/use-login-user";
import type { ChartPeriod } from "@/hooks/use-metric-history";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchSetting } from "@/lib/nezha-api";
export default function ServerDetailChart({
	server_id,
}: {
	server_id: string;
}) {
	const { t } = useTranslation();
	const { lastData, connected, messageHistory } = useWebSocketContext();
	const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>("realtime");

	const series = useMemo(
		() => projectRealtimeSeries(messageHistory, lastData, Number(server_id)),
		[messageHistory, lastData, server_id],
	);

	// Check if user is logged in
	const { isAuthenticated: isLogin } = useLoginUser();

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
	const chartResetKey = `${server_id}:${selectedPeriod}`;

	return (
		<section className="flex flex-col">
			<PeriodSelector
				selectedPeriod={selectedPeriod}
				onPeriodChange={setSelectedPeriod}
				isLogin={isLogin}
				isTsdbEnabled={isTsdbEnabled}
			/>
			<section className="grid md:grid-cols-2 lg:grid-cols-3 grid-cols-1 gap-3 server-charts">
				<LocalErrorBoundary title="CPU" resetKey={chartResetKey}>
					<CpuChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				{gpuStats.length >= 1 && gpuList.length === gpuStats.length
					? gpuList.map((gpu, index) => (
							<LocalErrorBoundary
								title={`GPU: ${gpu}`}
								resetKey={chartResetKey}
								key={index}
							>
								<GpuChart
									index={index}
									id={server.id}
									gpuStat={gpuStats[index]}
									gpuName={gpu}
									gpuMemory={gpuDetails[index]}
									series={series}
									period={selectedPeriod}
								/>
							</LocalErrorBoundary>
						))
					: gpuStats.length > 0
						? gpuStats.map((gpu, index) => (
								<LocalErrorBoundary
									title={`GPU #${index + 1}`}
									resetKey={chartResetKey}
									key={index}
								>
									<GpuChart
										index={index}
										id={server.id}
										gpuStat={gpu}
										gpuName={`#${index + 1}`}
										gpuMemory={gpuDetails[index]}
										series={series}
										period={selectedPeriod}
									/>
								</LocalErrorBoundary>
							))
						: null}
				<LocalErrorBoundary
					title={t("serverDetailChart.mem")}
					resetKey={chartResetKey}
				>
					<MemChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverDetailChart.disk")}
					resetKey={chartResetKey}
				>
					<DiskChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverDetailChart.process")}
					resetKey={chartResetKey}
				>
					<ProcessChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary
					title={t("serverOverview.network")}
					resetKey={chartResetKey}
				>
					<NetworkChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
				<LocalErrorBoundary title="TCP / UDP" resetKey={chartResetKey}>
					<ConnectChart
						now={nezhaWsData.now}
						data={server}
						series={series}
						period={selectedPeriod}
					/>
				</LocalErrorBoundary>
			</section>
		</section>
	);
}
