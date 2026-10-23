import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetail from "@/pages/ServerDetail";

const mocks = vi.hoisted(() => ({
	loadCharts: vi.fn(),
	networkBroken: false,
}));

vi.mock("@/lib/server-detail-preload", () => ({
	get loadServerDetailChart() {
		return mocks.loadCharts;
	},
	getPreloadedServerDetailChart: () => undefined,
}));
vi.mock("@/components/ServerDetailOverview", () => ({
	default: () => <p>server overview</p>,
}));
vi.mock("@/components/NetworkChart", () => ({
	NetworkChart: () => {
		if (mocks.networkBroken) throw new Error("network rendering failed");
		return <p>network chart</p>;
	},
}));
vi.mock("@/components/ServerDetailOnlineHistory", () => ({
	default: () => <p>online history</p>,
}));
vi.mock("@/components/TabSwitch", () => ({
	default: ({
		tabs,
		setCurrentTab,
	}: {
		tabs: string[];
		setCurrentTab: (tab: string) => void;
	}) => (
		<nav>
			{tabs.map((tab) => (
				<button key={tab} type="button" onClick={() => setCurrentTab(tab)}>
					{tab}
				</button>
			))}
		</nav>
	),
}));

function renderDetail() {
	return render(
		<MemoryRouter initialEntries={["/server/7"]}>
			<Routes>
				<Route path="/server/:id" element={<ServerDetail />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("detail chart section boundaries", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal("scrollTo", vi.fn());
		mocks.loadCharts = vi.fn();
		mocks.networkBroken = false;
	});

	it("retries a rejected chart import without losing the overview or tabs", async () => {
		mocks.loadCharts
			.mockRejectedValueOnce(new Error("charts chunk unavailable"))
			.mockResolvedValue({ default: () => <p>resource charts</p> });
		renderDetail();
		await screen.findByRole("alert", { name: "error.chartFailed" });
		const overview = screen.getByText("server overview");
		const tabs = screen.getByRole("navigation");
		expect(mocks.loadCharts).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(await screen.findByText("resource charts")).toBeInTheDocument();
		expect(mocks.loadCharts).toHaveBeenCalledTimes(2);
		expect(screen.getByText("server overview")).toBe(overview);
		expect(screen.getByRole("navigation")).toBe(tabs);
	});

	it("keeps tabs usable after a section fails and retries the network chart locally", async () => {
		mocks.loadCharts.mockRejectedValue(new Error("charts chunk unavailable"));
		mocks.networkBroken = true;
		renderDetail();
		await screen.findByRole("alert");
		fireEvent.click(screen.getByRole("button", { name: "Network" }));
		await screen.findByRole("alert");
		expect(screen.getByText("server overview")).toBeInTheDocument();
		mocks.networkBroken = false;
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(await screen.findByText("network chart")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Online" }));
		expect(await screen.findByText("online history")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Network" }));
		expect(screen.getByText("network chart")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Online" }));
		expect(screen.getByText("online history")).toBeInTheDocument();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
