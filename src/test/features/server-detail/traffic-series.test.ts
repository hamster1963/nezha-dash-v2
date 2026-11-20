import { describe, expect, it } from "vitest";
import {
	buildTrafficSeries,
	getTrafficGranularity,
	getTrafficQueryPeriod,
	getTrafficRangeStart,
} from "@/features/server-detail/traffic-series";

describe("traffic history series", () => {
	it("maps rolling ranges to supported metric periods", () => {
		const now = new Date(2026, 0, 5, 12).getTime();

		expect(getTrafficRangeStart("7d", now)).toBe(now - 7 * 24 * 60 * 60 * 1000);
		expect(getTrafficQueryPeriod("1d", true)).toBe("1d");
		expect(getTrafficQueryPeriod("7d", true)).toBe("7d");
		expect(getTrafficQueryPeriod("30d", true)).toBe("30d");
		expect(getTrafficQueryPeriod("30d", false)).toBe("1d");
		expect(getTrafficGranularity("1d")).toBe("hour");
		expect(getTrafficGranularity("7d")).toBe("day");
		expect(getTrafficGranularity("30d")).toBe("day");
	});

	it("limits the seven-day view to the selected rolling range", () => {
		const now = new Date(2026, 0, 5, 12).getTime();
		const start = getTrafficRangeStart("7d", now);
		const series = buildTrafficSeries(
			[
				{ ts: start - 30 * 60 * 1000, value: 10 },
				{ ts: start + 30 * 60 * 1000, value: 20 },
				{ ts: start + 60 * 60 * 1000, value: 35 },
				{ ts: now + 1, value: 50 },
			],
			[],
			getTrafficGranularity("7d"),
			start,
			now,
		);

		expect(series.reduce((total, point) => total + point.download, 0)).toBe(25);
		expect(series).toHaveLength(8);
	});

	it("sums cumulative counter deltas into local calendar-day buckets", () => {
		const first = new Date(2026, 0, 1, 23).getTime();
		const second = new Date(2026, 0, 2, 1).getTime();
		const third = new Date(2026, 0, 2, 2).getTime();
		const series = buildTrafficSeries(
			[
				{ ts: first, value: 100 },
				{ ts: second, value: 120 },
				{ ts: third, value: 125 },
			],
			[
				{ ts: first, value: 30 },
				{ ts: second, value: 35 },
			],
			"day",
			first,
			third,
		);

		expect(series).toEqual([
			{
				ts: new Date(2026, 0, 1).getTime(),
				download: 0,
				upload: 0,
			},
			{
				ts: new Date(2026, 0, 2).getTime(),
				download: 25,
				upload: 5,
			},
		]);
	});

	it("treats a counter reset as new traffic instead of a negative delta", () => {
		const start = new Date(2026, 0, 1, 10).getTime();
		const series = buildTrafficSeries(
			[
				{ ts: start, value: 500 },
				{ ts: start + 60 * 60 * 1000, value: 540 },
				{ ts: start + 2 * 60 * 60 * 1000, value: 8 },
			],
			[],
			"hour",
			start,
			start + 2 * 60 * 60 * 1000,
		);

		expect(series.map((point) => point.download)).toEqual([0, 40, 8]);
	});
});
