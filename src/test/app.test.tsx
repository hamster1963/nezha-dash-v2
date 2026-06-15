import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { createTestQueryClient } from "@/test/utils";

const appMocks = vi.hoisted(() => ({
	backgroundImage: undefined as string | undefined,
	fetchSetting: vi.fn(),
	injectContext: vi.fn(),
	setTheme: vi.fn(),
}));

vi.mock("../components/DashCommand", () => ({
	DashCommand: () => <div>dash-command</div>,
}));

vi.mock("../components/Footer", () => ({
	default: () => <footer>footer</footer>,
}));

vi.mock("../components/Header", () => ({
	default: () => <header>header</header>,
	RefreshToast: () => <div>refresh-toast</div>,
}));

vi.mock("../pages/Server", () => ({
	default: () => <div>server-page</div>,
}));

vi.mock("../pages/ServerDetail", () => ({
	default: () => <div>server-detail-page</div>,
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

	return render(
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>,
	);
}

describe("App", () => {
	beforeEach(() => {
		appMocks.backgroundImage = undefined;
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

	it("injects custom code before showing the app shell", async () => {
		appMocks.fetchSetting.mockResolvedValue(
			settingResponse("<script>custom</script>"),
		);

		renderApp();

		await waitFor(() => {
			expect(appMocks.injectContext).toHaveBeenCalledWith(
				"<script>custom</script>",
			);
		});
		expect(await screen.findByText("server-page")).toBeInTheDocument();
	});

	it("renders fetch errors through the error page", async () => {
		appMocks.fetchSetting.mockRejectedValue(new Error("settings failed"));

		renderApp();

		expect(await screen.findByText("settings failed")).toBeInTheDocument();
	});

	it("routes server detail paths through the app router", async () => {
		renderApp("/server/42");

		expect(await screen.findByText("server-detail-page")).toBeInTheDocument();
	});
});
