import { type ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import { twMerge } from "tailwind-merge";
import { requestJson } from "@/lib/http";
import { handlePublicNote } from "@/lib/public-note-cache";
import { selectServerMetrics } from "@/lib/server-metrics";

export { handlePublicNote } from "@/lib/public-note-cache";

import type { NezhaServer } from "@/types/nezha-api";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatNezhaInfo(now: number, serverInfo: NezhaServer) {
	return {
		...selectServerMetrics(now, serverInfo),
		public_note: handlePublicNote(serverInfo.id, serverInfo.public_note || ""),
	};
}

export function getDaysBetweenDatesWithAutoRenewal({
	autoRenewal,
	cycle,
	startDate,
	endDate,
}: BillingData): {
	days: number;
	cycleLabel: string;
	remainingPercentage: number;
} {
	let months = 1;
	// 套餐资费
	let cycleLabel = cycle;

	switch (cycle.toLowerCase()) {
		case "月":
		case "m":
		case "mo":
		case "month":
		case "monthly":
			cycleLabel = "月";
			months = 1;
			break;
		case "年":
		case "y":
		case "yr":
		case "year":
		case "annual":
			cycleLabel = "年";
			months = 12;
			break;
		case "季":
		case "q":
		case "qr":
		case "quarterly":
			cycleLabel = "季";
			months = 3;
			break;
		case "半":
		case "半年":
		case "h":
		case "half":
		case "semi-annually":
			cycleLabel = "半年";
			months = 6;
			break;
		default:
			cycleLabel = cycle;
			break;
	}

	const nowTime = Date.now();
	const endTime = dayjs(endDate).valueOf();

	if (autoRenewal !== "1") {
		return {
			days: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()),
			cycleLabel: cycleLabel,
			remainingPercentage:
				getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) /
					dayjs(endDate).diff(startDate, "day") >
				1
					? 1
					: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) /
						dayjs(endDate).diff(startDate, "day"),
		};
	}

	if (nowTime < endTime) {
		return {
			days: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()),
			cycleLabel: cycleLabel,
			remainingPercentage:
				getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) /
					(30 * months) >
				1
					? 1
					: getDaysBetweenDates(endDate, new Date(nowTime).toISOString()) /
						(30 * months),
		};
	}

	const nextTime = getNextCycleTime(endTime, months, nowTime);
	const diff = dayjs(nextTime).diff(dayjs(), "day") + 1;
	const remainingPercentage =
		diff / (30 * months) > 1 ? 1 : diff / (30 * months);

	return {
		days: diff,
		cycleLabel: cycleLabel,
		remainingPercentage: remainingPercentage,
	};
}

// Thanks to hi2shark for the code
// https://github.com/hi2shark/nazhua/blob/main/src/utils/date.js#L86
export function getNextCycleTime(
	startDate: number,
	months: number,
	specifiedDate: number,
): number {
	const start = dayjs(startDate);
	const checkDate = dayjs(specifiedDate);

	if (!start.isValid() || months <= 0) {
		throw new Error("参数无效：请检查起始日期、周期月份数和指定日期。");
	}

	let nextDate = start;

	// 循环增加周期直到大于当前日期
	let whileStatus = true;
	while (whileStatus) {
		nextDate = nextDate.add(months, "month");
		whileStatus = nextDate.valueOf() <= checkDate.valueOf();
	}

	return nextDate.valueOf(); // 返回时间毫秒数
}

export function getDaysBetweenDates(date1: string, date2: string): number {
	const oneDay = 24 * 60 * 60 * 1000; // 一天的毫秒数
	const firstDate = new Date(date1);
	const secondDate = new Date(date2);

	// 计算两个日期之间的天数差异
	return Math.round((firstDate.getTime() - secondDate.getTime()) / oneDay);
}

export const fetcher = async <T = unknown>(url: string): Promise<T> => {
	try {
		const response = await requestJson<{ data: T }>(
			url,
			undefined,
			(response) => response.statusText,
		);
		return response.data;
	} catch (error) {
		console.error(error);
		throw error;
	}
};

export const nezhaFetcher = <T = unknown>(url: string): Promise<T> =>
	requestJson<T>(url, undefined, "An error occurred while fetching the data.");

export function parseISOTimestamp(isoString: string): number {
	return new Date(isoString).getTime();
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((diff % (1000 * 60)) / 1000);

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		return `${days}d`;
	} else if (hours > 0) {
		return `${hours}h`;
	} else if (minutes > 0) {
		return `${minutes}m`;
	} else if (seconds >= 0) {
		return `${seconds}s`;
	}
	return "0s";
}

export function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const seconds = date.getSeconds().toString().padStart(2, "0");
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

interface BillingData {
	startDate: string;
	endDate: string;
	autoRenewal: string;
	cycle: string;
	amount: string;
}

interface PlanData {
	bandwidth: string;
	trafficVol: string;
	trafficType: string;
	IPv4: string;
	IPv6: string;
	networkRoute: string;
	extra: string;
}

export interface PublicNoteData {
	billingDataMod?: BillingData;
	planDataMod?: PlanData;
}

export function parsePublicNote(publicNote: string): PublicNoteData | null {
	try {
		if (!publicNote) {
			return null;
		}
		const data = JSON.parse(publicNote);
		if (!data.billingDataMod && !data.planDataMod) {
			return null;
		}
		if (data.billingDataMod && !data.planDataMod) {
			return {
				billingDataMod: {
					startDate: data.billingDataMod.startDate || "",
					endDate: data.billingDataMod.endDate,
					autoRenewal: data.billingDataMod.autoRenewal || "",
					cycle: data.billingDataMod.cycle || "",
					amount: data.billingDataMod.amount || "",
				},
			};
		}
		if (!data.billingDataMod && data.planDataMod) {
			return {
				planDataMod: {
					bandwidth: data.planDataMod.bandwidth || "",
					trafficVol: data.planDataMod.trafficVol || "",
					trafficType: data.planDataMod.trafficType || "",
					IPv4: data.planDataMod.IPv4 || "",
					IPv6: data.planDataMod.IPv6 || "",
					networkRoute: data.planDataMod.networkRoute || "",
					extra: data.planDataMod.extra || "",
				},
			};
		}

		return {
			billingDataMod: {
				startDate: data.billingDataMod.startDate || "",
				endDate: data.billingDataMod.endDate,
				autoRenewal: data.billingDataMod.autoRenewal || "",
				cycle: data.billingDataMod.cycle || "",
				amount: data.billingDataMod.amount || "",
			},
			planDataMod: {
				bandwidth: data.planDataMod.bandwidth || "",
				trafficVol: data.planDataMod.trafficVol || "",
				trafficType: data.planDataMod.trafficType || "",
				IPv4: data.planDataMod.IPv4 || "",
				IPv6: data.planDataMod.IPv6 || "",
				networkRoute: data.planDataMod.networkRoute || "",
				extra: data.planDataMod.extra || "",
			},
		};
	} catch (error) {
		console.error("Error parsing public note:", error);
		return null;
	}
}
