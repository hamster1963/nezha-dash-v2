import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServerPreferences } from "@/features/servers/use-server-preferences";
import type { NezhaWebsocketResponse } from "@/types/nezha-api";

const data = { now: 1, servers: [] };
beforeEach(() => {
	vi.stubGlobal("innerWidth", 1024);
});

describe("server preferences", () => {
	it("round trips the existing local storage keys as string flags", () => {
		const { result } = renderHook(() => useServerPreferences(true, null));
		for (const [key, toggle] of [
			["showMap", "toggleMap"],
			["showServices", "toggleServices"],
			["inline", "toggleInline"],
		] as const) {
			expect(result.current[key]).toBe("0");
			act(() => result.current[toggle]());
			expect(result.current[key]).toBe("1");
			expect(localStorage.getItem(key)).toBe("1");
			act(() => result.current[toggle]());
			expect(localStorage.getItem(key)).toBe("0");
		}
	});
	it("restores stored preferences and group selection", () => {
		for (const key of ["showMap", "showServices", "inline"])
			localStorage.setItem(key, "1");
		sessionStorage.setItem("selectedGroup", "Europe");
		const { result } = renderHook(() => useServerPreferences(true, null));
		expect(result.current).toMatchObject({
			showMap: "1",
			showServices: "1",
			inline: "1",
			currentGroup: "Europe",
		});
		vi.stubGlobal("scrollY", 123);
		act(() => result.current.handleTagChange("Asia"));
		expect(result.current.currentGroup).toBe("Asia");
		expect(sessionStorage.getItem("selectedGroup")).toBe("Asia");
		expect(sessionStorage.getItem("scrollPosition")).toBe("123");
	});
	it("lets forced defaults override stored flags", () => {
		window.ForceShowServices = true;
		window.ForceShowMap = true;
		window.ForceCardInline = true;
		for (const key of ["showMap", "showServices", "inline"])
			localStorage.setItem(key, "0");
		const { result } = renderHook(() => useServerPreferences(true, null));
		expect(result.current).toMatchObject({
			showMap: "1",
			showServices: "1",
			inline: "1",
		});
	});
	it("observes delayed custom-code preferences without overwriting saved flags", () => {
		for (const key of ["showMap", "showServices", "inline"])
			localStorage.setItem(key, "0");
		const { result } = renderHook(() => useServerPreferences(true, null));
		act(() => {
			window.ForceShowServices = true;
			window.ForceShowMap = true;
			window.ForceCardInline = true;
		});
		expect(result.current).toMatchObject({
			showMap: "1",
			showServices: "1",
			inline: "1",
		});
		for (const key of ["showMap", "showServices", "inline"])
			expect(localStorage.getItem(key)).toBe("0");
	});
	it("hides unavailable services without overwriting the saved preference", () => {
		localStorage.setItem("showServices", "1");
		const { result, rerender } = renderHook(
			({ hasServices }) => useServerPreferences(hasServices, null),
			{ initialProps: { hasServices: true } },
		);
		expect(result.current.showServices).toBe("1");
		rerender({ hasServices: false });
		expect(result.current.showServices).toBe("0");
		expect(localStorage.getItem("showServices")).toBe("1");
	});
	it("does not apply desktop inline defaults until width reaches 768, nor reset them on shrinking", () => {
		vi.stubGlobal("innerWidth", 767);
		window.ForceCardInline = true;
		const { result, unmount } = renderHook(() =>
			useServerPreferences(true, null),
		);
		expect(result.current.inline).toBe("0");
		vi.stubGlobal("innerWidth", 768);
		act(() => window.dispatchEvent(new Event("resize")));
		expect(result.current.inline).toBe("1");
		vi.stubGlobal("innerWidth", 767);
		act(() => window.dispatchEvent(new Event("resize")));
		expect(result.current.inline).toBe("1");
		const remove = vi.spyOn(window, "removeEventListener");
		unmount();
		expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
	});
	it("waits for data and two frames, then restores scroll only once", () => {
		sessionStorage.setItem("fromMainPage", "true");
		sessionStorage.setItem("scrollPosition", "123");
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((fn: FrameRequestCallback) => {
				frames.push(fn);
				return frames.length;
			}),
		);
		const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
		const { rerender } = renderHook(
			({ value }: { value: NezhaWebsocketResponse | null }) =>
				useServerPreferences(true, value),
			{
				initialProps: { value: null } as {
					value: NezhaWebsocketResponse | null;
				},
			},
		);
		expect(frames).toHaveLength(0);
		rerender({ value: data });
		expect(frames).toHaveLength(1);
		act(() => frames.shift()?.(0));
		expect(scroll).not.toHaveBeenCalled();
		act(() => frames.shift()?.(0));
		expect(scroll).toHaveBeenCalledExactlyOnceWith({
			top: 123,
			left: 0,
			behavior: "auto",
		});
		rerender({ value: { ...data, now: 2 } });
		expect(frames).toHaveLength(0);
	});
	it.each([
		"",
		"NaN",
		"Infinity",
		"invalid",
	])("ignores non-finite saved position %s", (position) => {
		sessionStorage.setItem("fromMainPage", "true");
		sessionStorage.setItem("scrollPosition", position);
		const frame = vi.fn();
		vi.stubGlobal("requestAnimationFrame", frame);
		renderHook(() => useServerPreferences(true, data));
		expect(frame).not.toHaveBeenCalled();
	});
});
