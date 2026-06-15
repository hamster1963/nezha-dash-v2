import { describe, expect, it } from "vitest";

import { geoJsonString } from "@/lib/geo-json-string";
import { countryCoordinates } from "@/lib/geo-limit";

describe("static geographic data", () => {
	it("provides known country coordinate metadata", () => {
		expect(countryCoordinates.CN).toMatchObject({
			lat: 35,
			lng: 105,
			name: "China",
		});
		expect(countryCoordinates.US.name).toBe("United States");
	});

	it("ships parseable GeoJSON feature collection data", () => {
		const geoJson = JSON.parse(geoJsonString) as {
			type: string;
			features: unknown[];
		};

		expect(geoJson.type).toBe("FeatureCollection");
		expect(geoJson.features.length).toBeGreaterThan(0);
	});
});
