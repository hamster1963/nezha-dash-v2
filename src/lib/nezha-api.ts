import type {
	LoginUserResponse,
	MetricPeriod,
	MetricType,
	MonitorResponse,
	ServerGroupResponse,
	ServerMetricsResponse,
	ServiceResponse,
	SettingResponse,
} from "@/types/nezha-api";

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

export const fetchServerGroup = async (): Promise<ServerGroupResponse> => {
	const response = await fetch("/api/v1/server-group");
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
};

export const fetchLoginUser = async (): Promise<LoginUserResponse> => {
	const response = await fetch("/api/v1/profile");
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}

	// auto refresh token
	if (
		document.cookie &&
		(!lastestRefreshTokenAt ||
			Date.now() - lastestRefreshTokenAt > 1000 * 60 * 60)
	) {
		lastestRefreshTokenAt = Date.now();
		const csrfToken = getCsrfToken();
		fetch("/api/v1/refresh-token", {
			method: "POST",
			headers: {
				"X-CSRF-Token": csrfToken,
			},
		});
	}

	return data;
};

export type MonitorPeriod = "1d" | "7d" | "30d";

export const fetchMonitor = async (
	server_id: number,
	period?: MonitorPeriod,
): Promise<MonitorResponse> => {
	const query = period ? `?period=${period}` : "";
	const response = await fetch(`/api/v1/server/${server_id}/service${query}`);
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
};

export const fetchService = async (): Promise<ServiceResponse> => {
	const response = await fetch("/api/v1/service");
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
};

export const fetchSetting = async (): Promise<SettingResponse> => {
	const response = await fetch("/api/v1/setting");
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
};

export const fetchServerMetrics = async (
	server_id: number,
	metric: MetricType,
	period?: MetricPeriod,
): Promise<ServerMetricsResponse> => {
	const query = period
		? `?metric=${metric}&period=${period}`
		: `?metric=${metric}`;
	const response = await fetch(`/api/v1/server/${server_id}/metrics${query}`);
	const data = await response.json();
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
};
