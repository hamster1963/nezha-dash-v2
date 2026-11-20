import type { MetricDataPoint, MetricPeriod } from "@/types/nezha-api";

export type TrafficGranularity = "hour" | "day";
export type TrafficRange = "1d" | "7d" | "30d";

export interface TrafficSeriesPoint {
	ts: number;
	download: number;
	upload: number;
}

interface TrafficBucket {
	download: number;
	upload: number;
}

const TRAFFIC_RANGE_DURATION_MS: Record<TrafficRange, number> = {
	"1d": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000,
};

const METRIC_QUERY_PERIOD: Record<TrafficRange, MetricPeriod> = {
	"1d": "1d",
	"7d": "7d",
	"30d": "30d",
};

export function getTrafficRangeStart(range: TrafficRange, now: number) {
	return now - TRAFFIC_RANGE_DURATION_MS[range];
}

export function getTrafficGranularity(range: TrafficRange): TrafficGranularity {
	return range === "1d" ? "hour" : "day";
}

export function getTrafficQueryPeriod(
	range: TrafficRange,
	isAuthenticated: boolean,
): MetricPeriod {
	return isAuthenticated ? METRIC_QUERY_PERIOD[range] : "1d";
}

function bucketStart(timestamp: number, granularity: TrafficGranularity) {
	const date = new Date(timestamp);
	if (granularity === "day") {
		date.setHours(0, 0, 0, 0);
	} else {
		date.setMinutes(0, 0, 0);
	}
	return date.getTime();
}

function nextBucket(timestamp: number, granularity: TrafficGranularity) {
	const date = new Date(timestamp);
	if (granularity === "day") {
		date.setDate(date.getDate() + 1);
	} else {
		date.setHours(date.getHours() + 1);
	}
	return date.getTime();
}

function accumulateDeltas(
	points: MetricDataPoint[],
	field: keyof TrafficBucket,
	buckets: Map<number, TrafficBucket>,
	granularity: TrafficGranularity,
	start: number,
	end: number,
) {
	const sorted = [...points].sort((a, b) => a.ts - b.ts);
	let previous: number | null = null;

	for (const point of sorted) {
		if (!Number.isFinite(point.ts) || !Number.isFinite(point.value)) {
			previous = null;
			continue;
		}

		if (previous !== null && point.ts >= start && point.ts <= end) {
			const delta =
				point.value >= previous
					? point.value - previous
					: Math.max(0, point.value);
			const key = bucketStart(point.ts, granularity);
			const bucket = buckets.get(key);
			if (bucket) {
				bucket[field] += delta;
			}
		}
		previous = point.value;
	}
}

export function buildTrafficSeries(
	inPoints: MetricDataPoint[],
	outPoints: MetricDataPoint[],
	granularity: TrafficGranularity,
	start: number,
	end: number,
): TrafficSeriesPoint[] {
	if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
		return [];
	}

	const buckets = new Map<number, TrafficBucket>();
	for (
		let timestamp = bucketStart(start, granularity);
		timestamp <= end;
		timestamp = nextBucket(timestamp, granularity)
	) {
		buckets.set(timestamp, { download: 0, upload: 0 });
	}

	accumulateDeltas(inPoints, "download", buckets, granularity, start, end);
	accumulateDeltas(outPoints, "upload", buckets, granularity, start, end);

	return [...buckets.entries()]
		.sort(([a], [b]) => a - b)
		.map(([ts, bucket]) => ({ ts, ...bucket }));
}
