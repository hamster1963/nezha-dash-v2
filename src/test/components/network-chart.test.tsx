import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkChart, NetworkChartClient } from "@/components/NetworkChart";
import type { ChartConfig } from "@/components/ui/chart";
import { createTestQueryClient } from "@/test/utils";
import type { NezhaMonitor, ServerMonitorChart } from "@/types/nezha-api";

const apiMocks = vi.hoisted(() => ({
	fetchLoginUser: vi.fn(),
	fetchMonitor: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => ({
	fetchLoginUser: apiMocks.fetchLoginUser,
	fetchMonitor: apiMocks.fetchMonitor,
}));

vi.mock("recharts", () => {
	const createElement =
		(testId: string) =>
		({
			children,
			data,
			dataKey,
		}: {
			children?: ReactNode;
			data?: unknown[];
			dataKey?: string;
		}) => (
			<div data-key={dataKey} data-points={data?.length} data-testid={testId}>
				{children}
			</div>
		);

	const ComposedChart = createElement("composed-chart");
	const genericChart = createElement("generic-chart");

	return {
		Area: createElement("area"),
		AreaChart: genericChart,
		BarChart: genericChart,
		CartesianGrid: createElement("grid"),
		ComposedChart,
		FunnelChart: genericChart,
		Legend: ({ content }: { content?: ReactNode }) => (
			<div data-testid="chart-legend">{content}</div>
		),
		Line: createElement("line"),
		LineChart: genericChart,
		PieChart: genericChart,
		RadarChart: genericChart,
		RadialBarChart: genericChart,
		ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
			<div data-testid="responsive-chart">{children}</div>
		),
		Sankey: genericChart,
		ScatterChart: genericChart,
		Tooltip: ({ content }: { content?: ReactNode }) => (
			<div data-testid="chart-tooltip">{content}</div>
		),
		Treemap: genericChart,
		XAxis: createElement("x-axis"),
		YAxis: createElement("y-axis"),
	};
});

const times = Array.from(
	{ length: 12 },
	(_, index) => Date.parse("2025-01-01T00:00:00.000Z") + index * 60 * 60 * 1000,
);

const monitorData: NezhaMonitor[] = [
	{
		monitor_id: 2,
		monitor_name: "Beta",
		display_index: 1,
		server_id: 7,
		server_name: "edge-chart",
		created_at: times,
		avg_delay: [15, 18, 0, 45, 48, 52, 4000, 65, 70, 75, 80, 85],
	},
	{
		monitor_id: 1,
		monitor_name: "Alpha",
		display_index: 3,
		server_id: 7,
		server_name: "edge-chart",
		created_at: times,
		avg_delay: [30, 32, 35, 36, 38, 40, 42, 44, 46, 48, 50, 52],
		packet_loss: [0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5],
	},
];

const clientChartData: ServerMonitorChart = {
	Alpha: times.map((created_at, index) => ({
		created_at,
		avg_delay: 30 + index,
		packet_loss: index,
	})),
	Beta: times.map((created_at, index) => ({
		created_at,
		avg_delay: 60 + index,
		packet_loss: index % 2,
	})),
};

const clientFormattedData = times.map((created_at, index) => ({
	created_at,
	Alpha: 30 + index,
	Alpha_packet_loss: index,
	Beta: 60 + index,
	Beta_packet_loss: index % 2,
}));

const chartConfig = {
	avg_delay: { label: "monitor.avgDelay" },
	Alpha: { label: "Alpha" },
	Beta: { label: "Beta" },
} satisfies ChartConfig;

function loginResponse() {
	return {
		success: true,
		data: {
			id: 1,
			username: "admin",
			password: "",
			created_at: "2025-01-01T00:00:00.000Z",
			updated_at: "2025-01-01T00:00:00.000Z",
		},
	};
}

function renderWithQuery(ui: ReactElement) {
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			{ui}
		</QueryClientProvider>,
	);
}

