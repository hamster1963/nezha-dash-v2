import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CycleTransferStatsCard } from "@/components/CycleTransferStats";
import CycleTransferStatsClient from "@/components/CycleTransferStatsClient";
import { ServiceTracker } from "@/components/ServiceTracker";
import ServiceTrackerClient from "@/components/ServiceTrackerClient";
import { createServer } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/utils";

const apiMocks = vi.hoisted(() => ({
	fetchService: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => apiMocks);

function renderWithQuery(ui: React.ReactElement) {
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			{ui}
		</QueryClientProvider>,
	);
}

describe("ServiceTracker", () => {
	it("shows the loading state while service data is pending", () => {
		apiMocks.fetchService.mockReturnValue(new Promise(() => undefined));

		renderWithQuery(<ServiceTracker serverList={[createServer()]} />);

		expect(screen.getByText("serviceTracker.loading")).toBeInTheDocument();
	});

	it("shows an empty state when there are no services or cycle stats", async () => {
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {},
		});

		renderWithQuery(<ServiceTracker serverList={[createServer()]} />);

		expect(
			await screen.findByText("serviceTracker.noService"),
		).toBeInTheDocument();
	});

	it("renders processed service uptime, delay, and matching cycle transfer stats", async () => {
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {
					http: {
						service_name: "HTTP Ping",
						current_up: 0,
						current_down: 0,
						total_up: 5,
						total_down: 3,
						delay: [80, 120, 450],
						up: [3, 2, 0],
						down: [0, 1, 2],
					},
				},
				cycle_transfer_stats: {
					monthly: {
						name: "Monthly",
						from: "2025-01-01T00:00:00.000Z",
						to: "2025-02-01T00:00:00.000Z",
						max: 10 * 1024,
						min: 0,
						server_name: {
							"1": "edge-1",
							"2": "hidden-server",
						},
						transfer: {
							"1": 5 * 1024,
							"2": 1024,
						},
						next_update: {
							"1": "2025-01-15T12:00:00.000Z",
							"2": "2025-01-15T12:00:00.000Z",
						},
					},
				},
			},
		});

		renderWithQuery(<ServiceTracker serverList={[createServer({ id: 1 })]} />);

		expect(await screen.findByText("HTTP Ping")).toBeInTheDocument();
		expect(screen.getByText("217ms")).toBeInTheDocument();
		expect(screen.getByText("62.5% serviceTracker.uptime")).toBeInTheDocument();
		expect(screen.getByText("edge-1")).toBeInTheDocument();
		expect(screen.getByText("Monthly")).toBeInTheDocument();
		expect(screen.queryByText("hidden-server")).not.toBeInTheDocument();
	});

	it("falls back to zero uptime when a service has no checks", async () => {
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {
					http: {
						service_name: "HTTP Ping",
						current_up: 0,
						current_down: 0,
						total_up: 0,
						total_down: 0,
						delay: [],
						up: [0, 0],
						down: [0, 0],
					},
				},
			},
		});

		renderWithQuery(<ServiceTracker serverList={[createServer()]} />);

		expect(await screen.findByText("HTTP Ping")).toBeInTheDocument();
		expect(screen.getByText("0.0% serviceTracker.uptime")).toBeInTheDocument();
	});
});

describe("CycleTransferStatsCard", () => {
	it("renders nothing for empty server lists", () => {
		const { container } = render(
			<CycleTransferStatsCard serverList={[]} cycleStats={{}} />,
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("supports per-server date and max maps while skipping incomplete entries", () => {
		render(
			<CycleTransferStatsCard
				serverList={[createServer({ id: 7 })]}
				cycleStats={{
					mapped: {
						name: "Mapped",
						from: {
							"7": "2025-01-01T00:00:00.000Z",
						},
						to: {
							"7": "2025-01-31T00:00:00.000Z",
						},
						max: {
							"7": 100,
						},
						min: {
							"7": 0,
						},
						server_name: {
							"7": "edge-7",
							"8": "edge-8",
						},
						transfer: {
							"7": 25,
							"8": 25,
						},
						next_update: {
							"7": "2025-01-15T12:00:00.000Z",
							"8": "2025-01-15T12:00:00.000Z",
						},
					},
					incomplete: {
						name: "Incomplete",
						from: "",
						to: "",
						max: 0,
						min: 0,
						server_name: {
							"7": "missing-fields",
						},
						transfer: {
							"7": 25,
						},
						next_update: {
							"7": "2025-01-15T12:00:00.000Z",
						},
					},
				}}
			/>,
		);

		expect(screen.getByText("edge-7")).toBeInTheDocument();
		expect(screen.getByText("Mapped")).toBeInTheDocument();
		expect(screen.queryByText("edge-8")).not.toBeInTheDocument();
		expect(screen.queryByText("missing-fields")).not.toBeInTheDocument();
	});
});

describe("ServiceTrackerClient and CycleTransferStatsClient", () => {
	it("uses uptime and delay severity colors for service summaries", () => {
		const days = [
			{
				completed: true,
				date: new Date("2025-01-01T00:00:00.000Z"),
				uptime: 99.5,
				delay: 80,
			},
			{
				completed: false,
				date: new Date("2025-01-02T00:00:00.000Z"),
				uptime: 90,
				delay: 320,
			},
		];

		const { rerender } = render(
			<ServiceTrackerClient
				title="API"
				uptime={99.9}
				avgDelay={80}
				days={days}
			/>,
		);

		expect(screen.getByText("99.9% serviceTracker.uptime")).toHaveClass(
			"text-emerald-500",
		);
		expect(screen.getByText("80ms")).toHaveClass("text-emerald-500");

		rerender(
			<ServiceTrackerClient
				title="API"
				uptime={97}
				avgDelay={180}
				days={days}
			/>,
		);

		expect(screen.getByText("97.0% serviceTracker.uptime")).toHaveClass(
			"text-amber-500",
		);
		expect(screen.getByText("180ms")).toHaveClass("text-amber-500");

		rerender(
			<ServiceTrackerClient
				title="API"
				uptime={94}
				avgDelay={320}
				days={days}
			/>,
		);

		expect(screen.getByText("94.0% serviceTracker.uptime")).toHaveClass(
			"text-rose-500",
		);
		expect(screen.getByText("320ms")).toHaveClass("text-rose-500");
	});

	it("caps cycle transfer progress at one hundred percent", () => {
		const { container } = render(
			<CycleTransferStatsClient
				name="Monthly"
				from="2025-01-01T00:00:00.000Z"
				to="2025-01-31T00:00:00.000Z"
				max={1024}
				serverStats={[
					{
						serverId: "1",
						serverName: "edge-1",
						transfer: 2048,
						nextUpdate: "2025-01-15T12:00:00.000Z",
					},
				]}
			/>,
		);

		expect(screen.getByText("200.0%")).toBeInTheDocument();
		expect(
			container.querySelector('[style="width: 100%;"]'),
		).toBeInTheDocument();
	});
});
