import { createContext, type ReactNode, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
	children: ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
	children,
	storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(
		() => (localStorage.getItem(storageKey) as Theme) || "system",
	);

	useEffect(() => {
		const root = window.document.documentElement;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const updateThemeColor = (nextTheme: "light" | "dark") => {
			const themeColor =
				nextTheme === "dark" ? "hsl(30 15% 8%)" : "hsl(0 0% 98%)";
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute("content", themeColor);
		};

		const applyTheme = (nextTheme: "light" | "dark") => {
			root.classList.remove("light", "dark");
			root.classList.add(nextTheme);
			root.style.colorScheme = nextTheme;
			root.style.backgroundColor =
				nextTheme === "dark" ? "hsl(30 15% 8%)" : "hsl(0 0% 98%)";
			updateThemeColor(nextTheme);
		};

		root.classList.add("disable-transitions");

		let cleanupMediaListener: (() => void) | undefined;

		if (theme === "system") {
			const applySystemTheme = () => {
				applyTheme(mediaQuery.matches ? "dark" : "light");
			};

			applySystemTheme();
			mediaQuery.addEventListener("change", applySystemTheme);
			cleanupMediaListener = () =>
				mediaQuery.removeEventListener("change", applySystemTheme);
		} else {
			applyTheme(theme);
		}

		const timeoutId = window.setTimeout(() => {
			root.classList.remove("disable-transitions");
		}, 0);

		return () => {
			window.clearTimeout(timeoutId);
			cleanupMediaListener?.();
		};
	}, [theme]);

	const value = {
		theme,
		setTheme: (theme: Theme) => {
			localStorage.setItem(storageKey, theme);
			setTheme(theme);
		},
	};

	return (
		<ThemeProviderContext.Provider value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export { ThemeProviderContext };
