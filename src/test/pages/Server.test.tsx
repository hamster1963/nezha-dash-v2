import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SortProvider } from "@/context/sort-provider";
import { StatusProvider } from "@/context/status-provider";
import type { WebSocketContextType } from "@/context/websocket-context";
import { WebSocketContext } from "@/context/websocket-context";
import { useStatus } from "@/hooks/use-status";
import Servers from "@/pages/Server";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import type { NezhaServer } from "@/types/nezha-api";

const apiMocks = vi.hoisted(() => ({
	fetchServerGroup: vi.fn(),
	fetchService: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => apiMocks);

vi.mock("@/components/GlobalMap", () => ({
	default: ({ serverList }: { serverList: NezhaServer[] }) => (
		<div data-testid="global-map">{serverList.length}</div>
	),
}));

vi.mock("@/components/GroupSwitch", () => ({
	default: ({
		tabs,
		setCurrentTab,
	}: {
		tabs: string[];
		setCurrentTab: (tab: string) => void;
	}) => (
		<div>
			{tabs.map((tab) => (
				<button
					key={tab}
					type="button"
					data-testid={`group-${tab}`}
					onClick={() => setCurrentTab(tab)}
				>
					{tab}
				</button>
			))}
		</div>
	),
}));

vi.mock("@/components/ServerOverview", () => ({
	default: ({
		offline,
		online,
		total,
	}: {
		offline: number;
		online: number;
		total: number;
	}) => (
		<div data-testid="server-overview">{`${total}:${online}:${offline}`}</div>
	),
}));

vi.mock("@/components/ServerCard", () => ({
	default: ({ serverInfo }: { serverInfo: NezhaServer }) => (
		<article data-testid="server-card">{serverInfo.name}</article>
	),
}));

vi.mock("@/components/ServerCardInline", () => ({
	default: ({ serverInfo }: { serverInfo: NezhaServer }) => (
		<article data-testid="server-card-inline">{serverInfo.name}</article>
	),
}));

vi.mock("@/components/ServiceTracker", () => ({
	ServiceTracker: ({ serverList }: { serverList: NezhaServer[] }) => (
		<div data-testid="service-tracker">{serverList.length}</div>
	),
}));

function StatusControl() {
	const { setStatus } = useStatus();

	return (
		<button type="button" onClick={() => setStatus("online")}>
			online-only
		</button>
	);
}

function renderServerPage(
	websocketValue: Partial<WebSocketContextType>,
	{ withStatusControl = false } = {},
) {
	const defaultWebsocketValue: WebSocketContextType = {
		lastData: null,
		connected: false,
		messageHistory: [],
		reconnect: vi.fn(),
		needReconnect: false,
		setNeedReconnect: vi.fn(),
	};

	return renderWithProviders(
		<SortProvider>
			<StatusProvider>
				<WebSocketContext.Provider
					value={{ ...defaultWebsocketValue, ...websocketValue }}
				>
					{withStatusControl && <StatusControl />}
					<Servers />
				</WebSocketContext.Provider>
			</StatusProvider>
		</SortProvider>,
	);
}

function websocketPayload(servers: NezhaServer[]) {
	return {
		now: Date.parse("2025-01-01T00:00:20.000Z"),
		servers,
	};
}

describe("Servers page", () => {
	beforeEach(() => {
		apiMocks.fetchServerGroup.mockResolvedValue({
			success: true,
			data: [
				{
					group: {
						id: 1,
						created_at: "",
						updated_at: "",
						name: "Edge",
					},
					servers: [2],
				},
			],
		});
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {},
				cycle_transfer_stats: {},
			},
		});
	});

	it("renders websocket loading and processing states", () => {
		const { rerender } = renderServerPage({
			connected: false,
			lastData: null,
		});

		expect(screen.getByText("info.websocketConnecting")).toBeInTheDocument();

		rerender(
			<SortProvider>
				<StatusProvider>
					<WebSocketContext.Provider
						value={{
							lastData: null,
							connected: true,
							messageHistory: [],
							reconnect: vi.fn(),
							needReconnect: false,
							setNeedReconnect: vi.fn(),
						}}
					>
						<Servers />
					</WebSocketContext.Provider>
				</StatusProvider>
			</SortProvider>,
		);

		expect(screen.getByText("info.processing")).toBeInTheDocument();
	});

	it("summarizes online and offline servers from websocket data", async () => {
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});

		renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		expect(screen.getByTestId("server-overview")).toHaveTextContent("2:1:1");
		expect(screen.getAllByTestId("server-card")).toHaveLength(2);
		expect(screen.getByText("alpha")).toBeInTheDocument();
		expect(screen.getByText("beta")).toBeInTheDocument();

		await waitFor(() => {
			expect(apiMocks.fetchServerGroup).toHaveBeenCalled();
			expect(apiMocks.fetchService).toHaveBeenCalled();
		});
	});

	it("filters servers by selected group", async () => {
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});
		const user = userEvent.setup();

		renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		await user.click(await screen.findByTestId("group-Edge"));

		expect(screen.queryByText("alpha")).not.toBeInTheDocument();
		expect(screen.getByText("beta")).toBeInTheDocument();
		expect(sessionStorage.getItem("selectedGroup")).toBe("Edge");
	});

	it("sorts server cards by selected metrics and direction", async () => {
		const lowCpu = createServer({
			id: 1,
			name: "alpha",
			state: { cpu: 10 },
		});
		const highCpu = createServer({
			id: 2,
			name: "beta",
			state: { cpu: 90 },
		});
		const user = userEvent.setup();

		renderServerPage({
			connected: true,
			lastData: websocketPayload([lowCpu, highCpu]),
		});

		await user.selectOptions(screen.getByLabelText("Sort metric"), "cpu");
		expect(screen.getAllByTestId("server-card")[0]).toHaveTextContent("beta");

		await user.click(screen.getByLabelText("Toggle sort direction"));
		expect(screen.getAllByTestId("server-card")[0]).toHaveTextContent("alpha");
	});

	it("keeps name sorting independent from online status", async () => {
		const onlineAlpha = createServer({
			id: 1,
			name: "alpha",
		});
		const offlineZeta = createServer({
			id: 2,
			name: "zeta",
			last_active: "2024-12-31T23:00:00.000Z",
		});
		const user = userEvent.setup();

		renderServerPage({
			connected: true,
			lastData: websocketPayload([onlineAlpha, offlineZeta]),
		});

		expect(screen.getByLabelText("Toggle sort direction")).toBeDisabled();

		await user.selectOptions(screen.getByLabelText("Sort metric"), "name");

		expect(screen.getAllByTestId("server-card")[0]).toHaveTextContent("zeta");

		await user.click(screen.getByLabelText("Toggle sort direction"));
		expect(screen.getAllByTestId("server-card")[0]).toHaveTextContent("alpha");
	});

	it("sorts by system even when a platform value is missing", async () => {
		const missingPlatform = createServer({
			id: 1,
			name: "alpha",
			host: { platform: undefined },
		});
		const linux = createServer({
			id: 2,
			name: "beta",
			host: { platform: "linux" },
		});
		const user = userEvent.setup();

		renderServerPage({
			connected: true,
			lastData: websocketPayload([missingPlatform, linux]),
		});

		await user.selectOptions(screen.getByLabelText("Sort metric"), "system");

		const cards = screen.getAllByTestId("server-card");
		expect(cards).toHaveLength(2);
		expect(cards[0]).toHaveTextContent("beta");
		expect(cards[1]).toHaveTextContent("alpha");
	});

	it("restores the saved main page scroll position after data is ready", async () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("scrollTo", scrollTo);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
		sessionStorage.setItem("fromMainPage", "true");
		sessionStorage.setItem("scrollPosition", "345");

		renderServerPage({
			connected: true,
			lastData: websocketPayload([createServer({ id: 1, name: "alpha" })]),
		});

		await waitFor(() => {
			expect(scrollTo).toHaveBeenCalledWith({
				top: 345,
				left: 0,
				behavior: "auto",
			});
		});
	});

	it("does not restore stale scroll positions without a main page origin", () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("scrollTo", scrollTo);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
		sessionStorage.setItem("scrollPosition", "345");

		renderServerPage({
			connected: true,
			lastData: websocketPayload([createServer({ id: 1, name: "alpha" })]),
		});

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("toggles map and service tracker controls when service data exists", async () => {
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {
					http: {
						service_name: "HTTP",
						current_up: 1,
						current_down: 0,
						total_up: 1,
						total_down: 0,
						delay: [10],
						up: [1],
						down: [0],
					},
				},
				cycle_transfer_stats: {},
			},
		});
		const user = userEvent.setup();
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});

		const { container } = renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		await waitFor(() => {
			expect(apiMocks.fetchService).toHaveBeenCalled();
			expect(
				container.querySelectorAll(
					".server-overview-controls section > button",
				),
			).toHaveLength(3);
		});

		const controls = container.querySelectorAll(
			".server-overview-controls section > button",
		);
		await user.click(controls[0]);
		expect(screen.getByTestId("global-map")).toHaveTextContent("2");
		expect(localStorage.getItem("showMap")).toBe("1");

		await user.click(controls[1]);
		expect(screen.getByTestId("service-tracker")).toHaveTextContent("2");
		expect(localStorage.getItem("showServices")).toBe("1");
	});

	it("does not enable inline cards from storage on mobile widths", () => {
		localStorage.setItem("inline", "1");
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			value: 500,
		});
		const online = createServer({ id: 1, name: "alpha" });

		renderServerPage({
			connected: true,
			lastData: websocketPayload([online]),
		});

		expect(screen.getByTestId("server-card")).toHaveTextContent("alpha");
		expect(screen.queryByTestId("server-card-inline")).not.toBeInTheDocument();
	});

	it("applies external status filters and inline card preferences", async () => {
		localStorage.setItem("inline", "1");
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			value: 1024,
		});
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});
		const user = userEvent.setup();

		renderServerPage(
			{
				connected: true,
				lastData: websocketPayload([online, offline]),
			},
			{ withStatusControl: true },
		);

		await waitFor(() => {
			expect(screen.getAllByTestId("server-card-inline")).toHaveLength(2);
		});

		await user.click(screen.getByRole("button", { name: "online-only" }));

		expect(screen.getAllByTestId("server-card-inline")).toHaveLength(1);
		expect(screen.getByText("alpha")).toBeInTheDocument();
		expect(screen.queryByText("beta")).not.toBeInTheDocument();
	});
});
