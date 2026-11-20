import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrafficTab } from "@/features/server-detail/TrafficTab";

vi.mock("@/hooks/use-login-user", () => ({
	useLoginUser: () => ({ isAuthenticated: true }),
}));

vi.mock("@/hooks/use-metric-history", () => ({
	useMetricHistory: () => ({
		data: [
			[
				{ ts: Date.now() - 60 * 60 * 1000, value: 100 },
				{ ts: Date.now(), value: 200 },
			],
			[
				{ ts: Date.now() - 60 * 60 * 1000, value: 300 },
				{ ts: Date.now(), value: 500 },
			],
		],
		status: "success",
		isLoading: false,
	}),
}));

vi.mock("@/components/ui/chart", () => ({
	ChartContainer: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	ChartTooltip: () => null,
}));

vi.mock("recharts", () => ({
	Bar: ({ dataKey, hide }: { dataKey: string; hide?: boolean }) => (
		<div
			data-testid="traffic-bar"
			data-key={dataKey}
			data-hidden={hide ? "true" : "false"}
		/>
	),
	BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
}));

describe("TrafficTab", () => {
	it("keeps stacked bars mounted in a stable order when switching metrics", () => {
		render(<TrafficTab server_id={7} />);

		const getBars = () =>
			screen.getAllByTestId("traffic-bar").map((bar) => ({
				key: bar.getAttribute("data-key"),
				hidden: bar.getAttribute("data-hidden"),
			}));

		expect(getBars()).toEqual([
			{ key: "download", hidden: "false" },
			{ key: "upload", hidden: "false" },
		]);

		fireEvent.click(
			screen.getByRole("button", { name: /serverTraffic.upload/ }),
		);
		expect(getBars()).toEqual([
			{ key: "download", hidden: "true" },
			{ key: "upload", hidden: "false" },
		]);

		fireEvent.click(
			screen.getByRole("button", { name: /serverTraffic.total/ }),
		);
		expect(getBars()).toEqual([
			{ key: "download", hidden: "false" },
			{ key: "upload", hidden: "false" },
		]);
	});
});
