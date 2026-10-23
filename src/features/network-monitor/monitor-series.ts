import type { NezhaMonitor, ServerMonitorChart } from "@/types/nezha-api";

export interface MonitorChartPoint {
	created_at: number;
	[key: string]: number | null | undefined;
}

/**
 * Helper method to calculate packet loss from delay data
 */
export const calculatePacketLoss = (
	delays: readonly (number | null | undefined)[],
): number[] => {
	if (!delays || delays.length === 0) return [];

	const packetLossRates: number[] = [];
	const windowSize = Math.min(10, Math.max(3, Math.floor(delays.length / 10)));
	const timeoutThreshold = 3000;
	const extremeDelayThreshold = 10000;

	for (let i = 0; i < delays.length; i++) {
		const currentDelay = delays[i];
		let lossRate = 0;

		if (
			currentDelay === 0 ||
			currentDelay === null ||
			currentDelay === undefined
		) {
			lossRate = 100;
		} else if (currentDelay >= extremeDelayThreshold) {
			lossRate = Math.min(
				95,
				60 + (currentDelay - extremeDelayThreshold) / 1000,
			);
		} else if (currentDelay >= timeoutThreshold) {
			lossRate = Math.min(50, (currentDelay - timeoutThreshold) / 200);
		} else {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(delays.length, i + Math.ceil(windowSize / 2));
			const windowDelays = delays
				.slice(start, end)
				.filter((delay): delay is number => delay != null && delay > 0);

			if (windowDelays.length > 2) {
				const mean =
					windowDelays.reduce((sum, d) => sum + d, 0) / windowDelays.length;
				const variance =
					windowDelays.reduce((sum, d) => sum + (d - mean) ** 2, 0) /
					windowDelays.length;
				const standardDeviation = Math.sqrt(variance);
				const coefficientOfVariation = standardDeviation / mean;

				if (coefficientOfVariation > 0.8) {
					lossRate = Math.min(25, coefficientOfVariation * 15);
				} else if (coefficientOfVariation > 0.5) {
					lossRate = Math.min(10, coefficientOfVariation * 8);
				} else if (coefficientOfVariation > 0.3) {
					lossRate = Math.min(5, coefficientOfVariation * 5);
				}

				if (currentDelay > mean * 2.5) {
					lossRate += Math.min(15, (currentDelay / mean - 2.5) * 10);
				}
			}
		}

		if (i > 0) {
			const alpha = 0.3;
			lossRate = alpha * lossRate + (1 - alpha) * packetLossRates[i - 1];
		}

		packetLossRates.push(Math.max(0, Math.min(100, lossRate)));
	}

	return packetLossRates.map((rate) => Number(rate.toFixed(2)));
};

/**
 * Prepare both views once per response. Each monitor's timestamp index keeps the
 * first duplicate, matching the previous indexOf merge. Later rows with the same
 * name overwrite every merged timestamp, including gaps; the individual view
 * keeps all samples in response order.
 *
 * For N input samples, M monitors and U unique times: O(N + U log U + M * U).
 * Missing timestamps are null, missing parallel-array entries stay undefined,
 * and explicit zero/null values are preserved without interpolation.
 */
export function buildMonitorSeries(rawData: readonly NezhaMonitor[]) {
	const chartData: ServerMonitorChart = Object.create(null);
	const allTimes = new Set<number>();
	const monitorInfoByName = new Map<
		string,
		{ id: number; displayIndex: number | undefined }
	>();
	const indexedMonitors = rawData.map((item) => {
		const firstIndexByTime = new Map<number, number>();
		const packetLoss = item.packet_loss || calculatePacketLoss(item.avg_delay);
		chartData[item.monitor_name] ??= [];
		const samples = chartData[item.monitor_name];
		monitorInfoByName.set(item.monitor_name, {
			id: item.monitor_id,
			displayIndex: item.display_index,
		});

		item.created_at.forEach((time, index) => {
			allTimes.add(time);
			if (!firstIndexByTime.has(time)) firstIndexByTime.set(time, index);
			samples.push({
				created_at: time,
				avg_delay: item.avg_delay[index],
				packet_loss: packetLoss[index],
			});
		});

		return { item, firstIndexByTime, packetLoss };
	});

	const formattedData = Array.from(allTimes)
		.sort((a, b) => a - b)
		.map((time) => {
			const point: MonitorChartPoint = { created_at: time };
			for (const { item, firstIndexByTime, packetLoss } of indexedMonitors) {
				const index = firstIndexByTime.get(time);
				point[item.monitor_name] =
					index === undefined ? null : item.avg_delay[index];
				point[`${item.monitor_name}_packet_loss`] =
					index === undefined ? null : packetLoss[index];
			}
			return point;
		});

	const chartDataKey = Object.keys(chartData).sort((a, b) => {
		const aInfo = monitorInfoByName.get(a);
		const bInfo = monitorInfoByName.get(b);
		if (!aInfo && !bInfo) return a.localeCompare(b);
		if (!aInfo) return 1;
		if (!bInfo) return -1;
		const indexDiff = (bInfo.displayIndex ?? 0) - (aInfo.displayIndex ?? 0);
		return indexDiff || aInfo.id - bInfo.id;
	});

	return { chartData, formattedData, chartDataKey };
}
