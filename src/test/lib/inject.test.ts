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

	it("rejects external failures and cleans partial resources", async () => {
		const promise = InjectContext(
			`<style>.partial{}</style><script src="/missing.js"></script>`,
		);
		await Promise.resolve();
		const script = document.querySelector<HTMLScriptElement>(
			"script[data-injected]",
		);
		script?.dispatchEvent(new Event("error"));
		await expect(promise).rejects.toThrow("Failed to load custom resource");
		expect(document.querySelector("[data-injected]")).toBeNull();
	});

	it("awaits stylesheets and external scripts in document order", async () => {
		const promise = InjectContext(
			`<link rel="stylesheet" href="/custom.css"><script src="/custom.js"></script><div id="ready"></div>`,
		);
		expect(document.querySelector("#ready")).toBeNull();
		expect(document.querySelector("script[data-injected]")).toBeNull();
		document
			.querySelector("link[data-injected]")
			?.dispatchEvent(new Event("load"));
		await Promise.resolve();
		expect(document.querySelector("#ready")).toBeNull();
		document
			.querySelector("script[data-injected]")
			?.dispatchEvent(new Event("load"));
		const cleanup = await promise;
		expect(document.querySelector("#ready")).not.toBeNull();
		cleanup();
		expect(document.querySelector("#ready")).toBeNull();
	});

	it("aborts superseded work and never removes the replacement", async () => {
		const first = InjectContext(
			`old text<script src="/slow.js"></script><div id="stale"></div>`,
		);
		const rejection = expect(first).rejects.toMatchObject({
			name: "AbortError",
		});
		await InjectContext(`<div id="replacement"></div>`);
		await rejection;
		expect(document.querySelector("#stale")).toBeNull();
		expect(document.body).not.toHaveTextContent("old text");
		expect(document.querySelector("#replacement")).not.toBeNull();
	});

	it("supports already aborted requests and resource timeouts", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			InjectContext("text", { signal: controller.signal }),
		).rejects.toMatchObject({ name: "AbortError" });
		vi.useFakeTimers();
		const pending = InjectContext(`<script src="/timeout.js"></script>`, {
			timeoutMs: 10,
		});
		const rejection = expect(pending).rejects.toThrow("timed out");
		await vi.advanceTimersByTimeAsync(10);
		await rejection;
	});
});

describe("non-executable custom scripts", () => {
	it("does not wait for data-block scripts to emit load", async () => {
		const cleanup = await InjectContext(
			'<script type="application/json" src="/data.json">{}</script><style>.after-data{color:red}</style>',
		);
		expect(
			document.head.querySelector('script[type="application/json"]'),
		).toBeInTheDocument();
		expect(document.head.querySelector("style")?.textContent).toContain(
			"after-data",
		);
		cleanup();
	});
	it("does not wait for nomodule scripts skipped by a module-capable browser", async () => {
		const previous = Object.getOwnPropertyDescriptor(
			HTMLScriptElement.prototype,
			"noModule",
		);
		Object.defineProperty(HTMLScriptElement.prototype, "noModule", {
			configurable: true,
			get() {
				return this.hasAttribute("nomodule");
			},
		});
		try {
			const cleanup = await InjectContext(
				'<script nomodule src="/legacy.js"></script><span id="after-legacy">Ready</span>',
			);
			expect(document.querySelector("#after-legacy")).toBeInTheDocument();
			cleanup();
		} finally {
			if (previous)
				Object.defineProperty(
					HTMLScriptElement.prototype,
					"noModule",
					previous,
				);
			else Reflect.deleteProperty(HTMLScriptElement.prototype, "noModule");
		}
	});
});
