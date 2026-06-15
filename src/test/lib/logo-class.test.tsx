import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	GetFontLogoClass,
	GetOsName,
	MageMicrosoftWindows,
} from "@/lib/logo-class";

describe("logo-class helpers", () => {
	it("maps known platform aliases to font logo classes", () => {
		expect(GetFontLogoClass("ubuntu")).toBe("ubuntu");
		expect(GetFontLogoClass("darwin")).toBe("apple");
		expect(GetFontLogoClass("linux")).toBe("tux");
		expect(GetFontLogoClass("amazon")).toBe("redhat");
		expect(GetFontLogoClass("arch")).toBe("archlinux");
		expect(GetFontLogoClass("opensuse-tumbleweed")).toBe("opensuse");
		expect(GetFontLogoClass("unknown")).toBe("tux");
	});

	it("maps platform aliases to readable operating system names", () => {
		expect(GetOsName("ubuntu")).toBe("Ubuntu");
		expect(GetOsName("darwin")).toBe("macOS");
		expect(GetOsName("linux")).toBe("Linux");
		expect(GetOsName("amazon")).toBe("Redhat");
		expect(GetOsName("arch")).toBe("Archlinux");
		expect(GetOsName("opensuse-tumbleweed")).toBe("Opensuse");
		expect(GetOsName("unknown")).toBe("Linux");
	});

	it("renders the Windows SVG icon", () => {
		render(<MageMicrosoftWindows data-testid="windows-icon" />);

		expect(screen.getByTestId("windows-icon")).toHaveAttribute(
			"viewBox",
			"0 0 24 24",
		);
	});
});
