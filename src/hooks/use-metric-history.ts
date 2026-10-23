import { useQueries } from "@tanstack/react-query";
import { fetchServerMetrics } from "@/lib/nezha-api";
import type { MetricPeriod, MetricType } from "@/types/nezha-api";

export type ChartPeriod = "realtime" | MetricPeriod;
export type MetricPoint = { ts: number; value: number };
export type HistoryStatus = "idle" | "pending" | "error" | "success";

/** Each series is cached independently; paired charts only expose complete results. */
export function useMetricHistory(
	serverId: number,
	metrics: readonly MetricType[],
	period: ChartPeriod,
) {
	const queries = useQueries({
		queries: metrics.map((metric) => ({
			queryKey: ["server-metrics", serverId, metric, period],
			enabled: period !== "realtime",
			retry: false,
			staleTime: 30_000,
			queryFn: async ({ signal }: { signal: AbortSignal }) => {
				if (period === "realtime") return [] as MetricPoint[];
				const response = await fetchServerMetrics(serverId, metric, period, {
					signal,
				});
				if (!response.success || !Array.isArray(response.data?.data_points)) {
					throw new Error(`Invalid ${metric} metrics response`);
				}
				return response.data.data_points;
			},
		})),
	});
	const error = queries.find((query) => query.isError)?.error ?? null;
	const status: HistoryStatus =
		period === "realtime"
			? "idle"
			: error
				? "error"
				: queries.some((query) => query.isPending)
					? "pending"
					: "success";
	return {
		status,
		error,
		dataPeriod: status === "success" ? period : null,
		data: status === "success" ? queries.map((query) => query.data ?? []) : [],
		isLoading: status === "pending",
	};
}

export function useHistoricalData<T>(
	serverId: number,
	metric: MetricType,
	period: ChartPeriod,
	transform: (timestamp: number, value: number) => T,
) {
	const history = useMetricHistory(serverId, [metric], period);
	const displayData = (history.data[0] ?? []).map((point) =>
		transform(point.ts, point.value),
	);
	return { ...history, displayData };
}

/** Preserve primary-series order and align the second metric by server timestamp. */
export function combineMetricHistory<T>(
	data: MetricPoint[][],
	transform: (timestamp: number, primary: number, secondary: number) => T,
): T[] {
	if (data.length !== 2) return [];
	const secondary = new Map(data[1].map((point) => [point.ts, point.value]));
	return data[0].map((point) =>
		transform(point.ts, point.value, secondary.get(point.ts) ?? 0),
	);
}
