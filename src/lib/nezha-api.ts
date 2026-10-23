import { type ApiRequestOptions, requestJson } from "@/lib/http";
import type {
	LoginUserResponse,
	MetricPeriod,
	MetricType,
	MonitorResponse,
	OnlineHistoryResponse,
	ServerGroupResponse,
	ServerMetricsResponse,
	ServiceResponse,
	SettingResponse,
} from "@/types/nezha-api";

export { API_ERROR_UNAUTHORIZED, isUnauthorizedError } from "@/lib/http";

let lastestRefreshTokenAt = 0;

const getCookieValue = (name: string): string | undefined => {
	const cookie = document.cookie
		.split("; ")
		.find((item) => item.startsWith(`${name}=`));

	if (!cookie) {
		return undefined;
	}

	return decodeURIComponent(cookie.split("=").slice(1).join("="));
};

const getCsrfToken = (): string => {
	return getCookieValue("nz-csrf") || "";
};

export const fetchServerGroup = async (
	options?: ApiRequestOptions,
): Promise<ServerGroupResponse> => {
	const data = await requestJson<ServerGroupResponse>(
		"/api/v1/server-group",
		options,
	);
	return data;
};

export const fetchLoginUser = async (
	options?: ApiRequestOptions,
): Promise<LoginUserResponse> => {
	const data = await requestJson<LoginUserResponse>("/api/v1/profile", options);

	// auto refresh token
	if (
		document.cookie &&
		(!lastestRefreshTokenAt ||
			Date.now() - lastestRefreshTokenAt > 1000 * 60 * 60)
	) {
		lastestRefreshTokenAt = Date.now();
		const csrfToken = getCsrfToken();
		void requestJson("/api/v1/refresh-token", {
			method: "POST",
			headers: {
				"X-CSRF-Token": csrfToken,
			},
		}).catch(() => {
			// Refresh is best-effort and must not reject the successful profile query.
		});
	}

	return data;
};

export type MonitorPeriod = "1d" | "7d" | "30d";

export const fetchMonitor = async (
	server_id: number,
	period?: MonitorPeriod,
	options?: ApiRequestOptions,
): Promise<MonitorResponse> => {
	const query = period ? `?period=${period}` : "";
	const data = await requestJson<MonitorResponse>(
		`/api/v1/server/${server_id}/service${query}`,
		options,
	);
	return data;
};

export const fetchService = async (
	options?: ApiRequestOptions,
): Promise<ServiceResponse> => {
	const data = await requestJson<ServiceResponse>("/api/v1/service", options);
	return data;
};

export const fetchSetting = async (
	options?: ApiRequestOptions,
): Promise<SettingResponse> => {
	const data = await requestJson<SettingResponse>("/api/v1/setting", options);
	return data;
};

export const fetchServerMetrics = async (
	server_id: number,
	metric: MetricType,
	period?: MetricPeriod,
	options?: ApiRequestOptions,
): Promise<ServerMetricsResponse> => {
	const query = period
		? `?metric=${metric}&period=${period}`
		: `?metric=${metric}`;
	const data = await requestJson<ServerMetricsResponse>(
		`/api/v1/server/${server_id}/metrics${query}`,
		options,
	);
	return data;
};

export const fetchServerOnlineHistory = async (
	server_id: number,
	days?: number,
	options?: ApiRequestOptions,
): Promise<OnlineHistoryResponse> => {
	const query = days ? `?days=${days}` : "";
	const data = await requestJson<OnlineHistoryResponse>(
		`/api/v1/server/${server_id}/online-history${query}`,
		options,
	);
	return data;
};
