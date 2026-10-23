let disposeCurrent: (() => void) | undefined;

/** Inject trusted dashboard custom_code in document order. Removing script nodes
 * cannot undo arbitrary JavaScript side effects or cancel scripts already run. */
export async function InjectContext(
	content: string,
	options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<() => void> {
	disposeCurrent?.();
	const controller = new AbortController();
	const nodes: Node[] = [];
	const dispose = () => {
		controller.abort();
		for (const node of nodes) node.parentNode?.removeChild(node);
		options.signal?.removeEventListener("abort", dispose);
		if (disposeCurrent === dispose) disposeCurrent = undefined;
	};
	disposeCurrent = dispose;
	options.signal?.addEventListener("abort", dispose, { once: true });
	if (options.signal?.aborted) dispose();
	const check = () => {
		if (controller.signal.aborted)
			throw new DOMException("Injection cancelled", "AbortError");
	};
	const append = (node: Node, parent: Node) => {
		check();
		nodes.push(node);
		if (node instanceof Element) node.setAttribute("data-injected", "true");
		parent.appendChild(node);
	};
	const load = (node: HTMLScriptElement | HTMLLinkElement, parent: Node) =>
		new Promise<void>((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(timer);
				node.onload = null;
				node.onerror = null;
				controller.signal.removeEventListener("abort", abort);
				if (error) reject(error);
				else resolve();
			};
			const abort = () =>
				finish(new DOMException("Injection cancelled", "AbortError"));
			const timer = setTimeout(
				() => finish(new Error("Custom resource loading timed out")),
				options.timeoutMs ?? 30000,
			);
			node.onload = () => finish();
			node.onerror = () =>
				finish(
					new Error(
						`Failed to load custom resource: ${node instanceof HTMLScriptElement ? node.src : node.href}`,
					),
				);
			controller.signal.addEventListener("abort", abort, { once: true });
			try {
				append(node, parent);
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
			}
		});
	const container = document.createElement("div");
	container.innerHTML = content;
	try {
		check();
		for (const source of Array.from(container.childNodes)) {
			check();
			if (source instanceof HTMLScriptElement) {
				const script = document.createElement("script");
				for (const attribute of Array.from(source.attributes))
					script.setAttribute(attribute.name, attribute.value);
				script.textContent = source.textContent;
				script.async = false;
				const type = script.type.trim().toLowerCase();
				const isClassic =
					!type ||
					/^(text|application)\/(x-)?(java|ecma)script(1\.[0-5])?$/.test(
						type,
					) ||
					["text/jscript", "text/livescript"].includes(type);
				// Browsers intentionally skip nomodule scripts when modules are supported.
				// Data blocks/import maps also do not produce external-script load events.
				if (script.noModule || (!isClassic && type !== "module")) {
					append(script, document.head);
					continue;
				}
				if (script.src || type === "module") await load(script, document.head);
				else {
					let scriptError: Error | undefined;
					const onError = (event: ErrorEvent) => {
						scriptError =
							event.error instanceof Error
								? event.error
								: new Error(event.message);
						event.preventDefault();
					};
					window.addEventListener("error", onError);
					try {
						append(script, document.body);
					} finally {
						window.removeEventListener("error", onError);
					}
					if (scriptError) throw scriptError;
				}
			} else if (
				source instanceof HTMLLinkElement &&
				source.rel === "stylesheet"
			) {
				await load(source.cloneNode(true) as HTMLLinkElement, document.head);
			} else {
				append(
					source,
					source instanceof HTMLStyleElement ||
						source instanceof HTMLMetaElement
						? document.head
						: document.body,
				);
			}
		}
		check();
		return dispose;
	} catch (error) {
		dispose();
		throw error;
	}
}
