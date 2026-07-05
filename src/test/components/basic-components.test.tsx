import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AnimateCountClient, { AnimateCount } from "@/components/AnimatedCount";
import ErrorBoundary from "@/components/ErrorBoundary";
import ChartSkeleton from "@/components/loading/ChartSkeleton";
import { Loader, LoadingSpinner } from "@/components/loading/Loader";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import { SearchButton } from "@/components/SearchButton";
import ServerOverview from "@/components/ServerOverview";
import ServerUsageBar from "@/components/ServerUsageBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { CommandProvider } from "@/context/command-provider";
import { StatusProvider } from "@/context/status-provider";
import { useCommand } from "@/hooks/use-command";
import { useStatus } from "@/hooks/use-status";

function BrokenComponent(): never {
	throw new Error("render failed");
}

function CommandReadout() {
	const { isOpen } = useCommand();
	return <p>{isOpen ? "command-open" : "command-closed"}</p>;
}

function StatusReadout() {
	const { status } = useStatus();
	return <p>{`status:${status}`}</p>;
}

describe("basic display components", () => {
	it("renders animated counts with padded digits", () => {
		render(<AnimateCount minDigits={3}>{7}</AnimateCount>);

		expect(screen.getAllByText("0")).toHaveLength(4);
		expect(screen.getAllByText("7")).toHaveLength(1);
	});

	it("keeps the animated count client stable across count changes", () => {
		const { rerender } = render(
			<AnimateCountClient count={1} minDigits={2} className="count" />,
		);

		expect(screen.getAllByText("1")).toHaveLength(2);
		rerender(<AnimateCountClient count={2} minDigits={2} className="count" />);
		expect(screen.getByText("2")).toBeInTheDocument();
	});

	it("renders server usage colors for healthy, warning, and critical values", () => {
		const { rerender } = render(<ServerUsageBar value={70} />);
		expect(screen.getByRole("progressbar").firstElementChild).toHaveClass(
			"bg-green-500",
		);

		rerender(<ServerUsageBar value={71} />);
		expect(screen.getByRole("progressbar").firstElementChild).toHaveClass(
			"bg-orange-400",
		);

		rerender(<ServerUsageBar value={91} />);
		expect(screen.getByRole("progressbar").firstElementChild).toHaveClass(
			"bg-red-500",
		);
	});

	it("renders loading primitives", () => {
		const { container } = render(
			<>
				<Loader visible={true} />
				<LoadingSpinner />
				<ChartSkeleton width={120} height="40%" />
				<NetworkChartLoading />
			</>,
		);

		expect(
			container.querySelector("[data-visible='true']"),
		).toBeInTheDocument();
		expect(container.querySelectorAll(".hamster-loading-bar")).toHaveLength(16);
		expect(container.querySelector(".animate-spin")).toBeInTheDocument();
		expect(container.querySelector(".h-\\[250px\\]")).toBeInTheDocument();
	});

	it("catches render errors with ErrorBoundary", () => {
		render(
			<ErrorBoundary>
				<BrokenComponent />
			</ErrorBoundary>,
		);

		expect(screen.getByText("500")).toBeInTheDocument();
		expect(screen.getByText("render failed")).toBeInTheDocument();
	});
});

describe("interactive app controls", () => {
	it("opens command search from the search button", async () => {
		const user = userEvent.setup();
		render(
			<CommandProvider>
				<SearchButton />
				<CommandReadout />
			</CommandProvider>,
		);

		expect(screen.getByText("command-closed")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Search" }));
		expect(screen.getByText("command-open")).toBeInTheDocument();
	});

	it("lets overview cards update the global status filter", () => {
		render(
			<StatusProvider>
				<ServerOverview
					total={3}
					online={2}
					offline={1}
					up={1024}
					down={2048}
					upSpeed={512}
					downSpeed={256}
				/>
				<StatusReadout />
			</StatusProvider>,
		);

		expect(screen.getByText("status:all")).toBeInTheDocument();
		fireEvent.click(screen.getByText("serverOverview.onlineServers"));
		expect(screen.getByText("status:online")).toBeInTheDocument();
		fireEvent.click(screen.getByText("serverOverview.offlineServers"));
		expect(screen.getByText("status:offline")).toBeInTheDocument();
		fireEvent.click(screen.getByText("serverOverview.totalServers"));
		expect(screen.getByText("status:all")).toBeInTheDocument();
	});
});

describe("ui primitives", () => {
	it("forwards classes and events through Button and Input", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		const onChange = vi.fn();
		render(
			<>
				<Button variant="secondary" size="sm" onClick={onClick}>
					Save
				</Button>
				<Input placeholder="Name" onChange={onChange} />
			</>,
		);

		await user.click(screen.getByRole("button", { name: "Save" }));
		await user.type(screen.getByPlaceholderText("Name"), "edge");

		expect(onClick).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
			"bg-secondary",
		);
	});

	it("renders skeletons and separators with expected orientation classes", () => {
		const { container } = render(
			<>
				<Skeleton data-testid="skeleton" className="h-4" />
				<Separator data-testid="horizontal" />
				<Separator data-testid="vertical" orientation="vertical" />
			</>,
		);

		expect(screen.getByTestId("skeleton")).toHaveClass("animate-pulse", "h-4");
		expect(screen.getByTestId("horizontal")).toHaveClass("h-px", "w-full");
		expect(screen.getByTestId("vertical")).toHaveClass("h-full", "w-px");
		expect(container.querySelectorAll("[data-orientation]")).toHaveLength(2);
	});
});
