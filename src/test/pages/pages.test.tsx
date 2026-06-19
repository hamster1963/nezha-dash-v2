import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/pages/ErrorPage";
import NotFound from "@/pages/NotFound";
import ServerDetail from "@/pages/ServerDetail";

vi.mock("@/components/NetworkChart", () => ({
	NetworkChart: ({ server_id, show }: { server_id: number; show: boolean }) => (
		<div data-testid="network-chart">{`${server_id}:${show}`}</div>
	),
}));

vi.mock("@/components/ServerDetailChart", () => ({
	default: ({ server_id }: { server_id: string }) => (
		<div data-testid="detail-chart">{server_id}</div>
	),
}));

vi.mock("@/components/ServerDetailOverview", () => ({
	default: ({ server_id }: { server_id: string }) => (
		<div data-testid="detail-overview">{server_id}</div>
	),
}));

vi.mock("@/components/TabSwitch", () => ({
	default: ({
		tabs,
		setCurrentTab,
	}: {
		tabs: string[];
		setCurrentTab: (tab: string) => void;
	}) => (
		<div>
			{tabs.map((tab) => (
				<button key={tab} type="button" onClick={() => setCurrentTab(tab)}>
					{tab}
				</button>
			))}
		</div>
	),
}));

function LocationProbe() {
	const location = useLocation();
	return <p>{location.pathname}</p>;
}

describe("simple pages", () => {
	it("renders explicit and translated error messages", () => {
		const { rerender } = render(<ErrorPage code={418} message="short" />);

		expect(screen.getByText("418")).toBeInTheDocument();
		expect(screen.getByText("short")).toBeInTheDocument();

		rerender(<ErrorPage />);
		expect(screen.getByText("error.somethingWentWrong")).toBeInTheDocument();
	});

	it("navigates back home from the not found page", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/missing"]}>
				<Routes>
					<Route
						path="/missing"
						element={
							<>
								<NotFound />
								<LocationProbe />
							</>
						}
					/>
					<Route
						path="/"
						element={
							<>
								<p>home</p>
								<LocationProbe />
							</>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText("404")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "error.backToHome" }));
		expect(screen.getByText("home")).toBeInTheDocument();
		expect(screen.getByText("/")).toBeInTheDocument();
	});
});

describe("ServerDetail", () => {
	beforeEach(() => {
		vi.stubGlobal("scrollTo", vi.fn());
	});

	it("renders detail tab by default and can switch to network tab", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/server/7"]}>
				<Routes>
					<Route path="/server/:id" element={<ServerDetail />} />
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByTestId("detail-overview")).toHaveTextContent("7");
		expect(screen.getByTestId("detail-chart")).toHaveTextContent("7");
		expect(screen.queryByTestId("network-chart")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Network" }));
		expect(await screen.findByTestId("network-chart")).toHaveTextContent(
			"7:true",
		);
		expect(screen.queryByTestId("detail-chart")).not.toBeInTheDocument();
	});

	it("redirects when route params are missing", async () => {
		render(
			<MemoryRouter initialEntries={["/server"]}>
				<Routes>
					<Route path="/server" element={<ServerDetail />} />
					<Route path="/404" element={<p>redirected</p>} />
				</Routes>
			</MemoryRouter>,
		);

		expect(await screen.findByText("redirected")).toBeInTheDocument();
	});
});
