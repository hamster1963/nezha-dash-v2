import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailChart from "@/components/ServerDetailChart";
import { createServer, createSettingResponse } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/utils";

const mocks = vi.hoisted(() => ({ cpuBroken: false }));

vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => ({
		connected: true,
		lastData: {
			now: 1000,
			servers: [createServer({ id: 7 }), createServer({ id: 8 })],
		},
		messageHistory: [],
	}),
}));
vi.mock("@/hooks/use-login-user", () => ({
	useLoginUser: () => ({ isAuthenticated: true }),
}));
vi.mock("@/lib/nezha-api", () => ({
	fetchSetting: () => Promise.resolve(createSettingResponse()),
}));
vi.mock("@/features/server-detail/CpuChart", () => ({
	CpuChart: ({ period }: { period: string }) => {
		if (mocks.cpuBroken) throw new Error("CPU rendering failed");
		return <p>CPU chart {period}</p>;
	},
}));
vi.mock("@/features/server-detail/MemChart", () => ({
	MemChart: () => <p>memory chart</p>,
}));
vi.mock("@/features/server-detail/DiskChart", () => ({
	DiskChart: () => <p>disk chart</p>,
}));
vi.mock("@/features/server-detail/ProcessChart", () => ({
	ProcessChart: () => <p>process chart</p>,
}));
vi.mock("@/features/server-detail/NetworkChart", () => ({
	NetworkChart: () => <p>network chart</p>,
}));
vi.mock("@/features/server-detail/ConnectChart", () => ({
	ConnectChart: () => <p>connection chart</p>,
}));

function renderCharts(id = "7") {
	const client = createTestQueryClient();
	const ui = (serverId: string) => (
		<QueryClientProvider client={client}>
			<ServerDetailChart server_id={serverId} />
		</QueryClientProvider>
	);
	return { ...render(ui(id)), ui };
}

describe("individual chart boundaries", () => {
	beforeEach(() => {
		mocks.cpuBroken = true;
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("preserves healthy charts and the period selector while retrying a broken chart", () => {
		renderCharts();
		expect(screen.getByRole("alert", { name: "CPU" })).toBeInTheDocument();
		const memoryChart = screen.getByText("memory chart");
		expect(screen.getByText("disk chart")).toBeInTheDocument();
		expect(screen.getByText("network chart")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.period1d")).toBeInTheDocument();
		mocks.cpuBroken = false;
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(screen.getByText("CPU chart realtime")).toBeInTheDocument();
		expect(screen.getByText("memory chart")).toBe(memoryChart);
	});

	it("resets a broken card when the chart period changes", () => {
		renderCharts();
		mocks.cpuBroken = false;
		fireEvent.click(screen.getByText("serverDetailChart.period1d"));
		expect(screen.getByText("CPU chart 1d")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("resets a broken card when the server changes", () => {
		const { rerender, ui } = renderCharts();
		mocks.cpuBroken = false;
		rerender(ui("8"));
		expect(screen.getByText("CPU chart realtime")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
