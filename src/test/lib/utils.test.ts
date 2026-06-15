import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fetcher,
	formatNezhaInfo,
	formatRelativeTime,
	formatTime,
	getDaysBetweenDates,
	getDaysBetweenDatesWithAutoRenewal,
	getNextCycleTime,
	handlePublicNote,
	nezhaFetcher,
	parsePublicNote,
} from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

const serverFixture: NezhaServer = {
	id: 1,
	name: "edge",
	public_note: '{"planDataMod":{"bandwidth":"1Gbps"}}',
	last_active: "2025-01-01T00:00:00.000Z",
	country_code: "US",
	host: {
		platform: "linux",
		platform_version: "6.8",
		cpu: ["AMD EPYC"],
		gpu: [],
		mem_total: 200,
		disk_total: 400,
		swap_total: 100,
		arch: "amd64",
		boot_time: 1_735_603_200,
		version: "1.0.0",
	},
	state: {
		cpu: 12,
		mem_used: 50,
		swap_used: 10,
		disk_used: 100,
		net_in_transfer: 1024,
		net_out_transfer: 2048,
		net_in_speed: 1024 * 1024,
		net_out_speed: 2 * 1024 * 1024,
		uptime: 3600,
		load_1: 0.123,
		load_5: 0.456,
		load_15: 0.789,
		tcp_conn_count: 8,
		udp_conn_count: 4,
		process_count: 88,
		temperatures: [],
		gpu: [],
	},
};

describe("date and billing helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-15T00:00:00.000Z"));
	});

	it("calculates the next renewal cycle after the specified date", () => {
		const nextCycle = getNextCycleTime(
			Date.UTC(2025, 0, 1),
			1,
			Date.UTC(2025, 2, 15),
		);

		expect(new Date(nextCycle).toISOString()).toBe("2025-04-01T00:00:00.000Z");
	});

	it("normalizes common cycle labels and remaining package days", () => {
		const result = getDaysBetweenDatesWithAutoRenewal({
			startDate: "2025-01-01T00:00:00.000Z",
			endDate: "2025-01-31T00:00:00.000Z",
			autoRenewal: "0",
			cycle: "monthly",
			amount: "10",
		});

		expect(result.days).toBe(16);
		expect(result.cycleLabel).toBe("月");
		expect(result.remainingPercentage).toBeCloseTo(16 / 30);
	});

	it("handles auto-renewal before and after the current cycle end", () => {
		expect(
			getDaysBetweenDatesWithAutoRenewal({
				startDate: "2025-01-01T00:00:00.000Z",
				endDate: "2025-02-01T00:00:00.000Z",
				autoRenewal: "1",
				cycle: "quarterly",
				amount: "10",
			}),
		).toMatchObject({
			days: 17,
			cycleLabel: "季",
		});

		const renewed = getDaysBetweenDatesWithAutoRenewal({
			startDate: "2024-01-01T00:00:00.000Z",
			endDate: "2024-12-01T00:00:00.000Z",
			autoRenewal: "1",
			cycle: "annual",
			amount: "10",
		});

		expect(renewed.days).toBeGreaterThan(300);
		expect(renewed.cycleLabel).toBe("年");
		expect(renewed.remainingPercentage).toBeLessThanOrEqual(1);
	});

	it("rejects invalid cycle calculations", () => {
		expect(() => getNextCycleTime(Date.UTC(2025, 0, 1), 0, Date.now())).toThrow(
			"参数无效",
		);
	});

	it("formats absolute dates and day differences", () => {
		expect(formatTime(new Date(2025, 0, 2, 3, 4, 5).getTime())).toBe(
			"2025-1-2 03:04:05",
		);
		expect(getDaysBetweenDates("2025-01-20", "2025-01-15")).toBe(5);
	});

	it("formats relative timestamps using compact units", () => {
		expect(formatRelativeTime(Date.now() - 45 * 1000)).toBe("45s");
		expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe("5m");
		expect(formatRelativeTime(Date.now() - 2 * 60 * 60 * 1000)).toBe("2h");
		expect(formatRelativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe("3d");
	});
});

