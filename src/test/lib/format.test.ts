import { describe, expect, it } from "vitest";

import { formatBytes } from "@/lib/format";

describe("formatBytes", () => {
	it("formats empty byte values as zero KiB", () => {
		expect(formatBytes(0)).toBe("0 KiB");
		expect(formatBytes(Number.NaN)).toBe("0 KiB");
	});

	it("keeps byte values in binary units", () => {
		expect(formatBytes(512)).toBe("0.50 KiB");
		expect(formatBytes(1024)).toBe("1.00 KiB");
		expect(formatBytes(1024 ** 2)).toBe("1.00 MiB");
		expect(formatBytes(1024 ** 3 * 2.5, 1)).toBe("2.5 GiB");
	});

	it("clamps negative decimal precision to an integer", () => {
		expect(formatBytes(1536, -1)).toBe("2 KiB");
	});
});
