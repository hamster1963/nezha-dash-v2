import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useActiveIndicator } from "@/hooks/use-active-indicator";
import { useBackground } from "@/hooks/use-background";
import { useChartHistory } from "@/hooks/use-chart-history";

function BackgroundProbe() {
	const { backgroundImage, updateBackground } = useBackground();

	return (
		<div>
			<p>{backgroundImage ?? "empty"}</p>
			<button type="button" onClick={() => updateBackground("/bg.png")}>
				set
			</button>
			<button type="button" onClick={() => updateBackground(undefined)}>
				clear
			</button>
		</div>
	);
}

function ActiveIndicatorProbe({
	active,
	items,
}: {
	active: string;
	items: string[];
}) {
	const { containerRef, enableIndicatorAnimation, indicator, setItemRef } =
		useActiveIndicator(items, active);

	return (
		<div>
			<div ref={containerRef}>
				{items.map((item, index) => (
					<div
						key={item}
						ref={setItemRef(index)}
						data-testid={`item-${item}`}
						onClick={enableIndicatorAnimation}
					>
						{item}
					</div>
				))}
			</div>
			<p>
				{indicator ? `${indicator.width}:${indicator.shouldAnimate}` : "none"}
			</p>
		</div>
	);
}

describe("useBackground", () => {
	it("updates the global background image and broadcasts changes", async () => {
		const user = userEvent.setup();
		render(<BackgroundProbe />);

		expect(screen.getByText("empty")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "set" }));
		expect(window.CustomBackgroundImage).toBe("/bg.png");
		expect(screen.getByText("/bg.png")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "clear" }));
		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("restores a saved background image during polling", async () => {
		vi.useFakeTimers();
		sessionStorage.setItem("savedBackgroundImage", "/saved.png");
		render(<BackgroundProbe />);

		act(() => {
			vi.advanceTimersByTime(100);
		});

		expect(screen.getByText("/saved.png")).toBeInTheDocument();
	});
});

describe("useChartHistory", () => {
	it("formats websocket message history once and keeps newest data last", () => {
		const history = [
			{ now: 2, servers: [] },
			{ now: 1, servers: [] },
		];
		const formatFn = vi.fn((wsData: { now: number }, serverId: number) =>
			serverId === 1 ? wsData.now : null,
		);

		const { result, rerender } = renderHook(
			({ messages }) => useChartHistory(messages, 1, formatFn),
			{ initialProps: { messages: history } },
		);

		expect(result.current).toEqual([1, 2]);
		expect(formatFn).toHaveBeenCalledTimes(2);

		rerender({ messages: [...history, { now: 3, servers: [] }] });
		expect(result.current).toEqual([1, 2]);
	});
});

describe("useActiveIndicator", () => {
	it("tracks the active item and clears when it is not available", async () => {
		Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
			configurable: true,
			get() {
				return 20;
			},
		});
		Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
			configurable: true,
			get() {
				return 10;
			},
		});

		const { rerender } = render(
			<ActiveIndicatorProbe active="One" items={["One", "Two"]} />,
		);

		expect(screen.getByText("20:false")).toBeInTheDocument();
		rerender(<ActiveIndicatorProbe active="Missing" items={["One", "Two"]} />);
		expect(screen.getByText("none")).toBeInTheDocument();
	});
});