describe("public note helpers", () => {
	it("parses supported public note blocks and defaults missing strings", () => {
		expect(
			parsePublicNote(
				JSON.stringify({
					billingDataMod: {
						endDate: "2025-12-31",
						cycle: "year",
					},
					planDataMod: {
						bandwidth: "1Gbps",
						IPv4: "1",
					},
				}),
			),
		).toEqual({
			billingDataMod: {
				startDate: "",
				endDate: "2025-12-31",
				autoRenewal: "",
				cycle: "year",
				amount: "",
			},
			planDataMod: {
				bandwidth: "1Gbps",
				trafficVol: "",
				trafficType: "",
				IPv4: "1",
				IPv6: "",
				networkRoute: "",
				extra: "",
			},
		});
	});

	it("returns null for invalid public note JSON", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		expect(parsePublicNote("{bad json")).toBeNull();
	});

	it("returns null or partial blocks for empty and single-section public notes", () => {
		expect(parsePublicNote("")).toBeNull();
		expect(parsePublicNote(JSON.stringify({ note: "plain" }))).toBeNull();
		expect(
			parsePublicNote(
				JSON.stringify({
					billingDataMod: {
						endDate: "2025-12-31",
						amount: "20",
					},
				}),
			),
		).toEqual({
			billingDataMod: {
				startDate: "",
				endDate: "2025-12-31",
				autoRenewal: "",
				cycle: "",
				amount: "20",
			},
		});
		expect(
			parsePublicNote(
				JSON.stringify({
					planDataMod: {
						trafficVol: "1TB",
						extra: "Backup",
					},
				}),
			),
		).toEqual({
			planDataMod: {
				bandwidth: "",
				trafficVol: "1TB",
				trafficType: "",
				IPv4: "",
				IPv6: "",
				networkRoute: "",
				extra: "Backup",
			},
		});
	});

	it("falls back to cached notes when websocket payloads are empty", () => {
		expect(handlePublicNote(1, "live note")).toBe("live note");
		expect(handlePublicNote(1, "")).toBe("live note");
		expect(sessionStorage.getItem("server_1_public_note")).toBe("live note");
	});

	it("returns an empty public note when no live or cached note exists", () => {
		expect(handlePublicNote(404, "")).toBe("");
	});
});

describe("nezha data formatting", () => {
	it("maps websocket server state into view-friendly metrics", () => {
		const now = new Date("2025-01-01T00:00:20.000Z").getTime();

		const result = formatNezhaInfo(now, serverFixture);

		expect(result.online).toBe(true);
		expect(result.up).toBe(2);
		expect(result.down).toBe(1);
		expect(result.mem).toBe(25);
		expect(result.swap).toBe(10);
		expect(result.disk).toBe(25);
		expect(result.load_1).toBe("0.12");
		expect(result.public_note).toBe(serverFixture.public_note);
	});

	it("falls back safely for offline timestamps and empty host totals", () => {
		const result = formatNezhaInfo(Date.now(), {
			...serverFixture,
			public_note: "",
			last_active: "0001-01-01T00:00:00.000Z",
			host: {
				...serverFixture.host,
				boot_time: 0,
				mem_total: 0,
				swap_total: 0,
				disk_total: 0,
				version: "",
				cpu: [],
			},
			state: {
				...serverFixture.state,
				cpu: 0,
				mem_used: 0,
				swap_used: 0,
				disk_used: 0,
				net_in_speed: 0,
				net_out_speed: 0,
				process_count: 0,
			},
		});

		expect(result.online).toBe(false);
		expect(result.last_active_time_string).toBe("");
		expect(result.boot_time_string).toBe("");
		expect(result.version).toBeNull();
		expect(result.mem).toBe(0);
		expect(result.swap).toBe(0);
		expect(result.disk).toBe(0);
		expect(result.public_note).toBe("");
	});
});

describe("fetcher", () => {
	it("returns nested data for successful responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ data: { ok: true } }), {
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(fetcher("/api/v1/demo")).resolves.toEqual({ ok: true });
	});

	it("logs and rethrows failed responses", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "bad" }), {
					status: 500,
					statusText: "Server Error",
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(fetcher("/api/v1/demo")).rejects.toThrow("Server Error");
		expect(console.error).toHaveBeenCalled();
	});
});

describe("nezhaFetcher", () => {
	it("returns JSON for successful responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(nezhaFetcher("/api/v1/setting")).resolves.toEqual({
			success: true,
		});
	});

	it("throws status and response info for failed responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: "forbidden" }), {
					status: 403,
					statusText: "Forbidden",
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(nezhaFetcher("/api/v1/setting")).rejects.toMatchObject({
			status: 403,
			info: { error: "forbidden" },
		});
	});
});
