export const API_ERROR_UNAUTHORIZED = "ApiErrorUnauthorized";

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly info: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function isUnauthorizedError(error: unknown): boolean {
	const message =
		error instanceof Error ? error.message : error == null ? "" : String(error);
	return (
		message === API_ERROR_UNAUTHORIZED ||
		(error instanceof ApiError && error.status === 401)
	);
}

/** Fetch a JSON envelope without unwrapping data. Aborts retain their native error. */
export async function requestJson<T>(
	url: string,
	init?: RequestInit,
	httpErrorMessage?: string | ((response: Response) => string),
): Promise<T> {
	const response = await (init ? fetch(url, init) : fetch(url));
	const failureMessage =
		typeof httpErrorMessage === "function"
			? httpErrorMessage(response)
			: httpErrorMessage;
	let data: unknown;
	try {
		data = await response.json();
	} catch (error) {
		// A cancelled body read must remain distinguishable from an HTTP failure.
		if (
			response.ok ||
			(typeof error === "object" &&
				error !== null &&
				"name" in error &&
				error.name === "AbortError")
		) {
			throw error;
		}
		throw new ApiError(
			failureMessage || response.statusText || `HTTP ${response.status}`,
			response.status,
			undefined,
		);
	}
	const businessError =
		typeof data === "object" && data !== null && "error" in data
			? data.error
			: undefined;
	const unsuccessfulEnvelope =
		typeof data === "object" &&
		data !== null &&
		"success" in data &&
		data.success === false;
	if (!response.ok || businessError || unsuccessfulEnvelope) {
		throw new ApiError(
			(!response.ok && failureMessage) ||
				(businessError ? String(businessError) : "") ||
				(unsuccessfulEnvelope ? "API request was unsuccessful." : "") ||
				response.statusText ||
				`HTTP ${response.status}`,
			response.status,
			data,
		);
	}
	return data as T;
}

export type ApiRequestOptions = Pick<RequestInit, "signal">;
