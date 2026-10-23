import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailOnlineHistory from "@/components/ServerDetailOnlineHistory";
import { createTestQueryClient } from "@/test/utils";
import type { OnlineHistoryResponse } from "@/types/nezha-api";

const websocketMocks = vi.hoisted(() => ({
	lastData: null as { servers: { id: number; last_active: string }[] } | null,
}));
vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => websocketMocks,
}));

const apiMocks = vi.hoisted(() => ({
	fetchServerOnlineHistory: vi.fn(),
	fetchLoginUser: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => ({
	fetchServerOnlineHistory: apiMocks.fetchServerOnlineHistory,
	fetchLoginUser: apiMocks.fetchLoginUser,
}));

function onlineHistoryResponse(maxDays = 30): OnlineHistoryResponse {
	return {
		success: true,
		data: {
			server_id: 7,
			server_name: "edge-online",
			days: 7,
			max_days: maxDays,
			timezone: "UTC",
			window_start: "2026-10-07T04:00:00.000Z",
			window_end: "2026-10-14T12:00:00.000Z",
			total_online_seconds: 5400,
			online_rate: 0.89,
			currently_online: true,
			last_active: "2026-10-14T03:30:00.000Z",
			periods: [
				{
					start: "2026-10-13T08:00:00.000Z",
					end: "2026-10-13T09:30:00.000Z",
					ongoing: false,
				},
				{
					start: "2026-10-14T10:00:00.000Z",
					end: "2026-10-14T11:00:00.000Z",
					ongoing: true,
				},
			],
			daily: [
				{ date: "2026-10-13", online_seconds: 5400 },
				{ date: "2026-10-14", online_seconds: 3600 },
			],
		},
	};
}

function renderWithQuery(ui: ReactElement) {
	const client = createTestQueryClient();
	return render(ui, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
}

describe("ServerDetailOnlineHistory", () => {
	beforeEach(() => {
		websocketMocks.lastData = null;
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "nz-csrf=test",
		});
		apiMocks.fetchLoginUser.mockReset();
		apiMocks.fetchLoginUser.mockResolvedValue({
			success: true,
			data: { id: 1 },
		});
		apiMocks.fetchServerOnlineHistory.mockReset();
	});

	afterEach(() => {
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "",
		});
	});

	it.each([
		"guest",
		"pending",
	])("locks longer windows for %s sessions before any rejected history request", async (session) => {
		if (session === "guest")
			apiMocks.fetchLoginUser.mockRejectedValue(new Error("unauthorized"));
		if (session === "pending")
			apiMocks.fetchLoginUser.mockReturnValue(new Promise(() => undefined));
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");
		const user = userEvent.setup();
		for (const days of [7, 30]) {
			const option = screen.getByText(`serverOnlineHistory.days${days}`);
			expect(option.parentElement).toHaveAttribute("aria-disabled", "true");
			await user.click(option);
		}
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledTimes(1);
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 1);
	});

	it("unlocks longer windows for a confirmed identity without readable cookies", async () => {
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "",
		});
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		const option = await screen.findByText("serverOnlineHistory.days30");
		await waitFor(() =>
			expect(option.parentElement).toHaveAttribute("aria-disabled", "false"),
		);
		await userEvent.setup().click(option);
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 30);
	});

	it("renders the loading state while history data is unavailable", () => {
		apiMocks.fetchServerOnlineHistory.mockReturnValue(
			new Promise(() => undefined),
		);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		expect(
			screen.getByRole("status", { name: "serverOnlineHistory.loading" }),
		).toHaveAttribute("aria-busy", "true");
		expect(screen.getByTestId("online-history-loading")).toBeInTheDocument();
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 1);
	});

	it("keeps existing content instead of flashing the skeleton while changing days", async () => {
		apiMocks.fetchServerOnlineHistory
			.mockResolvedValueOnce(onlineHistoryResponse())
			.mockReturnValue(new Promise(() => undefined));
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("0.9%");
		expect(
			screen.queryByTestId("online-history-loading"),
		).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByText("serverOnlineHistory.days30"));
		await waitFor(() =>
			expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 30),
		);
		expect(screen.getByText("0.9%")).toBeInTheDocument();
		expect(
			screen.queryByTestId("online-history-loading"),
		).not.toBeInTheDocument();
	});

	it("does not combine the previous server's history with the next server's live status", async () => {
		websocketMocks.lastData = {
			servers: [
				{ id: 7, last_active: "2026-10-14T12:34:56.000Z" },
				{ id: 8, last_active: "2026-10-14T13:45:00.000Z" },
			],
		};
		let resolveNext!: (value: OnlineHistoryResponse) => void;
		apiMocks.fetchServerOnlineHistory
			.mockResolvedValueOnce(onlineHistoryResponse())
			.mockReturnValue(
				new Promise<OnlineHistoryResponse>((resolve) => {
					resolveNext = resolve;
				}),
			);
		const { rerender } = renderWithQuery(
			<ServerDetailOnlineHistory server_id="7" />,
		);
		expect(await screen.findByText("12:34:56")).toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByText("serverOnlineHistory.days30").parentElement,
			).toHaveAttribute("aria-disabled", "false"),
		);

		rerender(<ServerDetailOnlineHistory server_id="8" />);
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(8, 1);
		expect(screen.getByTestId("online-history-loading")).toBeInTheDocument();
		expect(screen.queryByText("0.9%")).not.toBeInTheDocument();
		expect(screen.queryByText("12:34:56")).not.toBeInTheDocument();
		expect(screen.queryByText("13:45:00")).not.toBeInTheDocument();
		expect(screen.queryByTestId("period-chip")).not.toBeInTheDocument();

		const next = onlineHistoryResponse();
		next.data.server_id = 8;
		next.data.online_rate = 25;
		await act(async () => resolveNext(next));
		expect(await screen.findByText("25.0%")).toBeInTheDocument();
		expect(screen.getByText("13:45:00")).toBeInTheDocument();
		expect(screen.queryByText("0.9%")).not.toBeInTheDocument();
	});

	it("ignores a late history response after another server navigation", async () => {
		const resolvers = new Map<number, (value: OnlineHistoryResponse) => void>();
		apiMocks.fetchServerOnlineHistory.mockImplementation((serverId: number) =>
			serverId === 7
				? Promise.resolve(onlineHistoryResponse())
				: new Promise<OnlineHistoryResponse>((resolve) => {
						resolvers.set(serverId, resolve);
					}),
		);
		const { rerender } = renderWithQuery(
			<ServerDetailOnlineHistory server_id="7" />,
		);
		await screen.findByText("0.9%");
		rerender(<ServerDetailOnlineHistory server_id="8" />);
		rerender(<ServerDetailOnlineHistory server_id="9" />);
		const abandoned = onlineHistoryResponse();
		abandoned.data.server_id = 8;
		abandoned.data.online_rate = 25;
		await act(async () => resolvers.get(8)?.(abandoned));
		expect(screen.getByTestId("online-history-loading")).toBeInTheDocument();
		expect(screen.queryByText("25.0%")).not.toBeInTheDocument();
		const latest = onlineHistoryResponse();
		latest.data.server_id = 9;
		latest.data.online_rate = 75;
		await act(async () => resolvers.get(9)?.(latest));
		expect(await screen.findByText("75.0%")).toBeInTheDocument();
		expect(screen.queryByText("25.0%")).not.toBeInTheDocument();
	});

	it("renders daily totals and all groups when fewer than three days are available", async () => {
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");
		expect(screen.getAllByText("online")).toHaveLength(3);
		expect(screen.getByText("0.9%")).toBeInTheDocument();
		expect(screen.getAllByText("1h 30m")).toHaveLength(4);
		expect(screen.getAllByText("1h 0m")).toHaveLength(3);
		expect(screen.getByText("10-13")).toBeInTheDocument();
		expect(
			screen.queryByText("serverOnlineHistory.expandMore"),
		).not.toBeInTheDocument();
		expect(screen.getAllByTestId("period-chip")).toHaveLength(2);
	});

	it.each([
		[1800, "1h 30m"],
		[7200, "0m"],
		[7500, "0m"],
	])("calculates offline time from the actual window with %i online seconds", async (seconds, expected) => {
		const response = onlineHistoryResponse();
		response.data.window_start = "2026-10-14T10:00:00.000Z";
		response.data.window_end = "2026-10-14T12:00:00.000Z";
		response.data.total_online_seconds = seconds;
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(response);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);

		const label = await screen.findByText("serverOnlineHistory.totalOffline");
		expect(label.parentElement).toHaveTextContent(expected);
	});

	it("maps each day's periods onto the shared 0:00-24:00 timeline", async () => {
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);

		expect(await screen.findByText(/0:00 – 24:00/)).toBeInTheDocument();

		// 时间轴按面板时区（UTC）的挂钟定位：08:00 在 33.33%，1.5h 宽 6.25%
		const segments = await screen.findAllByTestId("online-segment");
		expect(segments).toHaveLength(2);
		expect(Number.parseFloat(segments[0].style.left)).toBeCloseTo(
			(8 / 24) * 100,
			2,
		);
		expect(Number.parseFloat(segments[0].style.width)).toBeCloseTo(
			(1.5 / 24) * 100,
			2,
		);
		expect(segments[0].style.minWidth).toBe("2px");
	});

	it("retains the daily duration and period chip across a fall-back clock reversal", async () => {
		const response = onlineHistoryResponse();
		Object.assign(response.data, {
			timezone: "America/New_York",
			window_start: "2026-11-01T04:00:00.000Z",
			window_end: "2026-11-02T05:00:00.000Z",
			total_online_seconds: 1800,
			daily: [{ date: "2026-11-01", online_seconds: 1800 }],
			periods: [
				{
					start: "2026-11-01T05:45:00.000Z",
					end: "2026-11-01T06:15:00.000Z",
					ongoing: false,
				},
			],
		});
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(response);
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		const row = await screen.findByTestId("daily-online-day");
		expect(within(row).getByText("30m")).toBeInTheDocument();
		const chip = screen.getByTestId("period-chip");
		expect(chip).toHaveTextContent("01:45 → 01:15");
		expect(chip).toHaveTextContent("30m");
		expect(screen.getByTestId("online-segment")).toHaveStyle({
			width: "0%",
			minWidth: "2px",
		});
		await userEvent.setup().hover(screen.getByTestId("online-segment"));
		expect(await screen.findByRole("tooltip")).toHaveTextContent("30m");
	});

	it("keeps daily totals, carry-over chips and window markers consistent", async () => {
		const response = onlineHistoryResponse();
		Object.assign(response.data, {
			window_start: "2026-10-13T06:00:00.000Z",
			window_end: "2026-10-14T12:00:00.000Z",
			total_online_seconds: 9 * 3600,
			daily: [
				{ date: "2026-10-13", online_seconds: 7200 },
				{ date: "2026-10-14", online_seconds: 7 * 3600 },
			],
			periods: [
				{
					start: "2026-10-13T22:00:00.000Z",
					end: "2026-10-14T02:00:00.000Z",
					ongoing: false,
				},
				{
					start: "2026-10-14T03:00:00.000Z",
					end: "2026-10-14T04:00:00.000Z",
					ongoing: false,
				},
				{
					start: "2026-10-14T08:00:00.000Z",
					end: "2026-10-14T12:00:00.000Z",
					ongoing: true,
				},
			],
		});
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(response);
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		const rows = await screen.findAllByTestId("daily-online-day");
		expect(within(rows[1]).getByText("7h 0m")).toBeInTheDocument();
		expect(within(rows[1]).getAllByTestId("online-segment")).toHaveLength(3);
		const latestGroup = screen.getAllByTestId("period-day")[0];
		expect(within(latestGroup).getByText("7h 0m")).toBeInTheDocument();
		const chips = within(latestGroup).getAllByTestId("period-chip");
		expect(chips).toHaveLength(3);
		expect(chips[0]).toHaveTextContent("00:00 → 02:00");
		expect(screen.getByTestId("outside-window")).toHaveStyle({ width: "25%" });
		expect(screen.getByTestId("unrecorded-window")).toHaveStyle({
			left: "50%",
			width: "50%",
		});
		expect(screen.getByTestId("data-cutoff")).toHaveAccessibleName(
			"serverOnlineHistory.dataCutoff 12:00:00",
		);
		await userEvent.setup().hover(chips[0]);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"serverOnlineHistory.originalSession 10-13 22:00:00 → 10-14 02:00:00",
		);
	});

	it("renders the compact mobile summary below the md breakpoint", async () => {
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockImplementation(() => ({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
		try {
			renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);

			expect(await screen.findByTestId("summary-mobile")).toBeInTheDocument();
			expect(screen.queryByTestId("summary-desktop")).not.toBeInTheDocument();
			// 移动端：在线率 + 在线/离线双指标 + 最近活跃。
			expect(screen.getByText("0.9%")).toBeInTheDocument();
			expect(
				screen.getByText("serverOnlineHistory.totalOffline"),
			).toBeInTheDocument();
			expect(
				screen.getByText("serverOnlineHistory.totalOnline"),
			).toBeInTheDocument();
			expect(
				screen.getByText("serverOnlineHistory.lastActive"),
			).toBeInTheDocument();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("keeps the live last-active time when switching history windows", async () => {
		const user = userEvent.setup();
		websocketMocks.lastData = {
			servers: [{ id: 7, last_active: "2026-10-14T12:34:56.000Z" }],
		};
		apiMocks.fetchServerOnlineHistory.mockImplementation((_id, days) => {
			const response = onlineHistoryResponse();
			response.data.online_rate = days === 30 ? 50 : 90;
			response.data.last_active =
				days === 30 ? "2026-10-14T10:00:00.000Z" : "2026-10-14T11:00:00.000Z";
			return Promise.resolve(response);
		});
		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		expect(await screen.findByText("12:34:56")).toBeInTheDocument();
		await user.click(screen.getByText("serverOnlineHistory.days30"));
		expect(await screen.findByText("50.0%")).toBeInTheDocument();
		await waitFor(() =>
			expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 30),
		);
		expect(screen.getByText("12:34:56")).toBeInTheDocument();
		await user.click(screen.getByText("serverOnlineHistory.days7"));
		expect(screen.getByText("12:34:56")).toBeInTheDocument();
	});

	it("switches the query window via the day selector", async () => {
		const user = userEvent.setup();
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(),
		);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");

		await user.click(screen.getByText("serverOnlineHistory.days30"));

		await waitFor(() => {
			expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 30);
		});
	});

	it("locks day options beyond the configured max window", async () => {
		const user = userEvent.setup();
		apiMocks.fetchServerOnlineHistory.mockResolvedValue(
			onlineHistoryResponse(7),
		);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");

		await user.click(screen.getByText("serverOnlineHistory.days30"));
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledTimes(1);
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenCalledWith(7, 1);
	});

	it("shows the login hint when the API rejects anonymous guests", async () => {
		apiMocks.fetchServerOnlineHistory.mockRejectedValue(
			new Error("unauthorized: only 1d data available for guests"),
		);

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);

		expect(
			await screen.findByText("serverOnlineHistory.loginRequired"),
		).toBeInTheDocument();
	});

	it("falls back to one day when guests request a longer window", async () => {
		const user = userEvent.setup();
		apiMocks.fetchServerOnlineHistory
			.mockResolvedValueOnce(onlineHistoryResponse())
			.mockRejectedValueOnce(
				new Error("unauthorized: only 1d data available for guests"),
			)
			.mockResolvedValue(onlineHistoryResponse(1));

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);

		// 首屏直接请求 1d；手动选择 7d 被拒后自动回退到 1d。
		await screen.findByText("serverOnlineHistory.dailyOnline");
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenNthCalledWith(1, 7, 1);
		await user.click(screen.getByText("serverOnlineHistory.days7"));
		await waitFor(() => {
			expect(apiMocks.fetchServerOnlineHistory).toHaveBeenNthCalledWith(
				3,
				7,
				1,
			);
		});
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenNthCalledWith(2, 7, 7);

		// 更长窗口被锁定（游客上限 1 天），点击不再发起新请求
		const calls = apiMocks.fetchServerOnlineHistory.mock.calls.length;
		await user.click(screen.getByText("serverOnlineHistory.days30"));
		expect(apiMocks.fetchServerOnlineHistory).toHaveBeenNthCalledWith(3, 7, 1);
		expect(apiMocks.fetchServerOnlineHistory.mock.calls.length).toBe(calls);
	});

	it("groups periods by the panel timezone from the response", async () => {
		const data = onlineHistoryResponse().data;
		// 面板时区非 UTC 才能暴露 dayjs .tz(input, zone) 忽略显式偏移的问题
		data.timezone = "Asia/Shanghai";
		data.window_start = "2026-01-01T16:00:00.000Z";
		data.window_end = "2026-01-02T16:00:00.000Z";
		data.daily = [{ date: "2026-01-02", online_seconds: 7200 }];
		data.periods = [
			{
				start: "2026-01-01T20:00:00.000Z",
				end: "2026-01-01T22:00:00.000Z",
				ongoing: false,
			},
		];
		apiMocks.fetchServerOnlineHistory.mockResolvedValue({
			success: true,
			data,
		});

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");

		// 20:00Z 在面板时区（UTC+8）为 01-02 04:00：分组落到 01-02，段内时刻同步换算
		expect(screen.getByText("01-02")).toBeInTheDocument();
		expect(screen.queryByText("01-01")).not.toBeInTheDocument();
		const chip = screen.getByTestId("period-chip");
		expect(chip.textContent).toContain("04:00");
		expect(chip.textContent).toContain("06:00");
	});

	it("shows three days initially and expands ten days per click", async () => {
		const user = userEvent.setup();
		const data = onlineHistoryResponse().data;
		const dates = Array.from({ length: 25 }, (_, i) =>
			dayjs("2026-10-14").subtract(i, "day").format("YYYY-MM-DD"),
		);
		data.window_start = `${dates[dates.length - 1]}T00:00:00.000Z`;
		data.daily = dates.map((date) => ({ date, online_seconds: 3600 }));
		data.periods = dates.map((date) => ({
			start: `${date}T06:00:00.000Z`,
			end: `${date}T07:00:00.000Z`,
			ongoing: false,
		}));
		apiMocks.fetchServerOnlineHistory.mockResolvedValue({
			success: true,
			data,
		});

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");

		expect(screen.getAllByTestId("period-day")).toHaveLength(3);

		await user.click(screen.getByText("serverOnlineHistory.expandMore"));
		expect(screen.getAllByTestId("period-day")).toHaveLength(13);

		await user.click(screen.getByText("serverOnlineHistory.expandMore"));
		expect(screen.getAllByTestId("period-day")).toHaveLength(23);

		await user.click(screen.getByText("serverOnlineHistory.expandMore"));
		expect(screen.getAllByTestId("period-day")).toHaveLength(25);
		expect(
			screen.queryByText("serverOnlineHistory.expandMore"),
		).not.toBeInTheDocument();
	});

	it("derives offline periods as the complement of online sessions", async () => {
		const user = userEvent.setup();
		const data = onlineHistoryResponse().data;
		data.window_start = "2026-10-14T00:00:00.000Z";
		data.window_end = "2026-10-14T12:00:00.000Z";
		data.currently_online = false;
		data.daily = [{ date: "2026-10-14", online_seconds: 7200 }];
		data.periods = [
			{
				start: "2026-10-14T02:00:00.000Z",
				end: "2026-10-14T04:00:00.000Z",
				ongoing: false,
			},
		];
		apiMocks.fetchServerOnlineHistory.mockResolvedValue({
			success: true,
			data,
		});

		renderWithQuery(<ServerDetailOnlineHistory server_id="7" />);
		await screen.findByText("serverOnlineHistory.dailyOnline");

		await user.click(screen.getByText("serverOnlineHistory.periodsOffline"));

		// 在线 02:00-04:00 两侧的空档各成一段，且服务器当前离线 → 末段进行中
		const chips = screen.getAllByTestId("period-chip");
		expect(chips).toHaveLength(2);
		expect(chips[0].textContent).toContain("00:00");
		expect(chips[0].textContent).toContain("2h 0m");
		expect(chips[1].textContent).toContain("04:00");
		expect(chips[1].textContent).toContain("8h 0m");
		expect(chips[1].textContent).toContain("serverOnlineHistory.ongoing");

		// 组头合计 = 窗口时长 12h − 当日在线 2h = 10h
		expect(screen.getByText("10h 0m")).toBeInTheDocument();
	});
});
