import { describe, expect, it, vi } from "vitest";
import {
	buildMonitorSeries,
	calculatePacketLoss,
} from "@/features/network-monitor/monitor-series";
import type { NezhaMonitor } from "@/types/nezha-api";

function monitor(overrides: Partial<NezhaMonitor> = {}): NezhaMonitor {
	return {
		monitor_id: 1,
		monitor_name: "Alpha",
		server_id: 7,
		server_name: "edge-chart",
		created_at: [10, 20],
		avg_delay: [1, 2],
		packet_loss: [0, 1],
		...overrides,
	};
}

describe("buildMonitorSeries", () => {
	it("sorts the timestamp union, preserves zero/null values and fills only gaps with null", () => {
		const result = buildMonitorSeries([
			monitor({
				created_at: [30, 10],
				avg_delay: [null, 0],
				packet_loss: [null, 0],
			}),
			monitor({
				monitor_id: 2,
				monitor_name: "Beta",
				created_at: [20, 30],
				avg_delay: [5, 6],
			}),
		]);
		expect(result.formattedData).toEqual([
			{
				created_at: 10,
				Alpha: 0,
				Alpha_packet_loss: 0,
				Beta: null,
				Beta_packet_loss: null,
			},
			{
				created_at: 20,
				Alpha: null,
				Alpha_packet_loss: null,
				Beta: 5,
				Beta_packet_loss: 0,
			},
			{
				created_at: 30,
				Alpha: null,
				Alpha_packet_loss: null,
				Beta: 6,
				Beta_packet_loss: 1,
			},
		]);
		expect(result.chartData.Alpha.map((sample) => sample.created_at)).toEqual([
			30, 10,
		]);
	});

	it("keeps the first duplicate timestamp, including zero or missing entries", () => {
		const result = buildMonitorSeries([
			monitor({
				created_at: [20, 10, 10, 30, 30],
				avg_delay: [2, 0, 99],
				packet_loss: [1, 0, 99],
			}),
		]);
		expect(result.formattedData).toEqual([
			{ created_at: 10, Alpha: 0, Alpha_packet_loss: 0 },
			{ created_at: 20, Alpha: 2, Alpha_packet_loss: 1 },
			{ created_at: 30, Alpha: undefined, Alpha_packet_loss: undefined },
		]);
		expect(result.chartData.Alpha).toHaveLength(5);
	});

	it("preserves the last duplicate-name row overwrite, including its gaps", () => {
		const result = buildMonitorSeries([
			monitor(),
			monitor({
				monitor_id: 2,
				created_at: [20, 30],
				avg_delay: [0, 3],
				packet_loss: [0, 4],
			}),
		]);
		expect(result.formattedData).toEqual([
			{ created_at: 10, Alpha: null, Alpha_packet_loss: null },
			{ created_at: 20, Alpha: 0, Alpha_packet_loss: 0 },
			{ created_at: 30, Alpha: 3, Alpha_packet_loss: 4 },
		]);
		expect(result.chartData.Alpha.map((sample) => sample.avg_delay)).toEqual([
			1, 2, 0, 3,
		]);
		expect(result.chartDataKey).toEqual(["Alpha"]);
	});

	it("uses provided packet loss even when empty, otherwise derives it once", () => {
		const result = buildMonitorSeries([
			monitor({ packet_loss: [], avg_delay: [0, 10] }),
			monitor({
				monitor_name: "Derived",
				packet_loss: undefined,
				avg_delay: [0, 10],
			}),
		]);
		expect(result.formattedData[0].Alpha_packet_loss).toBeUndefined();
		expect(result.formattedData[0].Derived_packet_loss).toBe(100);
		expect(result.formattedData[1].Derived_packet_loss).toBe(70);
		expect(result.chartData.Derived[1].packet_loss).toBe(70);
	});

	it("handles no monitors and monitors without samples", () => {
		expect(buildMonitorSeries([])).toEqual({
			chartData: {},
			formattedData: [],
			chartDataKey: [],
		});
		const result = buildMonitorSeries([
			monitor({ created_at: [], avg_delay: [], packet_loss: [] }),
		]);
		expect(result).toEqual({
			chartData: { Alpha: [] },
			formattedData: [],
			chartDataKey: ["Alpha"],
		});
	});

	it("orders names by last display index descending, then monitor id ascending", () => {
		const result = buildMonitorSeries([
			monitor({ monitor_id: 4, monitor_name: "Delta", display_index: 2 }),
			monitor({ monitor_id: 1, monitor_name: "Alpha", display_index: 2 }),
			monitor({ monitor_id: 3, monitor_name: "Gamma" }),
			monitor({ monitor_id: 2, monitor_name: "Beta", display_index: -1 }),
		]);
		expect(result.chartDataKey).toEqual(["Alpha", "Delta", "Gamma", "Beta"]);
	});

	it("does not mutate input arrays or scan them with indexOf", () => {
		const data = [monitor({ created_at: [20, 10, 20] })];
		const before = structuredClone(data);
		const scans = vi.spyOn(data[0].created_at, "indexOf");
		Object.freeze(data[0].avg_delay);
		Object.freeze(data[0].packet_loss);
		buildMonitorSeries(data);
		expect(scans).not.toHaveBeenCalled();
		scans.mockRestore();
		expect(data).toEqual(before);
	});

	it("matches the previous merge across deterministic sparse and duplicate-heavy responses", () => {
		let seed = 42;
		const random = (max: number) => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed % max;
		};
		for (let fixture = 0; fixture < 100; fixture++) {
			const monitors = Array.from({ length: 1 + random(5) }, (_, id) =>
				monitor({
					monitor_id: id,
					monitor_name: `Monitor ${random(3)}`,
					created_at: Array.from({ length: random(15) }, () => random(12) * 10),
					avg_delay: Array.from({ length: random(15) }, () =>
						random(3) === 0 ? null : random(6),
					),
					packet_loss:
						random(2) === 0
							? undefined
							: Array.from({ length: random(15) }, () =>
									random(3) === 0 ? null : random(6),
								),
				}),
			);
			const allTimes = [
				...new Set(monitors.flatMap((item) => item.created_at)),
			].sort((a, b) => a - b);
			const expected = allTimes.map((created_at) => {
				const point: Record<string, number | null | undefined> = { created_at };
				for (const item of monitors) {
					const index = item.created_at.indexOf(created_at);
					const packetLoss =
						item.packet_loss || calculatePacketLoss(item.avg_delay);
					point[item.monitor_name] =
						index === -1 ? null : item.avg_delay[index];
					point[`${item.monitor_name}_packet_loss`] =
						index === -1 ? null : packetLoss[index];
				}
				return point;
			});
			expect(buildMonitorSeries(monitors).formattedData).toEqual(expected);
		}
	});

	it("merges a large sparse response using indexed timestamp lookups", () => {
		const monitors = Array.from({ length: 8 }, (_, id) =>
			monitor({
				monitor_id: id,
				monitor_name: `Monitor ${id}`,
				created_at: Array.from(
					{ length: 2_000 },
					(_, index) => index * 10 + id,
				),
				avg_delay: Array.from({ length: 2_000 }, (_, index) => index),
				packet_loss: [],
			}),
		);
		const scans = monitors.map((item) => vi.spyOn(item.created_at, "indexOf"));
		const result = buildMonitorSeries(monitors);
		expect(result.formattedData).toHaveLength(16_000);
		expect(result.formattedData[0]["Monitor 0"]).toBe(0);
		expect(result.formattedData[0]["Monitor 1"]).toBeNull();
		expect(
			result.formattedData[result.formattedData.length - 1]["Monitor 7"],
		).toBe(1_999);
		for (const scan of scans) expect(scan).not.toHaveBeenCalled();
	});
});

describe("calculatePacketLoss", () => {
	it("keeps the existing timeout, smoothing and missing-value behavior", () => {
		expect(calculatePacketLoss([])).toEqual([]);
		expect(calculatePacketLoss([0, null, undefined, 10])).toEqual([
			100, 100, 100, 70,
		]);
		expect(calculatePacketLoss([10_000])).toEqual([60]);
		expect(calculatePacketLoss([4_000])).toEqual([5]);
	});
});
