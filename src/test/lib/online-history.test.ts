import { describe, expect, it } from "vitest";
import {
	buildDailyOnlineRows,
	buildDaySegments,
	buildDayWindow,
	buildOfflineGroups,
	dailyOnlineRate,
	formatPeriodMoment,
	groupOnlinePeriods,
	groupOnlineRows,
	panelDay,
	panelNextDayStart,
} from "@/lib/online-history";
import type { DailyOnlineStat, OnlinePeriod } from "@/types/nezha-api";

function daily(date: string, onlineSeconds: number): DailyOnlineStat {
	return { date, online_seconds: onlineSeconds };
}

function period(start: string, end: string, ongoing = false): OnlinePeriod {
	return { start, end, ongoing };
}

function expectChipsInsideTheirDay(
	groups: ReturnType<typeof buildOfflineGroups>,
) {
	for (const group of groups) {
		const dayStart = panelDay(group.date, "UTC");
		const dayEnd = panelNextDayStart(group.date, "UTC");
		for (const chip of group.chips) {
			expect(chip.start.valueOf()).toBeGreaterThanOrEqual(dayStart.valueOf());
			expect(chip.end.valueOf()).toBeLessThanOrEqual(dayEnd.valueOf());
			expect(chip.end.valueOf()).toBeGreaterThan(chip.start.valueOf());
		}
		for (let index = 1; index < group.chips.length; index += 1) {
			expect(group.chips[index].start.valueOf()).toBeGreaterThanOrEqual(
				group.chips[index - 1].end.valueOf(),
			);
		}
	}
}

describe("buildOfflineGroups", () => {
	it("never lets a gap run into a later day's online segment", () => {
		const groups = buildOfflineGroups(
			[
				period("2026-10-02T10:00:00.000Z", "2026-10-02T12:00:00.000Z"),
				period("2026-10-03T10:00:00.000Z", "2026-10-03T12:00:00.000Z"),
			],
			[
				daily("2026-10-01", 0),
				daily("2026-10-02", 7200),
				daily("2026-10-03", 7200),
			],
			"2026-10-01T00:00:00.000Z",
			"2026-10-04T00:00:00.000Z",
			true,
			"UTC",
		);

		expect(groups).toHaveLength(3);
		expectChipsInsideTheirDay(groups);

		// 10-01 没有在线段：应是一整段 00:00–24:00，而不是跨到 10-02 10:00
		const oldest = groups[2];
		expect(oldest.date).toBe("2026-10-01");
		expect(oldest.chips).toHaveLength(1);
		expect(oldest.chips[0].start.format("HH:mm")).toBe("00:00");
		expect(oldest.chips[0].end.format("HH:mm")).toBe("00:00");
		expect(oldest.chips[0].end.diff(oldest.chips[0].start, "hour")).toBe(24);
		expect(oldest.total).toBe(86400);

		// 10-02 / 10-03 各自只有 00:00–10:00 与 12:00–24:00 两段
		for (const group of [groups[1], groups[0]]) {
			expect(group.chips).toHaveLength(2);
			expect(group.total).toBe(86400 - 7200);
		}
	});

	it("starts the first day at window_start and ends the last day at window_end", () => {
		const groups = buildOfflineGroups(
			[period("2026-10-02T07:00:00.000Z", "2026-10-02T08:00:00.000Z")],
			[daily("2026-10-02", 3600), daily("2026-10-03", 0)],
			"2026-10-02T06:00:00.000Z",
			"2026-10-03T12:00:00.000Z",
			false,
			"UTC",
		);

		expectChipsInsideTheirDay(groups);

		const first = groups[1];
		expect(first.date).toBe("2026-10-02");
		// 窗口从 06:00 开始，不能凭空生成 00:00–06:00 的离线
		expect(first.chips[0].start.format("HH:mm")).toBe("06:00");
		expect(first.chips[0].end.format("HH:mm")).toBe("07:00");
		// 18h 窗口 − 1h 在线 = 17h
		expect(first.total).toBe(17 * 3600);

		const last = groups[0];
		expect(last.date).toBe("2026-10-03");
		expect(last.chips).toHaveLength(1);
		expect(last.chips[0].start.format("HH:mm")).toBe("00:00");
		expect(last.chips[0].end.format("HH:mm")).toBe("12:00");
		expect(last.total).toBe(12 * 3600);
		// 服务器当前离线，且末段确实结束于窗口末端 → 标记进行中
		expect(last.chips[0].ongoing).toBe(true);
	});

	it("does not mark an old day's last gap as ongoing", () => {
		const groups = buildOfflineGroups(
			[],
			[daily("2026-10-02", 0)],
			"2026-10-02T00:00:00.000Z",
			"2026-10-02T12:00:00.000Z",
			false,
			"UTC",
		);

		// 窗口在当天中午结束，末段确实持续到窗口末端
		expect(groups[0].chips[groups[0].chips.length - 1]?.ongoing).toBe(true);
	});
});

