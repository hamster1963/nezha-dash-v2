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

	it("creates a fresh lazy identity after rejection and actually calls the loader again", async () => {
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error("chunk unavailable"))
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
			.mockRejectedValueOnce(new Error("chunk unavailable"))
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
