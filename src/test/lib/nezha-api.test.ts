import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	fetchLoginUser,
	fetchMonitor,
	fetchServerMetrics,
	fetchService,
	fetchSetting,
} from "@/lib/nezha-api";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(body), {
		status: init?.status ?? 200,
		statusText: init?.statusText,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

describe("nezha api fetchers", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	it("returns setting payloads", async () => {
		const payload = {
			success: true,
			data: {
				config: {
					debug: false,
					language: "en-US",
					site_name: "Nezha",
					user_template: "",
					admin_template: "",
					custom_code: "",
				},
				version: "1.0.0",
			},
		};
		vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload));

		await expect(fetchSetting()).resolves.toEqual(payload);
		expect(fetch).toHaveBeenCalledWith("/api/v1/setting");
	});

	it("throws API error messages returned by service endpoints", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			jsonResponse({ error: "service unavailable" }),
		);

		await expect(fetchService()).rejects.toThrow("service unavailable");
	});

	it("adds monitor and metrics query parameters when periods are provided", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(jsonResponse({ success: true, data: [] }))
			.mockResolvedValueOnce(
				jsonResponse({
					success: true,
					data: {
						server_id: 7,
						server_name: "edge",
						metric: "cpu",
						data_points: [],
					},
				}),
			);

		await fetchMonitor(7, "7d");
		await fetchServerMetrics(7, "cpu", "30d");

		expect(fetch).toHaveBeenNthCalledWith(
			1,
			"/api/v1/server/7/service?period=7d",
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/v1/server/7/metrics?metric=cpu&period=30d",
		);
	});

	it("refreshes the token when a logged-in browser session has cookies", async () => {
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "nezha_token=token",
		});
		const payload = {
			success: true,
			data: {
				id: 1,
				username: "admin",
				password: "",
				created_at: "2025-01-01T00:00:00Z",
				updated_at: "2025-01-01T00:00:00Z",
			},
		};
		vi.mocked(fetch)
			.mockResolvedValueOnce(jsonResponse(payload))
			.mockResolvedValueOnce(jsonResponse({ success: true }));

		await expect(fetchLoginUser()).resolves.toEqual(payload);

		expect(fetch).toHaveBeenNthCalledWith(1, "/api/v1/profile");
		expect(fetch).toHaveBeenNthCalledWith(2, "/api/v1/refresh-token");
	});
});