describe("groupOnlinePeriods", () => {
	it("splits cross-midnight sessions into the same segments as the daily timeline", () => {
		const periods = [
			period("2026-10-19T22:00:00.000Z", "2026-10-20T03:00:00.000Z", true),
		];
		const groups = groupOnlinePeriods(periods, "UTC");
		expect(groups.map((g) => [g.date, g.total])).toEqual([
			["2026-10-20", 10800],
			["2026-10-19", 7200],
		]);
		for (const group of groups) {
			const segments = buildDaySegments(periods, group.date, "UTC");
			expect(group.total).toBe(
				segments.reduce(
					(sum, s) => sum + s.segEnd.diff(s.segStart, "second"),
					0,
				),
			);
			expect(group.chips[0].original).toEqual(periods[0]);
		}
		expect(groups[0].chips[0].ongoing).toBe(true);
		expect(groups[1].chips[0].ongoing).toBe(false);
	});

	it("clips both timeline and chips to the actual query window", () => {
		const periods = [
			period("2026-10-19T22:00:00.000Z", "2026-10-21T03:00:00.000Z", true),
		];
		const start = "2026-10-20T06:00:00.000Z",
			end = "2026-10-20T12:00:00.000Z";
		const [group] = groupOnlinePeriods(periods, "UTC", start, end);
		expect(group.total).toBe(21600);
		expect(group.chips[0].start.toISOString()).toBe(start);
		expect(group.chips[0].end.toISOString()).toBe(end);
		expect(group.chips[0].ongoing).toBe(false);
		const [segment] = buildDaySegments(periods, group.date, "UTC", start, end);
		expect(segment.leftPct).toBe(25);
		expect(segment.widthPct).toBe(25);
	});
});

