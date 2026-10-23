import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocalErrorBoundary from "@/components/LocalErrorBoundary";
import RetryableLazy from "@/components/RetryableLazy";

function Content({ broken, label }: { broken: boolean; label: string }) {
	if (broken) throw new Error("render failed");
	return <p>{label}</p>;
}

describe("local error recovery", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("retries a failed section without replacing its healthy sibling", () => {
		const onRetry = vi.fn();
		const ui = (broken: boolean) => (
			<>
				<p>healthy sibling</p>
				<LocalErrorBoundary title="CPU" onRetry={onRetry}>
					<Content broken={broken} label="CPU recovered" />
				</LocalErrorBoundary>
			</>
		);
		const { rerender } = render(ui(true));
		const sibling = screen.getByText("healthy sibling");
		expect(screen.getByRole("alert", { name: "CPU" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(screen.getByRole("alert")).toBeInTheDocument();
		rerender(ui(false));
		expect(screen.queryByText("CPU recovered")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(screen.getByText("CPU recovered")).toBeInTheDocument();
		expect(screen.getByText("healthy sibling")).toBe(sibling);
		expect(onRetry).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("resets an error when the server or period scope changes", () => {
		const { rerender } = render(
			<LocalErrorBoundary resetKey="7:realtime">
				<Content broken label="old server" />
			</LocalErrorBoundary>,
		);
		rerender(
			<LocalErrorBoundary resetKey="8:1d">
				<Content broken={false} label="new server" />
			</LocalErrorBoundary>,
		);
		expect(screen.getByText("new server")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it.each([
		new Error("module initialization failed"),
		new TypeError("Failed to fetch"),
		new SyntaxError("Unexpected token"),
		"loader rejected without an Error",
	])("creates a fresh lazy identity for non-asset loader failures: %s", async (error) => {
		const load = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValue({ default: () => <p>chunk recovered</p> });
		render(
			<RetryableLazy
				load={load}
				componentProps={{}}
				fallback={<p>loading chunk</p>}
			/>,
		);
		expect(screen.getByText("loading chunk")).toBeInTheDocument();
		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(load).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole("button", { name: "error.reloadPage" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(await screen.findByText("chunk recovered")).toBeInTheDocument();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it.each([
		"Failed to fetch dynamically imported module: https://example.test/assets/ServerDetail.abc.js",
		"error loading dynamically imported module: https://example.test/assets/ServerDetail.abc.js",
		"Importing a module script failed.",
		"Unable to preload CSS for /assets/ServerDetail.abc.css",
	])("offers an explicit page reload for a cached asset rejection: %s", async (message) => {
		const cachedRejection = new TypeError(message);
		const load = vi.fn().mockRejectedValue(cachedRejection);
		const reload = vi.fn();
		vi.stubGlobal(
			"window",
			new Proxy(window, {
				get: (target, key) =>
					key === "location" ? { reload } : Reflect.get(target, key, target),
			}),
		);
		render(
			<>
				<p>healthy shell</p>
				<RetryableLazy
					load={load}
					componentProps={{}}
					fallback={<p>loading chunk</p>}
				/>
			</>,
		);
		const shell = screen.getByText("healthy shell");
		await screen.findByRole("alert");
		expect(screen.getByText("healthy shell")).toBe(shell);
		expect(screen.queryByRole("button", { name: "error.retry" })).toBeNull();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(reload).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "error.reloadPage" }));
		expect(reload).toHaveBeenCalledTimes(1);
		expect(load).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		vi.unstubAllGlobals();
	});

	it("does not mistake a render or query error for an asset rejection", async () => {
		let broken = true;
		const Loaded = () => {
			if (broken) {
				throw new TypeError(
					"Failed to fetch dynamically imported module: render data",
				);
			}
			return <p>render recovered</p>;
		};
		const load = vi.fn().mockResolvedValue({ default: Loaded });
		render(
			<RetryableLazy
				load={load}
				componentProps={{}}
				fallback={<p>loading chunk</p>}
			/>,
		);
		await screen.findByRole("alert");
		broken = false;
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(screen.getByText("render recovered")).toBeInTheDocument();
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("uses an already loaded component synchronously and retries render errors without reloading it", () => {
		let broken = true;
		const Loaded = () => <Content broken={broken} label="preloaded content" />;
		const load = vi.fn();
		render(
			<RetryableLazy
				load={load}
				getPreloaded={() => Loaded}
				componentProps={{}}
				fallback={<p>loading chunk</p>}
			/>,
		);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		broken = false;
		fireEvent.click(screen.getByRole("button", { name: "error.retry" }));
		expect(screen.getByText("preloaded content")).toBeInTheDocument();
		expect(screen.queryByText("loading chunk")).not.toBeInTheDocument();
		expect(load).not.toHaveBeenCalled();
	});

	it("renders fulfilled modules synchronously after tab remounts and scope resets", async () => {
		const load = vi.fn().mockResolvedValue({
			default: ({ id }: { id: string }) => <p>cached server {id}</p>,
		});
		const ui = (id: string) => (
			<RetryableLazy
				load={load}
				componentProps={{ id }}
				fallback={<p>loading chunk</p>}
				resetKey={id}
			/>
		);
		const first = render(ui("7"));
		expect(await screen.findByText("cached server 7")).toBeInTheDocument();
		first.unmount();
		const second = render(ui("7"));
		expect(screen.getByText("cached server 7")).toBeInTheDocument();
		expect(screen.queryByText("loading chunk")).not.toBeInTheDocument();
		second.rerender(ui("8"));
		expect(screen.getByText("cached server 8")).toBeInTheDocument();
		expect(screen.queryByText("loading chunk")).not.toBeInTheDocument();
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("retries a rejected lazy section automatically on navigation to another server", async () => {
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error("module initialization failed"))
			.mockResolvedValue({
				default: ({ id }: { id: string }) => <p>server {id}</p>,
			});
		const ui = (id: string) => (
			<RetryableLazy
				load={load}
				componentProps={{ id }}
				fallback={<p>loading chunk</p>}
				resetKey={id}
			/>
		);
		const { rerender } = render(ui("7"));
		await screen.findByRole("alert");
		rerender(ui("8"));
		expect(await screen.findByText("server 8")).toBeInTheDocument();
		expect(load).toHaveBeenCalledTimes(2);
	});
});
