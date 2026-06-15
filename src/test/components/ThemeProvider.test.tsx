import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeColorManager } from "@/components/ThemeColorManager";
import {
	ThemeProvider,
	ThemeProviderContext,
} from "@/components/ThemeProvider";
import { useTheme } from "@/hooks/use-theme";

function ThemeProbe() {
	const { setTheme, theme } = useTheme();

	return (
		<div>
			<p data-testid="theme-state">{theme}</p>
			<button type="button" onClick={() => setTheme("dark")}>
				dark
			</button>
			<button type="button" onClick={() => setTheme("light")}>
				light
			</button>
		</div>
	);
}

function InvalidThemeProbe() {
	useTheme();
	return null;
}

describe("ThemeProvider", () => {
	it("applies theme classes, meta color, and localStorage state", async () => {
		const user = userEvent.setup();
		const meta = document.createElement("meta");
		meta.name = "theme-color";
		document.head.appendChild(meta);

		render(
			<ThemeProvider storageKey="theme-test">
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("theme-state")).toHaveTextContent("system");
		expect(document.documentElement).toHaveClass("light");

		await user.click(screen.getByRole("button", { name: "dark" }));

		expect(screen.getByTestId("theme-state")).toHaveTextContent("dark");
		expect(localStorage.getItem("theme-test")).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
		expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
			"content",
			"hsl(30 15% 8%)",
		);

		await user.click(screen.getByRole("button", { name: "light" }));
		expect(document.documentElement).toHaveClass("light");
	});

	it("uses stored theme value as the initial theme", () => {
		localStorage.setItem("theme-test", "dark");

		render(
			<ThemeProvider storageKey="theme-test">
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("theme-state")).toHaveTextContent("dark");
		expect(document.documentElement).toHaveClass("dark");
	});

	it("follows system color scheme changes and cleans up its listener", () => {
		let systemDark = true;
		let changeListener: (() => void) | undefined;
		const addEventListener = vi.fn((_event: string, listener: () => void) => {
			changeListener = listener;
		});
		const removeEventListener = vi.fn();

		vi.mocked(window.matchMedia).mockReturnValue({
			get matches() {
				return systemDark;
			},
			media: "(prefers-color-scheme: dark)",
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener,
			removeEventListener,
			dispatchEvent: vi.fn(),
		} as unknown as MediaQueryList);

		const { unmount } = render(
			<ThemeProvider storageKey="theme-system-test">
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(document.documentElement).toHaveClass("dark");

		act(() => {
			systemDark = false;
			changeListener?.();
		});

		expect(document.documentElement).toHaveClass("light");

		unmount();

		expect(removeEventListener).toHaveBeenCalledWith("change", changeListener);
	});

	it("keeps theme-color meta in sync through ThemeColorManager", () => {
		render(
			<ThemeProvider storageKey="theme-test">
				<ThemeColorManager />
				<ThemeProbe />
			</ThemeProvider>,
		);

		act(() => {
			screen.getByRole("button", { name: "dark" }).click();
		});

		expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
			"content",
			"hsl(30 15% 8%)",
		);
	});

	it("throws when the theme context is explicitly unavailable", () => {
		expect(() =>
			render(
				<ThemeProviderContext.Provider value={undefined as never}>
					<InvalidThemeProbe />
				</ThemeProviderContext.Provider>,
			),
		).toThrow("useTheme must be used within a ThemeProvider");
	});
});
