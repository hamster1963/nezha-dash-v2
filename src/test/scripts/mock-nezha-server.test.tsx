import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useMetricHistory } from "@/hooks/use-metric-history";
import { createTestQueryClient } from "@/test/utils";
import type {
	MetricType,
	MonitorResponse,
	ServerMetricsResponse,
} from "@/types/nezha-api";

const nativeFetch = globalThis.fetch;
const chartMetrics: MetricType[] = [
	"cpu",
	"memory",
	"swap",
	"disk",
	"net_in_speed",
	"net_out_speed",
	"tcp_conn",
	"udp_conn",
	"process_count",
	"gpu",
];

describe.each([false, true])("mock metrics (guest=%s)", (guest) => {
	let child: ChildProcess;
	let baseUrl: string;

	beforeAll(async () => {
		child = spawn(
			process.execPath,
			["scripts/mock-nezha-server.js", ...(guest ? ["--guest"] : [])],
			{
				env: {
					...process.env,
					MOCK_NEZHA_PORT: "0",
					MOCK_NEZHA_COUNT: "6",
					MOCK_NEZHA_INTERVAL_MS: "0",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		baseUrl = await new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Mock startup timed out")),
				5000,
			);
			let output = "";
			child.stdout?.on("data", (chunk) => {
				output += chunk.toString();
				const match = output.match(/listening on (http:\/\/localhost:\d+)/);
				if (match) {
					clearTimeout(timeout);
					resolve(match[1]);
				}
			});
			child.once("error", (error) => {
				clearTimeout(timeout);
				reject(error);
			});
			child.once("exit", (code) => {
				clearTimeout(timeout);
				reject(new Error(`Mock exited with code ${code}`));
			});
		});
	});

	afterAll(async () => {
		if (child && child.exitCode === null && child.signalCode === null) {
			const exited = once(child, "exit");
			child.kill("SIGTERM");
			await exited;
		}
	});

	const request = (path: string) => nativeFetch(`${baseUrl}${path}`);

	it("provides real HTTP data that the history hook can render for every chart", async () => {
		vi.stubGlobal("fetch", (path: string, init?: RequestInit) =>
			nativeFetch(`${baseUrl}${path}`, init),
		);
		const client = createTestQueryClient();
		const view = renderHook(() => useMetricHistory(6, chartMetrics, "1d"), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={client}>{children}</QueryClientProvider>
			),
		});
		await waitFor(() => expect(view.result.current.status).toBe("success"));
		expect(view.result.current.dataPeriod).toBe("1d");
		const series = view.result.current.data;
		expect(series).toHaveLength(chartMetrics.length);
		const timestamps = series[0].map((point) => point.ts);
		expect(timestamps.length).toBeGreaterThan(2);
		expect(timestamps[timestamps.length - 1] - timestamps[0]).toBe(86_400_000);
		for (const points of series) {
			expect(points.map((point) => point.ts)).toEqual(timestamps);
			expect(
				points.every(
					(point) => Number.isFinite(point.value) && point.value >= 0,
				),
			).toBe(true);
		}
		expect(new Set(series[0].map((point) => point.value)).size).toBeGreaterThan(
			1,
		);
		expect(series[0].every((point) => point.value <= 100)).toBe(true);
		view.unmount();
		client.clear();
	});

	it("keeps guest restrictions while supplying full history in user mode", async () => {
		expect((await request("/api/v1/profile")).status).toBe(guest ? 401 : 200);
		for (const period of ["7d", "30d"]) {
			const response = await request(
				`/api/v1/server/6/metrics?metric=cpu&period=${period}`,
			);
			expect(response.status).toBe(guest ? 401 : 200);
			if (!guest) {
				const body: ServerMetricsResponse = await response.json();
				expect(body.data.server_id).toBe(6);
				expect(body.data.metric).toBe("cpu");
				expect(body.data.data_points.length).toBeGreaterThan(2);
			}
		}
	});

	it("supplies aligned network delay and packet loss series with guest limits", async () => {
		const response = await request("/api/v1/server/6/service?period=1d");
		expect(response.status).toBe(200);
		const body: MonitorResponse = await response.json();
		expect(body.data).toHaveLength(3);
		for (const monitor of body.data) {
			expect(monitor.created_at.length).toBeGreaterThan(2);
			expect(monitor.avg_delay).toHaveLength(monitor.created_at.length);
			expect(monitor.packet_loss).toHaveLength(monitor.created_at.length);
			expect(
				monitor.avg_delay.every(
					(value) => value !== null && Number.isFinite(value) && value >= 0,
				),
			).toBe(true);
			expect(
				monitor.packet_loss?.every(
					(value) => value !== null && value >= 0 && value <= 100,
				),
			).toBe(true);
		}
		expect(
			body.data.some((monitor) =>
				monitor.packet_loss?.some((value) => value !== null && value > 0),
			),
		).toBe(true);
		for (const period of ["7d", "30d"]) {
			expect(
				(await request(`/api/v1/server/6/service?period=${period}`)).status,
			).toBe(guest ? 401 : 200);
		}
	});

	it("represents an offline node with no history as an empty valid series", async () => {
		const response = await request(
			"/api/v1/server/4/metrics?metric=cpu&period=1d",
		);
		expect(response.status).toBe(200);
		const body: ServerMetricsResponse = await response.json();
		expect(body.data.data_points).toEqual([]);
	});

	it("rejects missing servers and unsupported metric names", async () => {
		expect(
			(await request("/api/v1/server/999/metrics?metric=cpu&period=1d")).status,
		).toBe(404);
		for (const metric of ["invalid", "toString", "__proto__"]) {
			expect(
				(await request(`/api/v1/server/6/metrics?metric=${metric}&period=1d`))
					.status,
			).toBe(400);
		}
	});
});
