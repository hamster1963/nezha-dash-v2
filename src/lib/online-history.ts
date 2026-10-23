import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { DailyOnlineStat, OnlinePeriod } from "@/types/nezha-api";

dayjs.extend(utc);
dayjs.extend(timezone);

export type PeriodChip = {
	start: dayjs.Dayjs;
	end: dayjs.Dayjs;
	ongoing: boolean;
	original?: OnlinePeriod;
};

export type PeriodDayGroup = {
	date: string;
	day: dayjs.Dayjs;
	total: number;
	chips: PeriodChip[];
};

export type DaySegment = {
	period: OnlinePeriod;
	segStart: dayjs.Dayjs;
	segEnd: dayjs.Dayjs;
	/** 实际经过的秒数，与 DST 回拨时可能为零的挂钟投影宽度无关。 */
	elapsedSeconds: number;
	leftPct: number;
	widthPct: number;
	/** 该段是否仍然进行中（只有结束于真实会话末尾的段才为 true） */
	live: boolean;
};

// 后端按面板时区拆日；响应带 timezone 时前端用同一时区解释时间，
// 保证跨时区访客的时间轴、分组与每日数字一致
export function panelDay(value: string, tz?: string): dayjs.Dayjs {
	// dayjs 的 .tz(input, zone) 解析模式会忽略输入里的显式偏移（Z / ±HH:MM）：
	// 带偏移的时间戳须先按原义解析再换算时区，无偏移的日期串才用 zone 解析
	if (tz) {
		return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
			? dayjs(value).tz(tz)
			: dayjs.tz(value, tz);
	}
	return dayjs(value);
}

export function panelNow(tz?: string): dayjs.Dayjs {
	return tz ? dayjs().tz(tz) : dayjs();
}

// 下一天的日历日期用 UTC 做纯日期运算，避免 dayjs .add(1, "day")
// 在 DST 切换日加的是 24 小时而不是下一个挂钟零点
function nextDate(date: string): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day + 1))
		.toISOString()
		.slice(0, 10);
}

export function panelNextDayStart(date: string, tz?: string): dayjs.Dayjs {
	return panelDay(nextDate(date), tz);
}

// 结束于次日零点的段在 chip 上显示为 24:00，避免出现“00:00 → 00:00”这种读不通的全天段
export function formatPeriodMoment(
	value: dayjs.Dayjs,
	anchor: dayjs.Dayjs,
	tz?: string,
	withSeconds = false,
): string {
	const dayEnd = panelNextDayStart(anchor.format("YYYY-MM-DD"), tz);
	if (value.valueOf() === dayEnd.valueOf()) {
		return withSeconds ? "24:00:00" : "24:00";
	}
	return value.format(withSeconds ? "HH:mm:ss" : "HH:mm");
}

