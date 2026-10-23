import { describe, expect, it, vi } from "vitest";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import {
	handlePublicNote,
	restoreServerPublicNotes,
} from "@/lib/public-note-cache";
import { safeLocalStorage, safeSessionStorage } from "@/lib/storage";
import { formatNezhaInfo } from "@/lib/utils";
import { createServer } from "@/test/fixtures";

describe("optional browser persistence", () => {
	it.each([
		["localStorage", safeLocalStorage],
		["sessionStorage", safeSessionStorage],
	] as const)("preserves %s keys and serialized values", (area, storage) => {
		expect(storage.getItem("existing-key")).toBeNull();
		expect(storage.setItem("existing-key", "0")).toBe(true);
		expect(window[area].getItem("existing-key")).toBe("0");
		expect(storage.getItem("existing-key")).toBe("0");
		expect(storage.removeItem("existing-key")).toBe(true);
		expect(storage.getItem("existing-key")).toBeNull();
	});

	it.each([
		["localStorage", safeLocalStorage],
		["sessionStorage", safeSessionStorage],
	] as const)("handles an inaccessible %s getter and retries later", (area, storage) => {
		const getter = vi.spyOn(window, area, "get").mockImplementation(() => {
			throw new DOMException("Storage blocked", "SecurityError");
		});
		try {
			expect(storage.getItem("key")).toBeNull();
			expect(storage.setItem("key", "value")).toBe(false);
			expect(storage.removeItem("key")).toBe(false);
		} finally {
			getter.mockRestore();
		}
		expect(storage.setItem("key", "value")).toBe(true);
		expect(storage.getItem("key")).toBe("value");
	});

	it("handles failures from storage operations themselves", () => {
		const fail = () => {
			throw new DOMException("Quota unavailable", "QuotaExceededError");
		};
		const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(fail);
		const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(fail);
		const remove = vi
			.spyOn(Storage.prototype, "removeItem")
			.mockImplementation(fail);
		try {
			for (const storage of [safeLocalStorage, safeSessionStorage]) {
				expect(storage.getItem("key")).toBeNull();
				expect(storage.setItem("key", "value")).toBe(false);
				expect(storage.removeItem("key")).toBe(false);
			}
		} finally {
			get.mockRestore();
			set.mockRestore();
			remove.mockRestore();
		}
	});

	it("does not prevent navigation or live notes when session storage is blocked", () => {
		const getter = vi
			.spyOn(window, "sessionStorage", "get")
			.mockImplementation(() => {
				throw new Error("Storage blocked");
			});
		try {
			expect(saveMainPageScrollPosition).not.toThrow();
			expect(handlePublicNote(1, "live note")).toBe("live note");
			expect(handlePublicNote(1, "")).toBe("");
			expect(
				restoreServerPublicNotes([createServer({ public_note: "live" })])[0]
					.public_note,
			).toBe("live");
		} finally {
			getter.mockRestore();
		}
	});

	it("writes live notes once at receipt and never during repeated projection", () => {
		const write = vi.spyOn(Storage.prototype, "setItem");
		const server = createServer({ id: 27, public_note: "cached at receipt" });
		const [received] = restoreServerPublicNotes([server]);
		expect(write).toHaveBeenCalledExactlyOnceWith(
			"server_27_public_note",
			"cached at receipt",
		);
		for (const now of [1, 2, 3]) {
			expect(formatNezhaInfo(now, received).public_note).toBe(
				"cached at receipt",
			);
		}
		const [restored] = restoreServerPublicNotes([
			{ ...server, public_note: "" },
		]);
		expect(formatNezhaInfo(4, restored).public_note).toBe("cached at receipt");
		expect(write).toHaveBeenCalledTimes(1);
	});

	it("restores per-server cached notes without mutating incoming snapshots", () => {
		const server = createServer({ id: 1, public_note: "first" });
		expect(restoreServerPublicNotes([server])[0]).toBe(server);
		const empty = createServer({ id: 1, public_note: "" });
		const unrelated = createServer({ id: 2, public_note: "other" });
		const restored = restoreServerPublicNotes([empty, unrelated]);
		expect(restored[0].public_note).toBe("first");
		expect(empty.public_note).toBe("");
		expect(restored[1]).toBe(unrelated);
		const replacement = createServer({ id: 1, public_note: "updated" });
		expect(restoreServerPublicNotes([replacement])[0]).toBe(replacement);
		expect(restoreServerPublicNotes([empty])[0].public_note).toBe("updated");
	});
});
