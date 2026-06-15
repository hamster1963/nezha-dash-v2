import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import GlobalMap, { InteractiveMap } from "@/components/GlobalMap";
import { TooltipProvider } from "@/context/tooltip-provider";
import { createServer } from "@/test/fixtures";

type InteractiveMapProps = Parameters<typeof InteractiveMap>[0];

const now = Date.parse("2025-01-01T00:00:20.000Z");

function LocationProbe() {
	const location = useLocation();
	return <p>{location.pathname}</p>;
}

function renderMap(ui: React.ReactElement) {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<TooltipProvider>
				{ui}
				<LocationProbe />
			</TooltipProvider>
		</MemoryRouter>,
	);
}

function mapFeature(code: string, name: string) {
	return {
		type: "Feature",
		properties: {
			iso_a2_eh: code,
			iso_a3_eh: `${code}A`,
			name,
		},
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[-100, 30],
					[-90, 30],
					[-90, 40],
					[-100, 40],
					[-100, 30],
				],
			],
		},
	};
}

describe("GlobalMap", () => {
	it("counts unique countries and ignores servers without country codes", () => {
		Object.assign(window, { CustomBackgroundImage: "/background.png" });

		const { container } = renderMap(
			<GlobalMap
				now={now}
				serverList={[
					createServer({ country_code: "us" }),
					createServer({ id: 2, country_code: "US" }),
					createServer({ id: 3, country_code: "sg" }),
					createServer({ id: 4, country_code: "" }),
				]}
			/>,
		);

		expect(
			screen.getByText(/map\.Distributions 2 map\.Regions/),
		).toBeInTheDocument();
		expect(container.querySelector("section")).toHaveClass("bg-card/70");
	});
});

describe("InteractiveMap", () => {
	it("shows country tooltips, navigates from servers, and clears tooltip state", async () => {
		const user = userEvent.setup();
		const filteredFeatures = [
			mapFeature("US", "United States"),
			mapFeature("DE", "Germany"),
		] as unknown as InteractiveMapProps["filteredFeatures"];

		const { container } = renderMap(
			<InteractiveMap
				countries={["US", "SG"]}
				serverCounts={{ US: 2, SG: 1 }}
				width={900}
				height={500}
				filteredFeatures={filteredFeatures}
				nezhaServerList={[
					createServer({
						id: 11,
						name: "us-online",
						country_code: "us",
						last_active: "2025-01-01T00:00:00.000Z",
					}),
					createServer({
						id: 12,
						name: "us-offline",
						country_code: "us",
						last_active: "2024-12-31T00:00:00.000Z",
					}),
					createServer({
						id: 13,
						name: "sg-edge",
						country_code: "sg",
						last_active: "2025-01-01T00:00:00.000Z",
					}),
				]}
				now={now}
			/>,
		);

		const highlightedCountry = container.querySelector("path.fill-green-700");
		expect(highlightedCountry).toBeInTheDocument();

		fireEvent.mouseEnter(highlightedCountry as SVGPathElement);

		expect(await screen.findByText("United States")).toBeInTheDocument();
		expect(screen.getByText("2 map.Servers")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /us-offline/ }));

		expect(sessionStorage.getItem("fromMainPage")).toBe("true");
		expect(screen.getByText("/server/12")).toBeInTheDocument();

		const fallbackMarker = container.querySelector("circle.fill-sky-700");
		expect(fallbackMarker).toBeInTheDocument();

		fireEvent.mouseEnter(fallbackMarker as SVGCircleElement);

		expect(await screen.findByText("Singapore")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /sg-edge/ })).toBeInTheDocument();

		fireEvent.mouseLeave(container.querySelector(".relative") as HTMLElement);

		expect(screen.queryByText("Singapore")).not.toBeInTheDocument();
	});

	it("clears tooltip state for non-highlighted countries and empty map areas", () => {
		const filteredFeatures = [
			mapFeature("US", "United States"),
			mapFeature("DE", "Germany"),
		] as unknown as InteractiveMapProps["filteredFeatures"];

		const { container } = renderMap(
			<InteractiveMap
				countries={["US"]}
				serverCounts={{ US: 1 }}
				width={900}
				height={500}
				filteredFeatures={filteredFeatures}
				nezhaServerList={[
					createServer({
						id: 11,
						name: "us-online",
						country_code: "us",
					}),
				]}
				now={now}
			/>,
		);

		const [highlightedCountry, neutralCountry] = Array.from(
			container.querySelectorAll("path"),
		);
		fireEvent.mouseEnter(highlightedCountry as SVGPathElement);
		expect(screen.getByText("United States")).toBeInTheDocument();

		fireEvent.mouseEnter(neutralCountry as SVGPathElement);
		expect(screen.queryByText("United States")).not.toBeInTheDocument();

		fireEvent.mouseEnter(container.querySelector("rect") as SVGRectElement);
		expect(screen.queryByText("United States")).not.toBeInTheDocument();
	});
});
