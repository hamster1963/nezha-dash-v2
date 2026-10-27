import { QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { Link } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { loadServerDetail } from "@/lib/server-detail-preload";
import { createTestQueryClient } from "@/test/utils";

const appMocks = vi.hoisted(() => ({
	backgroundImage: undefined as string | undefined,
	fetchSetting: vi.fn(),
	injectContext: vi.fn(),
	setTheme: vi.fn(),
	detailGate: null as Promise<void> | null,
}));

vi.mock("../components/DashCommand", () => ({
	DashCommand: () => <div>dash-command</div>,
}));

vi.mock("../components/Footer", () => ({
	default: () => <footer>footer</footer>,
}));

vi.mock("../components/Header", () => ({
	default: ({ configurationLoading }: { configurationLoading?: boolean }) => (
		<header aria-busy={configurationLoading}>header</header>
	),
	RefreshToast: () => <div>refresh-toast</div>,
}));

vi.mock("../pages/Server", () => ({
	default: ({ backendError }: { backendError?: Error | null }) => (
		<div>
			<div>server-page</div>
			<Link to="/server/6">open-detail</Link>
			{backendError && <p>{backendError.message}</p>}
		</div>
	),
}));

vi.mock("../pages/ServerDetail", () => ({
	default: () => {
		if (appMocks.detailGate) throw appMocks.detailGate;
		return <div>server-detail-page</div>;
	},
}));

vi.mock("../hooks/use-background", () => ({
	useBackground: () => ({ backgroundImage: appMocks.backgroundImage }),
}));

vi.mock("../hooks/use-theme", () => ({
	useTheme: () => ({ setTheme: appMocks.setTheme }),
}));

vi.mock("../lib/inject", () => ({
	InjectContext: appMocks.injectContext,
}));

vi.mock("../lib/nezha-api", () => ({
	fetchSetting: appMocks.fetchSetting,
}));

function settingResponse(customCode = "") {
	return {
		success: true,
		data: {
			config: {
				debug: false,
				language: "zh-CN",
				site_name: "Nezha",
				user_template: "",
				admin_template: "",
				custom_code: customCode,
			},
			version: "1.0.0",
		},
	};
}

function renderApp(route = "/") {
	window.history.pushState({}, "", route);
	const queryClient = createTestQueryClient();

	return {
		queryClient,
		...render(
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>,
		),
	};
}

describe("App", () => {
	it("renders an already preloaded detail route synchronously without a fallback flash", async () => {
		renderApp("/");
		await screen.findByText("server-page");
		await waitFor(() =>
			expect(screen.getByText("header")).toHaveAttribute("aria-busy", "false"),
		);
		await loadServerDetail();
		fireEvent.click(screen.getByText("open-detail"));
		expect(screen.getByText("server-detail-page")).toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "serviceTracker.loading" }),
		).not.toBeInTheDocument();
	});

	it("shows the detail skeleton instead of an empty route while detail content is loading", async () => {
		let release = () => {};
		appMocks.detailGate = new Promise<void>((resolve) => {
			release = resolve;
		});
		renderApp("/server/6");
		expect(
			await screen.findByRole("status", { name: "serviceTracker.loading" }),
		).toBeInTheDocument();
		expect(screen.getByText("header")).toBeInTheDocument();
		expect(screen.queryByText("server-detail-page")).not.toBeInTheDocument();
		await act(async () => {
			appMocks.detailGate = null;
			release();
		});
		expect(await screen.findByText("server-detail-page")).toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "serviceTracker.loading" }),
		).not.toBeInTheDocument();
	});

	beforeEach(() => {
		appMocks.backgroundImage = undefined;
		appMocks.detailGate = null;
		appMocks.fetchSetting.mockResolvedValue(settingResponse());
		appMocks.injectContext.mockResolvedValue(undefined);
	});

	it("renders the main shell after settings load and applies global theme/background settings", async () => {
		Object.assign(window, {
			ForceTheme: "dark",
			CustomMobileBackgroundImage: "/mobile.png",
		});
		appMocks.backgroundImage = "/desktop.png";

		const { container } = renderApp();

		expect(await screen.findByText("server-page")).toBeInTheDocument();
		expect(screen.getByText("refresh-toast")).toBeInTheDocument();
		expect(screen.getByText("header")).toBeInTheDocument();
		expect(screen.getByText("dash-command")).toBeInTheDocument();
		expect(screen.getByText("footer")).toBeInTheDocument();
		expect(appMocks.setTheme).toHaveBeenCalledWith("dark");
		expect(
			Array.from(container.querySelectorAll<HTMLElement>("[style]")).some(
				(element) => element.style.backgroundImage.includes("/desktop.png"),
			),
		).toBe(true);
		expect(
			Array.from(container.querySelectorAll<HTMLElement>("[style]")).some(
				(element) => element.style.backgroundImage.includes("/mobile.png"),
			),
		).toBe(true);
	});

	it("shows the backend error without blocking the shell", async () => {
		appMocks.fetchSetting.mockRejectedValue(new Error("settings unavailable"));
		renderApp();
		expect(await screen.findByText("settings unavailable")).toBeInTheDocument();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("injects custom code while keeping the app shell visible", async () => {
		appMocks.fetchSetting.mockResolvedValue(
			settingResponse("<script>custom</script>"),
		);

		renderApp();

		await waitFor(() => {
			expect(appMocks.injectContext).toHaveBeenCalledWith(
				"<script>custom</script>",
				expect.objectContaining({ signal: expect.any(AbortSignal) }),
			);
		});
		expect(await screen.findByText("server-page")).toBeInTheDocument();
	});

	it("waits for custom code and reports injection failures without hiding the shell", async () => {
		let reject!: (error: Error) => void;
		appMocks.fetchSetting.mockResolvedValue(
			settingResponse("<script src='/slow.js'></script>"),
		);
		appMocks.injectContext.mockImplementation((code: string) =>
			code
				? new Promise((_, fail) => {
						reject = fail;
					})
				: Promise.resolve(),
		);
		renderApp();
		await waitFor(() => expect(reject).toBeDefined());
		expect(screen.getByText("header")).toHaveAttribute("aria-busy", "true");
		expect(screen.getByText("server-page")).toBeInTheDocument();
		await act(async () => reject(new Error("resource failed")));
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(screen.getByRole("alert")).toHaveTextContent("resource failed");
		expect(screen.getByText("server-page")).toBeInTheDocument();
	});

	it("keeps the shell visible and header busy while fetching settings and initializing scripts", async () => {
		appMocks.injectContext.mockClear();
		let resolveSettings!: (value: ReturnType<typeof settingResponse>) => void;
		let finish!: () => void;
		appMocks.fetchSetting.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveSettings = resolve;
				}),
		);
		appMocks.injectContext.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		renderApp();
		expect(screen.getByText("header")).toHaveAttribute("aria-busy", "true");
		expect(screen.getByText("header")).toBeInTheDocument();
		await act(async () => {});
		expect(screen.getByText("server-page")).toBeInTheDocument();
		expect(appMocks.injectContext).not.toHaveBeenCalled();
		await act(async () =>
			resolveSettings(settingResponse("<script src='/slow.js'></script>")),
		);
		await waitFor(() => expect(finish).toBeDefined());
		expect(screen.getByText("header")).toHaveAttribute("aria-busy", "true");
		expect(screen.getByText("header")).toBeInTheDocument();
		await act(async () => finish());
		expect(screen.getByText("header")).toHaveAttribute("aria-busy", "false");
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		expect(screen.getByText("server-page")).toBeInTheDocument();
	});

	it("ignores stale initialization after configuration replacement and aborts on unmount", async () => {
		let finishOld!: (cleanup: () => void) => void;
		let oldSignal!: AbortSignal;
		appMocks.fetchSetting.mockResolvedValue(settingResponse("old"));
		appMocks.injectContext.mockImplementation(
			(code: string, { signal }: { signal: AbortSignal }) => {
				if (code === "old") {
					oldSignal = signal;
					return new Promise((resolve) => {
						finishOld = resolve;
					});
				}
				return Promise.resolve();
			},
		);
		const { queryClient, unmount } = renderApp();
		await waitFor(() => expect(finishOld).toBeDefined());
		act(() => {
			queryClient.setQueryData(["setting"], settingResponse("new"));
		});
		await waitFor(() => expect(oldSignal.aborted).toBe(true));
		expect(oldSignal.aborted).toBe(true);
		const cleanup = vi.fn();
		await act(async () => finishOld(cleanup));
		expect(cleanup).toHaveBeenCalledOnce();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		const latestSignal =
			appMocks.injectContext.mock.calls[
				appMocks.injectContext.mock.calls.length - 1
			]?.[1].signal;
		unmount();
		expect(latestSignal.aborted).toBe(true);
	});

	it("renders the app shell when initial settings fetch fails", async () => {
		appMocks.fetchSetting.mockRejectedValue(new Error("settings failed"));

		renderApp();

		expect(await screen.findByText("server-page")).toBeInTheDocument();
		expect(screen.getByText("refresh-toast")).toBeInTheDocument();
		expect(screen.getByText("header")).toBeInTheDocument();
		expect(screen.getByText("dash-command")).toBeInTheDocument();
		expect(screen.getByText("footer")).toBeInTheDocument();
		expect(await screen.findByText("settings failed")).toBeInTheDocument();
	});

	it("keeps rendering with stale settings when a later settings refetch fails", async () => {
		let requestCount = 0;
		appMocks.fetchSetting.mockImplementation(() => {
			requestCount += 1;
			return requestCount === 1
				? Promise.resolve(settingResponse())
				: Promise.reject(new Error("settings failed"));
		});

		const { queryClient } = renderApp();

		expect(await screen.findByText("server-page")).toBeInTheDocument();

		await queryClient.refetchQueries({ queryKey: ["setting"] });

		await waitFor(() => {
			expect(appMocks.fetchSetting.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
		expect(screen.getByText("server-page")).toBeInTheDocument();
		expect(screen.queryByText("settings failed")).not.toBeInTheDocument();
	});

	it("routes server detail paths through the app router", async () => {
		renderApp("/server/42");

		expect(await screen.findByText("server-detail-page")).toBeInTheDocument();
	});
});
