import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailOverview from "@/components/ServerDetailOverview";
import ServerDetailSummary from "@/components/ServerDetailSummary";
import { createServer } from "@/test/fixtures";

const websocketMocks = vi.hoisted(() => ({
	connected: true,
	lastMessage: null as MessageEvent<string> | null,
}));

vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => websocketMocks,
}));

function seedWebSocketData({
	server = createServer(),
	now = Date.parse("2025-01-01T00:00:20.000Z"),
} = {}) {
	websocketMocks.connected = true;
	websocketMocks.lastMessage = new MessageEvent("message", {
		data: JSON.stringify({
			now,
			servers: [server],
		}),
	});
}

function LocationProbe() {
	const location = useLocation();
	return <p>{location.pathname}</p>;
}

describe("ServerDetailSummary", () => {
	beforeEach(() => {
		websocketMocks.connected = true;
		websocketMocks.lastMessage = null;
	});

	it("renders nothing until websocket data exists", () => {
		websocketMocks.connected = false;

		const { container } = render(<ServerDetailSummary server_id={1} />);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders resource, network, and connection summaries for the selected server", () => {
		seedWebSocketData();

		render(<ServerDetailSummary server_id={1} />);

		expect(screen.getByText("12.00%")).toBeInTheDocument();
		expect(screen.getAllByText("25.00%")).toHaveLength(2);
		expect(screen.getByText("Process")).toBeInTheDocument();
		expect(screen.getByText("88")).toBeInTheDocument();
		expect(screen.getByText("TCP")).toBeInTheDocument();
		expect(screen.getByText("8")).toBeInTheDocument();
		expect(screen.getByText("UDP")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument();
		expect(screen.getByText("1.00M/s")).toBeInTheDocument();
		expect(screen.getByText("2.00M/s")).toBeInTheDocument();
	});
});

describe("ServerDetailOverview", () => {
	beforeEach(() => {
		websocketMocks.connected = true;
		websocketMocks.lastMessage = null;
		Object.assign(window, { ForceUseSvgFlag: true });
	});

	it("shows the loading shell when websocket data or the selected server is missing", () => {
		websocketMocks.connected = false;
		const { rerender } = render(
			<MemoryRouter>
				<ServerDetailOverview server_id="1" />
			</MemoryRouter>,
		);

		expect(screen.getAllByAltText("BackIcon").length).toBeGreaterThan(0);

		seedWebSocketData();
		rerender(
			<MemoryRouter>
				<ServerDetailOverview server_id="404" />
			</MemoryRouter>,
		);

		expect(screen.getAllByAltText("BackIcon").length).toBeGreaterThan(0);
	});

	it("renders server identity, hardware, traffic, and temperature details", async () => {
		const user = userEvent.setup();
		seedWebSocketData({
			server: createServer({
				id: 7,
				name: "edge-detail",
				country_code: "us",
				host: {
					gpu: ["NVIDIA T4"],
				},
				state: {
					temperatures: [{ Name: "CPU Core", Temperature: 55.5 }],
				},
			}),
		});

		render(
			<MemoryRouter initialEntries={["/server/7"]}>
				<ServerDetailOverview server_id="7" />
				<LocationProbe />
			</MemoryRouter>,
		);

		expect(screen.getByText("edge-detail")).toBeInTheDocument();
		expect(screen.getByText("serverDetail.online")).toBeInTheDocument();
		expect(screen.getByText("1.0.0")).toBeInTheDocument();
		expect(screen.getByText("amd64")).toBeInTheDocument();
		expect(screen.getByText("US")).toBeInTheDocument();
		expect(screen.getByText(/linux - 6.8/)).toBeInTheDocument();
		expect(screen.getByText(/AMD EPYC/)).toBeInTheDocument();
		expect(screen.getByText("NVIDIA T4")).toBeInTheDocument();
		expect(screen.getByText("2.00 GiB")).toBeInTheDocument();
		expect(screen.getByText("1.00 GiB")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: /serverDetail.temperature/ }),
		);
		expect(screen.getByText("CPU Core")).toBeInTheDocument();
		expect(screen.getByText(/55.50 °C/)).toBeInTheDocument();

		await user.click(screen.getByText("edge-detail"));
		expect(screen.getByText("/")).toBeInTheDocument();
	});
});
