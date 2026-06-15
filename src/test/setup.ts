import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			language: "en-US",
			languages: ["en-US"],
			changeLanguage: vi.fn(),
		},
	}),
}));

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

class IntersectionObserverMock {
	readonly root = null;
	readonly rootMargin = "";
	readonly thresholds = [];

	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
	takeRecords = vi.fn(() => []);
}

Object.defineProperty(globalThis, "ResizeObserver", {
	writable: true,
	value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
	writable: true,
	value: IntersectionObserverMock,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
	configurable: true,
	value: vi.fn(),
});

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
	configurable: true,
	value: vi.fn(() => false),
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
	configurable: true,
	value: vi.fn(),
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
	configurable: true,
	value: vi.fn(),
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	sessionStorage.clear();
	document.head
		.querySelectorAll('meta[name="theme-color"], [data-injected]')
		.forEach((node) => {
			node.remove();
		});
	document.body.querySelectorAll("[data-injected]").forEach((node) => {
		node.remove();
	});
	document.documentElement.className = "";
	document.documentElement.removeAttribute("style");
	Object.defineProperty(document, "cookie", {
		configurable: true,
		value: "",
	});
	window.CustomBackgroundImage = "";
	window.CustomMobileBackgroundImage = "";
	window.ForceShowServices = false;
	window.ForceCardInline = false;
	window.ForceShowMap = false;
	window.ForcePeakCutEnabled = false;
	window.ForceSortType = undefined;
	window.ForceSortOrder = undefined;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
