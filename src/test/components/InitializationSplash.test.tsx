import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InitializationSplash from "@/components/loading/InitializationSplash";

describe("InitializationSplash", () => {
	it("centers the bundled logo on a theme-aware viewport with a screen-reader-only status", () => {
		render(<InitializationSplash />);
		const status = screen.getByRole("status");
		expect(status).toHaveClass(
			"fixed",
			"inset-0",
			"items-center",
			"justify-center",
			"bg-background",
		);
		expect(
			within(status).getByText("Loading dashboard configuration…"),
		).toHaveClass("sr-only");
		const logo = status.querySelector("img");
		expect(logo).toHaveAttribute("src", "/apple-touch-icon.png");
		expect(logo).toHaveAttribute("alt", "");
		expect(logo).toHaveAttribute("aria-hidden", "true");
		expect(logo).toHaveClass("invert", "dark:invert-0");
	});

	it("uses available custom branding without recoloring or waiting for it", () => {
		const { rerender } = render(<InitializationSplash />);
		rerender(<InitializationSplash logo="/brand.svg" />);
		const logo = screen.getByRole("status").querySelector("img");
		expect(logo).toHaveAttribute("src", "/brand.svg");
		expect(logo).not.toHaveClass("invert");
		expect(logo).not.toHaveClass("mix-blend-multiply");
		rerender(<InitializationSplash />);
		expect(logo).toHaveAttribute("src", "/apple-touch-icon.png");
	});

	it("falls back after a custom logo fails and accepts a replacement", () => {
		const { rerender } = render(<InitializationSplash logo="/missing.svg" />);
		const logo = screen.getByRole("status").querySelector("img");
		expect(logo).not.toBeNull();
		if (!logo) throw new Error("Missing splash logo");
		fireEvent.error(logo);
		expect(logo).toHaveAttribute("src", "/apple-touch-icon.png");
		expect(logo).toHaveClass("invert");
		// Even a missing bundled asset must not retry the broken custom URL.
		fireEvent.error(logo);
		expect(logo).toHaveAttribute("src", "/apple-touch-icon.png");
		rerender(<InitializationSplash logo="/replacement.svg" />);
		expect(logo).toHaveAttribute("src", "/replacement.svg");
	});
});
