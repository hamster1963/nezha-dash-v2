// Match asset-loading failures, not arbitrary errors during module evaluation.
// Apply this only to a rejected lazy loader, never to render or query errors.
export function isChunkLoadError(error: unknown): error is Error {
	return (
		error instanceof Error &&
		/^(?:Failed to fetch dynamically imported module(?::|$)|error loading dynamically imported module(?::|$)|Importing a module script failed\.?$|Unable to preload CSS for )/i.test(
			error.message,
		)
	);
}

export class LazyChunkLoadError extends Error {
	constructor(readonly cause: Error) {
		super(cause.message);
		this.name = "LazyChunkLoadError";
	}
}
