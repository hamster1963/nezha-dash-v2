import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ChartPeriod,
	combineMetricHistory,
	useMetricHistory,
} from "@/hooks/use-metric-history";
import { createTestQueryClient } from "@/test/utils";

const api = vi.hoisted(() => ({ fetchServerMetrics: vi.fn() }));
vi.mock("@/lib/nezha-api", () => api);
const result = (value: number) => ({
	success: true,
	data: { data_points: [{ ts: 123, value }] },
});
function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client = createTestQueryClient();
beforeEach(() => {
	client = createTestQueryClient();
	api.fetchServerMetrics.mockReset();
});
describe("metric history boundary", () => {
	it("keeps realtime idle and identifies successful data by actual period", async () => {
		api.fetchServerMetrics.mockResolvedValue(result(0));
		const view = renderHook(
			({ period }: { period: ChartPeriod }) =>
				useMetricHistory(7, ["cpu"], period),
			{ wrapper, initialProps: { period: "realtime" as ChartPeriod } },
		);
		expect(view.result.current.status).toBe("idle");
		expect(api.fetchServerMetrics).not.toHaveBeenCalled();
		view.rerender({ period: "1d" });
		await waitFor(() => expect(view.result.current.status).toBe("success"));
		expect(view.result.current.dataPeriod).toBe("1d");
		expect(view.result.current.data).toEqual([[{ ts: 123, value: 0 }]]);
		expect(client.getQueryData(["server-metrics", 7, "cpu", "1d"])).toEqual([
			{ ts: 123, value: 0 },
		]);
	});
	it("aborts a superseded period and never exposes stale data for a failed period", async () => {
		let oldSignal: AbortSignal | undefined;
		api.fetchServerMetrics.mockImplementation(
			(_id, _metric, period, { signal }) => {
				if (period === "7d") {
					oldSignal = signal;
					return new Promise(() => {});
				}
				if (period === "30d") return Promise.reject(new Error("offline"));
				return Promise.resolve(result(10));
			},
		);
		const view = renderHook(
			({ period }: { period: ChartPeriod }) =>
				useMetricHistory(7, ["cpu"], period),
			{ wrapper, initialProps: { period: "1d" as ChartPeriod } },
		);
		await waitFor(() => expect(view.result.current.status).toBe("success"));
		view.rerender({ period: "7d" });
		expect(view.result.current.status).toBe("pending");
		expect(view.result.current.data).toEqual([]);
		view.rerender({ period: "30d" });
		expect(oldSignal?.aborted).toBe(true);
		await waitFor(() => expect(view.result.current.status).toBe("error"));
		expect(view.result.current.dataPeriod).toBeNull();
		expect(view.result.current.data).toEqual([]);
	});
	it.each([
		"7d",
		"realtime",
	] as const)("ignores an old period resolving after switching to %s", async (nextPeriod) => {
		let resolveOld: (value: ReturnType<typeof result>) => void = () => {};
		api.fetchServerMetrics.mockImplementation((_id, _metric, period) =>
			period === "1d"
				? new Promise((resolve) => {
						resolveOld = resolve;
					})
				: Promise.resolve(result(77)),
		);
		const view = renderHook(
			({ period }: { period: ChartPeriod }) =>
				useMetricHistory(7, ["cpu"], period),
			{ wrapper, initialProps: { period: "1d" as ChartPeriod } },
		);
		view.rerender({ period: nextPeriod });
		await waitFor(() =>
			expect(view.result.current.status).toBe(
				nextPeriod === "realtime" ? "idle" : "success",
			),
		);
		resolveOld(result(11));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(view.result.current.dataPeriod).toBe(
			nextPeriod === "realtime" ? null : "7d",
		);
		expect(view.result.current.data).toEqual(
			nextPeriod === "realtime" ? [] : [[{ ts: 123, value: 77 }]],
		);
	});
	it("isolates server identity and ignores the old server response", async () => {
		let resolveOld: (value: ReturnType<typeof result>) => void = () => {};
		api.fetchServerMetrics.mockImplementation((id) =>
			id === 7
				? new Promise((resolve) => {
						resolveOld = resolve;
					})
				: Promise.resolve(result(88)),
		);
		const view = renderHook(({ id }) => useMetricHistory(id, ["cpu"], "1d"), {
			wrapper,
			initialProps: { id: 7 },
		});
		view.rerender({ id: 8 });
		await waitFor(() => expect(view.result.current.status).toBe("success"));
		resolveOld(result(11));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(view.result.current.data).toEqual([[{ ts: 123, value: 88 }]]);
	});
	it("deduplicates the shared GPU backend query without inventing an index", async () => {
		api.fetchServerMetrics.mockResolvedValue(result(42));
		const view = renderHook(
			() => [
				useMetricHistory(7, ["gpu"], "1d"),
				useMetricHistory(7, ["gpu"], "1d"),
			],
			{ wrapper },
		);
		await waitFor(() =>
			expect(view.result.current.every((h) => h.status === "success")).toBe(
				true,
			),
		);
		expect(api.fetchServerMetrics).toHaveBeenCalledTimes(1);
	});
	it("aligns paired values by timestamp and preserves zero/missing fallback", () => {
		expect(
			combineMetricHistory(
				[
					[
						{ ts: 2, value: 8 },
						{ ts: 1, value: 9 },
						{ ts: 3, value: 10 },
					],
					[
						{ ts: 1, value: 4 },
						{ ts: 2, value: 0 },
					],
				],
				(ts, a, b) => ({ ts, a, b }),
			),
		).toEqual([
			{ ts: 2, a: 8, b: 0 },
			{ ts: 1, a: 9, b: 4 },
			{ ts: 3, a: 10, b: 0 },
		]);
		expect(combineMetricHistory([], () => 0)).toEqual([]);
	});
});