export function formatDuration(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) {
		return `${d}d ${h}h ${m}m`;
	}
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m}m`;
}

// 时间轴刻度是固定的挂钟 0:00–24:00，定位必须用面板时区的挂钟时间；
// 用 elapsed seconds / 86400 会在 DST 切换日（23h/25h）偏移
function wallClockPercent(value: dayjs.Dayjs): number {
	const seconds =
		value.hour() * 3600 +
		value.minute() * 60 +
		value.second() +
		value.millisecond() / 1000;
	return (seconds / 86400) * 100;
}

// 每天实际纳入统计的区间；挂钟坐标用于绘图，秒数用于时长/在线率。
export function buildDayWindow(
	date: string,
	windowStart: string,
	windowEnd: string,
	tz?: string,
) {
	const dayStart = panelDay(date, tz);
	const dayEnd = panelNextDayStart(date, tz);
	const start = panelDay(windowStart, tz);
	const end = panelDay(windowEnd, tz);
	const effectiveStart =
		start.valueOf() > dayStart.valueOf() ? start : dayStart;
	const effectiveEnd = end.valueOf() < dayEnd.valueOf() ? end : dayEnd;
	const percent = (value: dayjs.Dayjs) =>
		value.valueOf() < dayStart.valueOf() ||
		value.valueOf() === dayStart.valueOf()
			? 0
			: value.valueOf() > dayEnd.valueOf() ||
					value.valueOf() === dayEnd.valueOf()
				? 100
				: wallClockPercent(value);
	return {
		dayStart,
		dayEnd,
		start: effectiveStart,
		end: effectiveEnd,
		seconds: Math.max(0, effectiveEnd.diff(effectiveStart, "second")),
		leftPct: percent(effectiveStart),
		rightPct: percent(effectiveEnd),
	};
}

export function dailyOnlineRate(onlineSeconds: number, windowSeconds: number) {
	return windowSeconds > 0
		? Math.max(0, Math.min(100, (onlineSeconds / windowSeconds) * 100))
		: 0;
}

// 每份响应只解析一次时段和窗口边界；后续按天裁剪仅比较时间戳。
function preparePeriods(
	periods: OnlinePeriod[],
	tz?: string,
	windowStart?: string,
	windowEnd?: string,
) {
	const lower = windowStart ? panelDay(windowStart, tz) : null;
	const upper = windowEnd ? panelDay(windowEnd, tz) : null;
	return periods.flatMap((period) => {
		const originalStart = panelDay(period.start, tz);
		const originalEnd = panelDay(period.end, tz);
		const start =
			lower && lower.valueOf() > originalStart.valueOf()
				? lower
				: originalStart;
		const end =
			upper && upper.valueOf() < originalEnd.valueOf() ? upper : originalEnd;
		return start.isValid() && end.isValid() && end.valueOf() > start.valueOf()
			? [
					{
						period,
						start,
						end,
						live: period.ongoing && end.valueOf() === originalEnd.valueOf(),
					},
				]
			: [];
	});
}

function buildParsedDaySegments(
	periods: ReturnType<typeof preparePeriods>,
	dayStart: dayjs.Dayjs,
	dayEnd: dayjs.Dayjs,
): DaySegment[] {
	const lower = dayStart.valueOf(),
		upper = dayEnd.valueOf();
	return periods.flatMap(({ period, start, end, live }) => {
		if (end.valueOf() <= lower || start.valueOf() >= upper) return [];
		const segStart = start.valueOf() > lower ? start : dayStart;
		const segEnd = end.valueOf() < upper ? end : dayEnd;
		const leftPct =
			segStart.valueOf() === lower ? 0 : wallClockPercent(segStart);
		const rightPct =
			segEnd.valueOf() === upper ? 100 : wallClockPercent(segEnd);
		const widthPct = Math.max(0, Math.min(rightPct - leftPct, 100 - leftPct));
		// DST 回拨可能使挂钟终点早于/等于起点，但真实时间区间仍然有效。
		// 保留区间用于统计和列表；时间轴用最小宽度标记不可展开的挂钟投影。
		return [
			{
				period,
				segStart,
				segEnd,
				elapsedSeconds: segEnd.diff(segStart, "second"),
				leftPct,
				widthPct,
				live: live && segEnd.valueOf() === end.valueOf(),
			},
		];
	});
}

export function buildDaySegments(
	periods: OnlinePeriod[],
	date: string,
	tz?: string,
	windowStart?: string,
	windowEnd?: string,
): DaySegment[] {
	return buildParsedDaySegments(
		preparePeriods(periods, tz, windowStart, windowEnd),
		panelDay(date, tz),
		panelNextDayStart(date, tz),
	);
}

// 时间轴、每日总计及在线列表共享这份结果，不再各自遍历并转换整份历史。
export function buildDailyOnlineRows(
	periods: OnlinePeriod[],
	daily: DailyOnlineStat[],
	windowStart: string,
	windowEnd: string,
	tz?: string,
) {
	const prepared = preparePeriods(periods, tz, windowStart, windowEnd);
	return daily.map((day) => {
		const window = buildDayWindow(day.date, windowStart, windowEnd, tz);
		const segments = buildParsedDaySegments(
			prepared,
			window.dayStart,
			window.dayEnd,
		);
		return {
			...day,
			segments,
			window,
			online_seconds: segments.reduce(
				(sum, segment) => sum + segment.elapsedSeconds,
				0,
			),
		};
	});
}

export function groupOnlineRows(
	rows: { date: string; segments: DaySegment[] }[],
	tz?: string,
): PeriodDayGroup[] {
	return rows
		.filter((row) => row.segments.length > 0)
		.map((row) => ({
			date: row.date,
			day: panelDay(row.date, tz),
			chips: row.segments.map((segment) => ({
				start: segment.segStart,
				end: segment.segEnd,
				ongoing: segment.live,
				original: segment.period,
			})),
			total: row.segments.reduce(
				(sum, segment) => sum + segment.elapsedSeconds,
				0,
			),
		}))
		.sort((a, b) => b.date.localeCompare(a.date));
}

// 合并重叠/相邻的时间段，按开始时间排序
export function mergePeriods(
	periods: OnlinePeriod[],
	tz?: string,
): PeriodChip[] {
	const sorted = periods
		.map((period) => ({
			start: panelDay(period.start, tz),
			end: panelDay(period.end, tz),
			ongoing: period.ongoing,
		}))
		.sort((a, b) => a.start.valueOf() - b.start.valueOf());
	const merged: PeriodChip[] = [];
	for (const period of sorted) {
		const last = merged[merged.length - 1];
		if (last && period.start.valueOf() < last.end.valueOf()) {
			if (period.end.valueOf() > last.end.valueOf()) {
				last.end = period.end;
			}
			last.ongoing = last.ongoing || period.ongoing;
		} else {
			merged.push({ ...period });
		}
	}
	return merged;
}

// 独立调用也复用同一预解析/裁剪流程。
export function groupOnlinePeriods(
	periods: OnlinePeriod[],
	tz?: string,
	windowStart?: string,
	windowEnd?: string,
): PeriodDayGroup[] {
	const prepared = preparePeriods(periods, tz, windowStart, windowEnd);
	const dates = new Set<string>();
	for (const { start, end } of prepared) {
		const endDate = end.format("YYYY-MM-DD");
		for (
			let date = start.format("YYYY-MM-DD");
			date <= endDate;
			date = nextDate(date)
		)
			dates.add(date);
	}
	return groupOnlineRows(
		[...dates].map((date) => ({
			date,
			segments: buildParsedDaySegments(
				prepared,
				panelDay(date, tz),
				panelNextDayStart(date, tz),
			),
		})),
		tz,
	);
}

// 离线模式：对窗口内每一天求在线时段的补集。计算区间先与查询窗口取交集，
// 避免在窗口开始前/结束后凭空生成离线段；服务器当前离线时，结束于窗口末端的
// 最新一段标记为进行中。
export function buildOfflineGroups(
	periods: OnlinePeriod[],
	daily: DailyOnlineStat[],
	windowStart: string,
	windowEnd: string,
	currentlyOnline: boolean,
	tz?: string,
): PeriodDayGroup[] {
	const merged = mergePeriods(periods, tz);
	const windowStartTime = panelDay(windowStart, tz);
	const windowEndTime = panelDay(windowEnd, tz);
	const groups = daily
		.map((day) => day.date)
		.sort((a, b) => (a < b ? 1 : -1))
		.flatMap((date): PeriodDayGroup[] => {
			const dayStart = panelDay(date, tz);
			const dayEnd = panelNextDayStart(date, tz);
			// 当天与查询窗口的交集；首日/末日通常不是完整 24 小时
			const effectiveStart =
				dayStart.valueOf() > windowStartTime.valueOf()
					? dayStart
					: windowStartTime;
			const effectiveEnd =
				dayEnd.valueOf() < windowEndTime.valueOf() ? dayEnd : windowEndTime;
			if (!(effectiveEnd.valueOf() > effectiveStart.valueOf())) {
				return [];
			}
			const chips: PeriodChip[] = [];
			let cursor = effectiveStart;
			for (const segment of merged) {
				if (!(segment.end.valueOf() > effectiveStart.valueOf())) {
					continue;
				}
				// merged 按开始时间升序；到达当天区间之后的时段即可停止，
				// 否则会把未来日期的开始时刻当成当天的 gap 终点
				if (!(segment.start.valueOf() < effectiveEnd.valueOf())) {
					break;
				}
				const segStart =
					segment.start.valueOf() > cursor.valueOf() ? segment.start : cursor;
				if (segStart.valueOf() > cursor.valueOf()) {
					chips.push({ start: cursor, end: segStart, ongoing: false });
				}
				const segEnd =
					segment.end.valueOf() < effectiveEnd.valueOf()
						? segment.end
						: effectiveEnd;
				if (segEnd.valueOf() > cursor.valueOf()) {
					cursor = segEnd;
				}
			}
			if (cursor.valueOf() < effectiveEnd.valueOf()) {
				chips.push({ start: cursor, end: effectiveEnd, ongoing: false });
			}
			const total = chips.reduce(
				(sum, chip) => sum + chip.end.diff(chip.start, "second"),
				0,
			);
			return [{ date, day: dayStart, total, chips }];
		})
		.filter((group) => group.chips.length > 0);
	if (!currentlyOnline && groups.length > 0) {
		const newest = groups[0].chips;
		const last = newest[newest.length - 1];
		// 只有真正持续到窗口末端的离线段才是进行中；旧日期的段不能误标
		if (last?.end.isSame(windowEndTime)) {
			last.ongoing = true;
		}
	}
	return groups;
}
