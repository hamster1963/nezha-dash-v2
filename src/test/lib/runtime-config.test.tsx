import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortProvider } from "@/context/sort-provider";
import { useBackground } from "@/hooks/use-background";
import { useSort } from "@/hooks/use-sort";
import {
	readRuntimeConfig,
	refreshRuntimeConfig,
	useRuntimeConfig,
} from "@/lib/runtime-config";

function Probe() {
	const { sortType, sortOrder } = useSort();
	return (
		<div>
			{sortType}:{sortOrder}
		</div>
	);
}

describe("runtime configuration boundary", () => {
	it("validates legacy globals and keeps stable snapshots", () => {
		window.ForceTheme = "unsupported";
		window.ForceSortType = "invalid";
		window.ForceSortOrder = "invalid";
		expect(readRuntimeConfig()).toMatchObject({
			forceTheme: undefined,
			forceSortType: undefined,
			forceSortOrder: undefined,
		});
		expect(readRuntimeConfig()).toBe(readRuntimeConfig());
	});

	it("notifies an already-mounted sort provider after delayed injection without polling", () => {
		const interval = vi.spyOn(window, "setInterval");
		render(
			<SortProvider>
				<Probe />
			</SortProvider>,
		);
		expect(screen.getByText("default:desc")).toBeInTheDocument();
		act(() => {
			window.ForceSortType = "mem";
			window.ForceSortOrder = "asc";
			refreshRuntimeConfig();
		});
		expect(screen.getByText("mem:asc")).toBeInTheDocument();
		expect(interval).not.toHaveBeenCalled();
	});

	it("observes delayed legacy assignments without an event or polling", async () => {
		vi.useFakeTimers();
		const interval = vi.spyOn(window, "setInterval");
		const { unmount } = render(
			<SortProvider>
				<Probe />
			</SortProvider>,
		);
		setTimeout(() => {
			window.ForceSortType = "mem";
			window.ForceSortOrder = "asc";
		}, 8000);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(8000);
		});
		expect(screen.getByText("mem:asc")).toBeInTheDocument();
		expect(interval).not.toHaveBeenCalled();
		unmount();
		expect(
			Object.getOwnPropertyDescriptor(window, "ForceSortType"),
		).toMatchObject({ value: "mem", writable: true });
	});

	it("publishes display preferences and background assignments", () => {
		const { result } = renderHook(useRuntimeConfig);
		act(() => {
			window.ForceShowServices = true;
			window.ForceShowMap = true;
			window.ForceCardInline = true;
			window.CustomBackgroundImage = "/assigned.png";
		});
		expect(result.current).toMatchObject({
			forceShowServices: true,
			forceShowMap: true,
			forceCardInline: true,
			backgroundImage: "/assigned.png",
		});
	});

	it("publishes identity, card, illustration, and chart settings after mounting", () => {
		const { result } = renderHook(useRuntimeConfig);
		act(() => {
			window.CustomLogo = "/logo.svg";
			window.CustomDesc = "Fleet status";
			window.CustomLinks = '[{"name":"Help","link":"/help"}]';
			window.CustomIllustration = "/fleet.webp";
			window.ShowNetTransfer = true;
			window.FixedTopServerName = true;
			window.ForceUseSvgFlag = true;
			window.DisableAnimatedMan = true;
			window.ForcePeakCutEnabled = true;
		});
		expect(result.current).toMatchObject({
			customLogo: "/logo.svg",
			customDesc: "Fleet status",
			customLinks: '[{"name":"Help","link":"/help"}]',
			customIllustration: "/fleet.webp",
			showNetTransfer: true,
			fixedTopServerName: true,
			forceUseSvgFlag: true,
			disableAnimatedMan: true,
			forcePeakCutEnabled: true,
		});
		const previous = result.current;
		act(() => window.dispatchEvent(new Event("runtimeConfigChange")));
		expect(result.current).toBe(previous);
		act(() => {
			window.CustomLogo = "";
			window.ShowNetTransfer = false;
		});
		expect(result.current.customLogo).toBeUndefined();
		expect(result.current.showNetTransfer).toBe(false);
	});

	it("leaves existing accessors intact and uses bounded legacy discovery", async () => {
		vi.useFakeTimers();
		const previous = Object.getOwnPropertyDescriptor(window, "ForceSortType");
		let value: string | undefined;
		const get = () => value;
		const set = (next: string | undefined) => {
			value = next;
		};
		Object.defineProperty(window, "ForceSortType", {
			configurable: true,
			get,
			set,
		});
		const { result, unmount } = renderHook(useRuntimeConfig);
		expect(Object.getOwnPropertyDescriptor(window, "ForceSortType")?.get).toBe(
			get,
		);
		act(() => {
			window.ForceSortType = "mem";
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		expect(result.current.forceSortType).toBe("mem");
		unmount();
		expect(Object.getOwnPropertyDescriptor(window, "ForceSortType")?.get).toBe(
			get,
		);
		if (previous) Object.defineProperty(window, "ForceSortType", previous);
		else Reflect.deleteProperty(window, "ForceSortType");
		expect(vi.getTimerCount()).toBe(0);
	});

	it("does not overwrite custom descriptor replacement on cleanup", () => {
		const { unmount } = renderHook(useRuntimeConfig);
		Object.defineProperty(window, "ForceSortType", {
			configurable: true,
			enumerable: true,
			writable: true,
			value: "cpu",
		});
		unmount();
		expect(window.ForceSortType).toBe("cpu");
	});

	it("supports legacy background events and removes subscriptions on unmount", () => {
		const { result, unmount } = renderHook(useRuntimeConfig);
		act(() => {
			window.CustomBackgroundImage = "/late.png";
			window.CustomMobileBackgroundImage = "/mobile.png";
			window.dispatchEvent(new Event("backgroundChange"));
		});
		expect(result.current.backgroundImage).toBe("/late.png");
		expect(result.current.mobileBackgroundImage).toBe("/mobile.png");
		const remove = vi.spyOn(window, "removeEventListener");
		unmount();
		expect(remove).toHaveBeenCalledWith(
			"runtimeConfigChange",
			expect.any(Function),
		);
		expect(remove).toHaveBeenCalledWith(
			"backgroundChange",
			expect.any(Function),
		);
	});

	it("restores session background immediately without timers", () => {
		sessionStorage.setItem("savedBackgroundImage", "/saved.png");
		const interval = vi.spyOn(window, "setInterval");
		const { result } = renderHook(useBackground);
		expect(result.current.backgroundImage).toBe("/saved.png");
		expect(interval).not.toHaveBeenCalled();
	});
});
