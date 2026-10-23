import {
	type ComponentType,
	lazy,
	type ReactNode,
	Suspense,
	useState,
} from "react";
import LocalErrorBoundary from "@/components/LocalErrorBoundary";
import { isChunkLoadError, LazyChunkLoadError } from "@/lib/lazy-load-error";

interface Props<P extends object> {
	load: () => Promise<{ default: ComponentType<P> }>;
	getPreloaded?: () => ComponentType<P> | undefined;
	componentProps: P;
	fallback: ReactNode;
	title?: string;
	resetKey?: string;
}

// A stable loader identifies its module across tab unmounts. Store only fulfilled
// components. Recreating React.lazy can retry a loader, but browsers may retain
// failed module requests until the document is reloaded.
const loadedComponents = new WeakMap<() => Promise<unknown>, unknown>();

function createContent<P extends object>(
	load: Props<P>["load"],
	getPreloaded: Props<P>["getPreloaded"],
) {
	const loaded =
		getPreloaded?.() ??
		(loadedComponents.get(load) as ComponentType<P> | undefined);
	return (
		loaded ??
		lazy(async () => {
			try {
				const module = await load();
				loadedComponents.set(load, module.default);
				return module;
			} catch (error) {
				if (isChunkLoadError(error)) throw new LazyChunkLoadError(error);
				throw error;
			}
		})
	);
}

function LazySection<P extends object>({
	load,
	getPreloaded,
	componentProps,
	fallback,
	title,
}: Props<P>) {
	// Keep state above Suspense, and use completed preloads without a fallback flash.
	const [Content, setContent] = useState(() =>
		createContent(load, getPreloaded),
	);
	return (
		<LocalErrorBoundary
			title={title}
			allowReload
			onRetry={() => {
				// Non-asset failures can retry locally with a fresh lazy identity.
				setContent(() => createContent(load, getPreloaded));
			}}
		>
			<Suspense fallback={fallback}>
				<Content {...componentProps} />
			</Suspense>
		</LocalErrorBoundary>
	);
}

export default function RetryableLazy<P extends object>({
	resetKey,
	...props
}: Props<P>) {
	return <LazySection key={resetKey} {...props} />;
}
