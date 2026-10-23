import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, isUnauthorizedError, requestJson } from "@/lib/http";
import {
	fetchMonitor,
	fetchServerGroup,
	fetchServerMetrics,
	fetchServerOnlineHistory,
	fetchService,
	fetchSetting,
} from "@/lib/nezha-api";

const json = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), { status });

describe("shared HTTP boundary", () => {
	beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

	it("retains envelopes and forwards cancellation", async () => {
		const signal = new AbortController().signal;
		const payload = { success: true, data: [] };
		vi.mocked(fetch).mockResolvedValue(json(payload));
		await expect(
			requestJson<typeof payload>("/demo", { signal }),
		).resolves.toEqual(payload);
		expect(fetch).toHaveBeenCalledWith("/demo", { signal });
	});

	it("rejects explicit business failure even without an error message", async () => {
		const payload = { success: false, data: null };
		vi.mocked(fetch).mockResolvedValueOnce(json(payload));
		await expect(fetchSetting()).rejects.toMatchObject({
			status: 200,
			info: payload,
			message: "API request was unsuccessful.",
		});
	});

	it("continues to accept envelopes without a success flag", async () => {
		for (const payload of [{ data: [] }, { value: 7 }, [], null]) {
			vi.mocked(fetch).mockResolvedValueOnce(json(payload));
			await expect(requestJson("/demo")).resolves.toEqual(payload);
		}
	});

	it("rejects unsuccessful HTTP responses without a business error", async () => {
		vi.mocked(fetch).mockResolvedValue(json({ data: [] }, 503));
		await expect(fetchSetting()).rejects.toMatchObject({
			status: 503,
			info: { data: [] },
			message: "HTTP 503",
		});
	});

	it("preserves business error codes on both successful and unsuccessful responses", async () => {
		for (const status of [200, 401]) {
			vi.mocked(fetch).mockResolvedValue(
				json({ error: "ApiErrorUnauthorized" }, status),
			);
			await expect(fetchService()).rejects.toMatchObject({
				message: "ApiErrorUnauthorized",
				status,
			});
		}
		expect(isUnauthorizedError(new ApiError("Unauthorized", 401, {}))).toBe(
			true,
		);
		expect(isUnauthorizedError("ApiErrorUnauthorized")).toBe(true);
		expect(isUnauthorizedError(new ApiError("Forbidden", 403, {}))).toBe(false);
	});

	it("reports non-JSON HTTP failures while preserving invalid JSON success failures", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("gateway failure", {
				status: 502,
				statusText: "Bad Gateway",
			}),
		);
		await expect(requestJson("/demo")).rejects.toMatchObject({
			status: 502,
			message: "Bad Gateway",
		});
		vi.mocked(fetch).mockResolvedValueOnce(new Response("invalid json"));
		await expect(requestJson("/demo")).rejects.toBeInstanceOf(SyntaxError);
	});

	it("preserves fetch rejection and body-read cancellation identity", async () => {
		const abort = new DOMException("cancelled", "AbortError");
		vi.mocked(fetch).mockRejectedValueOnce(abort);
		await expect(requestJson("/demo")).rejects.toBe(abort);
		const response = json({}, 503);
		vi.spyOn(response, "json").mockRejectedValueOnce(abort);
		vi.mocked(fetch).mockResolvedValueOnce(response);
		await expect(requestJson("/demo")).rejects.toBe(abort);
	});

	it("keeps facade URL contracts and accepts optional signals", async () => {
		vi.mocked(fetch).mockImplementation(async () =>
			json({ success: true, data: [] }),
		);
		const options = { signal: new AbortController().signal };
		await fetchServerGroup(options);
		await fetchMonitor(7, undefined, options);
		await fetchServerMetrics(7, "cpu", undefined, options);
		await fetchServerOnlineHistory(7, 30, options);
		await fetchServerOnlineHistory(7);
		expect(vi.mocked(fetch).mock.calls).toEqual([
			["/api/v1/server-group", options],
			["/api/v1/server/7/service", options],
			["/api/v1/server/7/metrics?metric=cpu", options],
			["/api/v1/server/7/online-history?days=30", options],
			["/api/v1/server/7/online-history"],
		]);
	});
});

describe("profile token refresh compatibility", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
		vi.stubGlobal("fetch", vi.fn());
	});

	it("only refreshes a successful cookie-backed session and throttles for one hour", async () => {
		const { fetchLoginUser } = await import("@/lib/nezha-api");
		const payload = { success: true, data: { id: 1 } };
		vi.mocked(fetch).mockImplementation(async () => json(payload));
		await fetchLoginUser();
		expect(fetch).toHaveBeenCalledTimes(1);
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "session=token; nz-csrf=encoded%3Dtoken",
		});
		await fetchLoginUser();
		expect(fetch).toHaveBeenLastCalledWith("/api/v1/refresh-token", {
			method: "POST",
			headers: { "X-CSRF-Token": "encoded=token" },
		});
		await fetchLoginUser();
		vi.advanceTimersByTime(60 * 60 * 1000);
		await fetchLoginUser();
		expect(
			vi
				.mocked(fetch)
				.mock.calls.filter(([url]) => url === "/api/v1/refresh-token"),
		).toHaveLength(1);
		vi.advanceTimersByTime(1);
		await fetchLoginUser();
		expect(
			vi
				.mocked(fetch)
				.mock.calls.filter(([url]) => url === "/api/v1/refresh-token"),
		).toHaveLength(2);
	});

	it("does not refresh after profile failure and contains background refresh rejection", async () => {
		const { fetchLoginUser } = await import("@/lib/nezha-api");
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "session=token",
		});
		vi.mocked(fetch).mockResolvedValueOnce(
			json({ error: "ApiErrorUnauthorized" }, 401),
		);
		await expect(fetchLoginUser()).rejects.toThrow("ApiErrorUnauthorized");
		expect(fetch).toHaveBeenCalledTimes(1);
		const payload = { success: true, data: { id: 1 } };
		vi.mocked(fetch)
			.mockResolvedValueOnce(json(payload))
			.mockRejectedValueOnce(new Error("offline"));
		await expect(fetchLoginUser()).resolves.toEqual(payload);
		await Promise.resolve();
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