describe("buildDayWindow", () => {
	it("distinguishes excluded hours from a partially observed day", () => {
		const window = buildDayWindow(
			"2026-10-20",
			"2026-10-20T06:00:00Z",
			"2026-10-20T12:00:00Z",
			"UTC",
		);
		expect(window.leftPct).toBe(25);
		expect(window.rightPct).toBe(50);
		expect(window.seconds).toBe(21600);
		expect(dailyOnlineRate(21600, window.seconds)).toBe(100);
		expect(dailyOnlineRate(0, 0)).toBe(0);
	});
	it.each([
		["2026-03-08", "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z", 23],
		["2026-11-01", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z", 25],
	])("uses actual elapsed time across DST on %s", (date, start, end, hours) => {
		const window = buildDayWindow(date, start, end, "America/New_York");
		expect(window.seconds).toBe(Number(hours) * 3600);
		expect(window.leftPct).toBe(0);
		expect(window.rightPct).toBe(100);
		expect(dailyOnlineRate(window.seconds, window.seconds)).toBe(100);
	});
});

describe("formatPeriodMoment", () => {
	it("renders a segment ending at the next midnight as 24:00", () => {
		const day = panelDay("2026-10-01", "UTC");
		expect(
			formatPeriodMoment(panelNextDayStart("2026-10-01", "UTC"), day, "UTC"),
		).toBe("24:00");
		expect(
			formatPeriodMoment(
				panelNextDayStart("2026-10-01", "UTC"),
				day,
				"UTC",
				true,
			),
		).toBe("24:00:00");
		expect(
			formatPeriodMoment(
				panelDay("2026-10-01T23:00:00.000Z", "UTC"),
				day,
				"UTC",
			),
		).toBe("23:00");
	});
});

describe("buildDaySegments", () => {
	it.each([
		["2026-11-01T05:45:00.000Z", "2026-11-01T06:15:00.000Z", 1800],
		["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z", 3600],
	])("retains positive elapsed time when fall-back reverses or repeats the wall clock (%s)", (start, end, seconds) => {
		const periods = [period(start, end, true)];
		const segments = buildDaySegments(
			periods,
			"2026-11-01",
			"America/New_York",
		);
		expect(segments).toHaveLength(1);
		expect(segments[0].segStart.toISOString()).toBe(start);
		expect(segments[0].segEnd.toISOString()).toBe(end);
		expect(segments[0].elapsedSeconds).toBe(seconds);
		expect(segments[0].widthPct).toBe(0);
		expect(segments[0].live).toBe(true);

		const [group] = groupOnlinePeriods(periods, "America/New_York");
		expect(group.total).toBe(seconds);
		expect(group.chips).toHaveLength(1);
		expect(group.chips[0].original).toEqual(periods[0]);
		expect(group.chips[0].ongoing).toBe(true);
	});

	it("clips real intervals at the query window even when its wall clock runs backwards", () => {
		const periods = [
			period("2026-11-01T05:00:00.000Z", "2026-11-01T07:00:00.000Z", true),
		];
		const start = "2026-11-01T05:45:00.000Z";
		const end = "2026-11-01T06:15:00.000Z";
		const [segment] = buildDaySegments(
			periods,
			"2026-11-01",
			"America/New_York",
			start,
			end,
		);
		expect(segment.segStart.toISOString()).toBe(start);
		expect(segment.segEnd.toISOString()).toBe(end);
		expect(segment.elapsedSeconds).toBe(1800);
		expect(segment.widthPct).toBe(0);
		expect(segment.live).toBe(false);
	});

	it("still rejects reversed and zero-length real intervals", () => {
		expect(
			buildDaySegments(
				[
					period("2026-11-01T06:15:00.000Z", "2026-11-01T05:45:00.000Z"),
					period("2026-11-01T06:15:00.000Z", "2026-11-01T06:15:00.000Z"),
				],
				"2026-11-01",
				"UTC",
			),
		).toEqual([]);
	});

	it("maps positions by panel wall clock on a spring-forward day", () => {
		const tz = "America/New_York";
		const [fullDay] = buildDaySegments(
			[period("2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z")],
			"2026-03-08",
			tz,
		);
		// 00:00 EST → 次日 00:00 EDT，全天应铺满 0–100%
		expect(fullDay.leftPct).toBe(0);
		expect(fullDay.widthPct).toBe(100);

		const [noon] = buildDaySegments(
			[period("2026-03-08T16:00:00.000Z", "2026-03-08T18:00:00.000Z")],
			"2026-03-08",
			tz,
		);
		// 12:00 EDT 必须落在 50%，而不是 elapsed 11h 的 45.8%
		expect(noon.leftPct).toBeCloseTo(50, 5);
		expect(noon.widthPct).toBeCloseTo((2 / 24) * 100, 5);

		const [evening] = buildDaySegments(
			[period("2026-03-09T02:00:00.000Z", "2026-03-09T04:00:00.000Z")],
			"2026-03-08",
			tz,
		);
		// 22:00 EST → 日界 00:00 EDT：日界必须用挂钟零点，不能加 24h
		expect(evening.leftPct).toBeCloseTo((22 / 24) * 100, 5);
		expect(evening.widthPct).toBeCloseTo((2 / 24) * 100, 5);
	});

	it("keeps a full day at 100% on a fall-back day", () => {
		const [fullDay] = buildDaySegments(
			[period("2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z")],
			"2026-11-01",
			"America/New_York",
		);
		expect(fullDay.leftPct).toBe(0);
		expect(fullDay.widthPct).toBe(100);
		expect(fullDay.elapsedSeconds).toBe(25 * 3600);
	});

	it("marks only the segment ending at the live session end as ongoing", () => {
		const periods = [
			period("2026-10-01T22:00:00.000Z", "2026-10-02T06:00:00.000Z", true),
		];
		const [previousDay] = buildDaySegments(periods, "2026-10-01", "UTC");
		const [currentDay] = buildDaySegments(periods, "2026-10-02", "UTC");

		// 前一天被日界裁剪，不能显示为 Ongoing
		expect(previousDay.live).toBe(false);
		expect(previousDay.segEnd.format("HH:mm")).toBe("00:00");
		// 当天这一段才真正结束于会话末端
		expect(currentDay.live).toBe(true);
		expect(currentDay.leftPct).toBe(0);
		expect(currentDay.widthPct).toBeCloseTo((6 / 24) * 100, 5);
	});
});

describe("buildDailyOnlineRows", () => {
	it("counts a reversed-clock session once in daily totals and online lists", () => {
		const periods = [
			period("2026-11-01T05:45:00.000Z", "2026-11-01T06:15:00.000Z"),
		];
		const dailyStats = [daily("2026-11-01", 1800)];
		const start = "2026-11-01T04:00:00.000Z";
		const end = "2026-11-02T05:00:00.000Z";
		const tz = "America/New_York";
		const rows = buildDailyOnlineRows(periods, dailyStats, start, end, tz);
		expect(rows[0].online_seconds).toBe(1800);
		expect(rows[0].window.seconds).toBe(25 * 3600);
		expect(rows[0].segments).toHaveLength(1);
		const [online] = groupOnlineRows(rows, tz);
		expect(online.total).toBe(1800);
		expect(online.chips).toHaveLength(1);
		expect(online.chips[0].start.format("HH:mm")).toBe("01:45");
		expect(online.chips[0].end.format("HH:mm")).toBe("01:15");
		const [offline] = buildOfflineGroups(
			periods,
			dailyStats,
			start,
			end,
			false,
			tz,
		);
		expect(offline.total + online.total).toBe(rows[0].window.seconds);
	});
});