describe("NetworkChart", () => {
	beforeEach(() => {
		apiMocks.fetchLoginUser.mockReset();
		apiMocks.fetchMonitor.mockReset();
		apiMocks.fetchLoginUser.mockRejectedValue(new Error("anonymous"));
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "",
		});
	});

	it("renders the loading state while monitor data is unavailable", () => {
		apiMocks.fetchMonitor.mockReturnValue(new Promise(() => undefined));

		const { container } = renderWithQuery(
			<NetworkChart server_id={7} show={false} />,
		);

		expect(container.querySelector(".h-\\[250px\\]")).toBeInTheDocument();
		expect(apiMocks.fetchMonitor).not.toHaveBeenCalled();
	});

	it("renders the no-data state from the monitor API", async () => {
		apiMocks.fetchMonitor.mockResolvedValue({
			success: true,
			data: null,
		});

		renderWithQuery(<NetworkChart server_id={7} show={true} />);

		expect(await screen.findByText("monitor.noData")).toBeInTheDocument();
	});

	it("fetches monitor data, transforms chart series, and allows logged-in period changes", async () => {
		const user = userEvent.setup();
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "session=1",
		});
		apiMocks.fetchLoginUser.mockResolvedValue(loginResponse());
		apiMocks.fetchMonitor.mockResolvedValue({
			success: true,
			data: monitorData,
		});

		renderWithQuery(<NetworkChart server_id={7} show={true} />);

		expect(await screen.findByText("edge-chart")).toBeInTheDocument();
		expect(apiMocks.fetchMonitor).toHaveBeenCalledWith(7, "1d");
		expect(screen.getByText("2 monitor.monitorCount")).toBeInTheDocument();
		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
		expect(screen.getByTestId("composed-chart")).toHaveAttribute(
			"data-points",
			"12",
		);

		await user.click(screen.getByText("monitor.period7d"));

		await waitFor(() => {
			expect(apiMocks.fetchMonitor).toHaveBeenCalledWith(7, "7d");
		});
	});
});

describe("NetworkChartClient", () => {
	it("locks longer periods for anonymous users and manages chart selection state", async () => {
		const user = userEvent.setup();
		const onPeriodChange = vi.fn();

		render(
			<NetworkChartClient
				chartDataKey={["Alpha", "Beta"]}
				chartConfig={chartConfig}
				chartData={clientChartData}
				serverName="edge-client"
				formattedData={clientFormattedData}
				isPeriodLoading={false}
				period="1d"
				onPeriodChange={onPeriodChange}
				isLogin={false}
			/>,
		);

		expect(screen.getByText("edge-client")).toBeInTheDocument();
		expect(screen.getByText("2 monitor.monitorCount")).toBeInTheDocument();

		await user.click(screen.getByText("monitor.period7d"));
		expect(onPeriodChange).not.toHaveBeenCalled();

		await user.click(screen.getByText("Alpha"));
		expect(
			screen.getByRole("button", { name: /monitor.clearSelections/ }),
		).toBeInTheDocument();
		expect(screen.getByTestId("area")).toHaveAttribute(
			"data-key",
			"packet_loss",
		);

		await user.click(screen.getByText("Beta"));
		expect(screen.queryByTestId("area")).not.toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: /monitor.clearSelections/ }),
		);
		expect(
			screen.queryByRole("button", { name: /monitor.clearSelections/ }),
		).not.toBeInTheDocument();
	});

	it("shows period loading and honors the forced peak-cut global", async () => {
		const user = userEvent.setup();
		Object.assign(window, { ForcePeakCutEnabled: true });
		const onPeriodChange = vi.fn();

		const { container } = render(
			<NetworkChartClient
				chartDataKey={["Alpha", "Beta"]}
				chartConfig={chartConfig}
				chartData={clientChartData}
				serverName="edge-client"
				formattedData={clientFormattedData}
				isPeriodLoading={true}
				period="1d"
				onPeriodChange={onPeriodChange}
				isLogin={true}
			/>,
		);

		expect(container.querySelector(".opacity-60")).toBeInTheDocument();
		expect(
			screen.getByRole("switch", { name: "monitor.peakCut" }),
		).toHaveAttribute("data-state", "checked");

		await user.click(screen.getByText("monitor.period30d"));
		expect(onPeriodChange).toHaveBeenCalledWith("30d");

		await user.click(screen.getByRole("switch", { name: "monitor.peakCut" }));
		expect(
			screen.getByRole("switch", { name: "monitor.peakCut" }),
		).toHaveAttribute("data-state", "unchecked");
	});
});
