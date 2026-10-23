import { describe, expect, it, vi } from "vitest";

const i18nMocks = vi.hoisted(() => ({ init: vi.fn(), on: vi.fn() }));
vi.mock("i18next", () => ({
	default: {
		use: () => ({ init: i18nMocks.init }),
		on: i18nMocks.on,
	},
}));

describe("language persistence", () => {
	it("initializes and handles language changes with inaccessible storage", async () => {
		const getter = vi
			.spyOn(window, "localStorage", "get")
			.mockImplementation(() => {
				throw new DOMException("Storage blocked", "SecurityError");
			});
		try {
			// @ts-expect-error The existing i18n entry point is JavaScript.
			await import("../../i18n.js");
			expect(i18nMocks.init).toHaveBeenCalledWith(
				expect.objectContaining({ lng: "en-US" }),
			);
			const [event, listener] = i18nMocks.on.mock.calls[0];
			expect(event).toBe("languageChanged");
			expect(() => listener("zh-CN")).not.toThrow();
		} finally {
			getter.mockRestore();
		}
	});
});
