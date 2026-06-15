import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingInfo from "@/components/billingInfo";
import MapTooltip from "@/components/MapTooltip";
import PlanInfo from "@/components/PlanInfo";
import ServerFlag from "@/components/ServerFlag";
import { TooltipProvider } from "@/context/tooltip-provider";
import { useTooltip } from "@/hooks/use-tooltip";
import type { PublicNoteData } from "@/lib/utils";

const planData: PublicNoteData = {
	planDataMod: {
		bandwidth: "1Gbps",
		trafficVol: "2TB",
		trafficType: "monthly",
		IPv4: "1",
		IPv6: "1",
		networkRoute: "CN2,CMI",
		extra: "Premium,Backup",
	},
};

function TooltipSeeder() {
	const { setTooltipData } = useTooltip();

	useEffect(() => {
		setTooltipData({
			centroid: [12, 34],
			country: "China",
			count: 2,
			servers: [
				{ id: 1, name: "edge-1", status: true },
				{ id: 2, name: "edge-2", status: false },
			],
		});
	}, [setTooltipData]);

	return null;
}

function LocationProbe() {
	const location = useLocation();
	return <p>{location.pathname}</p>;
}

describe("PlanInfo and BillingInfo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2025-01-15T00:00:00.000Z"));
	});

	it("renders plan badges for every supported public note field", () => {
		render(<PlanInfo parsedData={planData} />);

		expect(screen.getByText("1Gbps")).toBeInTheDocument();
		expect(screen.getByText("2TB")).toBeInTheDocument();
		expect(screen.getByText("IPv4")).toBeInTheDocument();
		expect(screen.getByText("IPv6")).toBeInTheDocument();
		expect(screen.getByText("CN2｜CMI")).toBeInTheDocument();
		expect(screen.getByText("Premium")).toBeInTheDocument();
		expect(screen.getByText("Backup")).toBeInTheDocument();
	});

	it("renders active, free, usage-based, indefinite, and expired billing states", () => {
		const { rerender } = render(
			<BillingInfo
				parsedData={{
					billingDataMod: {
						startDate: "2025-01-01T00:00:00.000Z",
						endDate: "2025-01-31T00:00:00.000Z",
						autoRenewal: "0",
						cycle: "monthly",
						amount: "10",
					},
				}}
			/>,
		);

		expect(
			screen.getByText("billingInfo.price: 10/monthly"),
		).toBeInTheDocument();
		expect(screen.getByText(/billingInfo.remaining: 16/)).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toBeInTheDocument();

		rerender(
			<BillingInfo
				parsedData={{
					billingDataMod: {
						startDate: "",
						endDate: "",
						autoRenewal: "0",
						cycle: "",
						amount: "0",
					},
				}}
			/>,
		);
		expect(screen.getByText("billingInfo.free")).toBeInTheDocument();

		rerender(
			<BillingInfo
				parsedData={{
					billingDataMod: {
						startDate: "",
						endDate: "",
						autoRenewal: "0",
						cycle: "",
						amount: "-1",
					},
				}}
			/>,
		);
		expect(screen.getByText("billingInfo.usage-baseed")).toBeInTheDocument();

		rerender(
			<BillingInfo
				parsedData={{
					billingDataMod: {
						startDate: "2025-01-01",
						endDate: "0000-00-00",
						autoRenewal: "0",
						cycle: "",
						amount: "",
					},
				}}
			/>,
		);
		expect(screen.getByText(/billingInfo.indefinite/)).toBeInTheDocument();

		rerender(
			<BillingInfo
				parsedData={{
					billingDataMod: {
						startDate: "2024-01-01",
						endDate: "2024-01-31",
						autoRenewal: "0",
						cycle: "monthly",
						amount: "10",
					},
				}}
			/>,
		);
		expect(screen.getByText(/billingInfo.expired/)).toBeInTheDocument();
	});
});

describe("MapTooltip", () => {
	it("renders tooltip data and navigates to selected servers", async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/"]}>
				<TooltipProvider>
					<TooltipSeeder />
					<MapTooltip />
					<LocationProbe />
				</TooltipProvider>
			</MemoryRouter>,
		);

		expect(await screen.findByText("Mainland China")).toBeInTheDocument();
		expect(screen.getByText("2 map.Servers")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /edge-2/ }));

		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
		expect(screen.getByText("/server/2")).toBeInTheDocument();
	});
});

describe("ServerFlag", () => {
	it("uses SVG flag classes when emoji flags are forced off", () => {
		Object.assign(window, { ForceUseSvgFlag: true });
		const { container } = render(<ServerFlag country_code="us" />);

		expect(container.querySelector(".fi-us")).toBeInTheDocument();
	});

	it("uses emoji flags when the canvas probe detects support", async () => {
		Object.assign(window, { ForceUseSvgFlag: false });
		const originalCreateElement = document.createElement.bind(document);
		const canvasContext = {
			fillStyle: "",
			textBaseline: "",
			font: "",
			fillText: vi.fn(),
			getImageData: vi.fn(() => ({
				data: new Uint8ClampedArray([0, 0, 0, 255]),
			})),
		} as unknown as CanvasRenderingContext2D;
		vi.spyOn(document, "createElement").mockImplementation(
			(tagName, options) => {
				if (tagName === "canvas") {
					return {
						getContext: vi.fn(() => canvasContext),
					} as unknown as HTMLCanvasElement;
				}

				return originalCreateElement(tagName, options);
			},
		);

		const { container } = render(<ServerFlag country_code="US" />);

		await waitFor(() => {
			expect(container).toHaveTextContent("🇺🇸");
		});
		expect(container.querySelector(".fi-US")).not.toBeInTheDocument();
	});

	it("renders nothing for missing country codes", () => {
		Object.assign(window, { ForceUseSvgFlag: true });
		const { container } = render(<ServerFlag country_code="" />);

		expect(container).toBeEmptyDOMElement();
	});
});
