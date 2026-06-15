import { describe, expect, it, vi } from "vitest";

import { InjectContext } from "@/lib/inject";

describe("InjectContext", () => {
	it("injects supported resource nodes and marks them for cleanup", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		await InjectContext(`
			<meta name="x-test" content="enabled" />
			<style>.custom { color: red; }</style>
			<script>window.__injected = true;</script>
			<div id="custom-node">custom content</div>
			plain text
		`);

		expect(document.querySelector('meta[name="x-test"]')).toHaveAttribute(
			"data-injected",
			"true",
		);
		expect(document.querySelector("style[data-injected]")).toHaveTextContent(
			".custom",
		);
		expect(document.querySelector("script[data-injected]")).toHaveTextContent(
			"window.__injected = true;",
		);
		expect(document.querySelector("#custom-node")).toHaveAttribute(
			"data-injected",
			"true",
		);
		expect(document.body).toHaveTextContent("plain text");
	});

	it("cleans previous injected resources before applying new content", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		await InjectContext(`<div id="first">first</div>`);
		await InjectContext(`<div id="second">second</div>`);

		expect(document.querySelector("#first")).not.toBeInTheDocument();
		expect(document.querySelector("#second")).toBeInTheDocument();
	});

	it("logs external resource failures without throwing to callers", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const appendChild = vi
			.spyOn(document.head, "appendChild")
			.mockImplementation((node) => {
				if (node instanceof HTMLScriptElement) {
					setTimeout(() => node.onerror?.(new Event("error")), 0);
				}
				return node;
			});

		await InjectContext(`<script src="/missing.js"></script>`);

		expect(appendChild).toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith(
			"Error during resource injection:",
			expect.any(Error),
		);
	});
});
