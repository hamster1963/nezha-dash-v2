import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Link } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { createSettingResponse } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/utils";

const mocks = vi.hoisted(() => ({
	loadDetail: vi.fn(),
	serverBroken: false,
}));

vi.mock("@/lib/server-detail-preload", () => ({
	get loadServerDetail() {
		return mocks.loadDetail;
	},
	getPreloadedServerDetail: () => undefined,
	preloadServerDetail: vi.fn(),
}));
vi.mock("@/components/Header", () => ({
	default: () => (
		<header>
			header
			<Link to="/">home</Link>
			<Link to="/server/8">next server</Link>
		</header>
	),
	RefreshToast: () => null,
}));
vi.mock("@/components/Footer", () => ({
	default: () => <footer>footer</footer>,
}));
vi.mock("@/components/DashCommand", () => ({
	DashCommand: () => <p>command</p>,
}));
vi.mock("@/pages/Server", () => ({
	default: () => {
		if (mocks.serverBroken) throw new Error("server page render failed");
		return <p>server page</p>;
	},
}));
vi.mock("@/hooks/use-background", () => ({
	useBackground: () => ({ backgroundImage: undefined }),
}));
vi.mock("@/hooks/use-theme", () => ({
	useTheme: () => ({ setTheme: vi.fn() }),
}));
vi.mock("@/lib/inject", () => ({
	InjectContext: () => Promise.resolve(),
}));
vi.mock("@/lib/nezha-api", () => ({
	fetchSetting: () => Promise.resolve(createSettingResponse()),
}));

function renderApp(route = "/server/7") {
	window.history.pushState({}, "", route);
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			<App />
		</QueryClientProvider>,
	);
}

describe("page error boundaries", () => {
	beforeEach(() => {
		mocks.serverBroken = false;
		mocks.loadDetail = vi.fn();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("keeps Header, Footer and command UI mounted after detail chunk rejection, then retries the import", async () => {
		mocks.loadDetail.mockRejectedValue(new Error("chunk unavailable"));
		renderApp();
		await screen.findByRole("alert", { name: "error.detailPageFailed" });
		const header = screen.getByRole("banner");
		const footer = screen.getByRole("contentinfo");
		expect(screen.getByText("command")).toBeInTheDocument();
		const initialAttempts = mocks.loadDetail.mock.calls.length;
		mocks.loadDetail.mockResolvedValue({
			default: () => <p>detail recovered</p>,
		});
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(await screen.findByText("detail recovered")).toBeInTheDocument();
		expect(mocks.loadDetail).toHaveBeenCalledTimes(initialAttempts + 1);
		expect(screen.getByRole("banner")).toBe(header);
		expect(screen.getByRole("contentinfo")).toBe(footer);
	});

	it("recovers from repeated rejected chunks by navigating to another server", async () => {
		mocks.loadDetail.mockRejectedValue(new Error("chunk unavailable"));
		renderApp();
		await screen.findByRole("alert");
		const initialAttempts = mocks.loadDetail.mock.calls.length;
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		await screen.findByRole("alert");
		expect(mocks.loadDetail).toHaveBeenCalledTimes(initialAttempts + 1);
		mocks.loadDetail.mockResolvedValue({
			default: () => <p>next detail page</p>,
		});
		fireEvent.click(screen.getByRole("link", { name: "next server" }));
		expect(await screen.findByText("next detail page")).toBeInTheDocument();
		expect(mocks.loadDetail).toHaveBeenCalledTimes(initialAttempts + 2);
		fireEvent.click(screen.getByRole("link", { name: "home" }));
		expect(screen.getByText("server page")).toBeInTheDocument();
	});

	it("contains a home-page render failure and resets on navigation", async () => {
		mocks.serverBroken = true;
		mocks.loadDetail.mockResolvedValue({
			default: () => <p>detail page</p>,
		});
		renderApp("/");
		await screen.findByRole("alert");
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("link", { name: "next server" }));
		expect(await screen.findByText("detail page")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
