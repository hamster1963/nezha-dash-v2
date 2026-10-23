import { describe, expect, it } from "vitest";
import { projectRealtimeSeries } from "@/features/server-detail/realtime-series";
import { createServer } from "@/test/fixtures";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

function frame(now: number, id = 7, cpu = now): NezhaWebsocketResponse {
	return { now, servers: [createServer({ id, state: { cpu } })] };
}

describe("projectRealtimeSeries", () => {
	it("caps latest-first history at 30 unique frames and renders oldest-first", () => {
		const history = Array.from({ length: 40 }, (_, i) => frame(40 - i));
		const series = projectRealtimeSeries(history, frame(41), 7);
		expect(series.cpu).toHaveLength(30);
		expect(series.cpu.map((point) => point.timeStamp)).toEqual(
			Array.from({ length: 30 }, (_, i) => String(12 + i)),
		);
		expect(history[0].now).toBe(40);
	});
	it("keeps zeros and equal values at different timestamps; latest duplicate wins", () => {
		expect(
			projectRealtimeSeries(
				[frame(3, 7, 9), frame(2, 7, 0), frame(2, 7, 99), frame(1, 7, 0)],
				frame(3, 7, 0),
				7,
			).cpu,
		).toEqual([
			{ timeStamp: "1", cpu: 0 },
			{ timeStamp: "2", cpu: 0 },
			{ timeStamp: "3", cpu: 0 },
		]);
	});
	it("does not fill missing servers or mix server IDs, including duplicate frames", () => {
		const history = [frame(3, 8), frame(2, 7), frame(1, 8)];
		expect(projectRealtimeSeries(history, null, 7).cpu).toEqual([
			{ timeStamp: "2", cpu: 2 },
		]);
		expect(projectRealtimeSeries(history, null, 8).cpu).toEqual([
			{ timeStamp: "1", cpu: 1 },
			{ timeStamp: "3", cpu: 3 },
		]);
		expect(projectRealtimeSeries(history, null, 99).cpu).toEqual([]);
		expect(projectRealtimeSeries([frame(4, 7)], frame(4, 8), 7).cpu).toEqual(
			[],
		);
	});
	it("projects every metric with existing percentage, MiB/s, count and GPU-index units", () => {
		const server = createServer({
			id: 7,
			host: { mem_total: 200, swap_total: 100, disk_total: 400 },
			state: {
				cpu: 45,
				gpu: [0, 75],
				mem_used: 80,
				swap_used: 25,
				disk_used: 180,
				process_count: 77,
				net_out_speed: 3 * 1024 ** 2,
				net_in_speed: 4 * 1024 ** 2,
				tcp_conn_count: 18,
				udp_conn_count: 9,
			},
		});
		const series = projectRealtimeSeries(
			[{ now: 1, servers: [createServer({ id: 7, state: { gpu: [20] } })] }],
			{ now: 2, servers: [server] },
			7,
		);
		expect(series.cpu.slice(-1)[0]).toEqual({ timeStamp: "2", cpu: 45 });
		expect(series.mem.slice(-1)[0]).toEqual({
			timeStamp: "2",
			mem: 40,
			swap: 25,
		});
		expect(series.disk.slice(-1)[0]).toEqual({ timeStamp: "2", disk: 45 });
		expect(series.process.slice(-1)[0]).toEqual({
			timeStamp: "2",
			process: 77,
		});
		expect(series.network.slice(-1)[0]).toEqual({
			timeStamp: "2",
			upload: 3,
			download: 4,
		});
		expect(series.connect.slice(-1)[0]).toEqual({
			timeStamp: "2",
			tcp: 18,
			udp: 9,
		});
		expect(series.gpu).toEqual([
			[
				{ timeStamp: "1", gpu: 20 },
				{ timeStamp: "2", gpu: 0 },
			],
			[{ timeStamp: "2", gpu: 75 }],
		]);
	});
	it("handles empty history and missing GPU samples without fabricating points", () => {
		expect(projectRealtimeSeries([], null, 7)).toEqual({
			cpu: [],
			gpu: [],
			mem: [],
			disk: [],
			process: [],
			network: [],
			connect: [],
		});
		expect(projectRealtimeSeries([], frame(1), 7).cpu).toEqual([
			{ timeStamp: "1", cpu: 1 },
		]);
	});
});
