import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/http";
import { fetchLoginUser } from "@/lib/nezha-api";

// 所有页面共用登录缓存；短时间切换标签复用结果，回到前台重新确认会话。
export function useLoginUser() {
	const query = useQuery({
		queryKey: ["login-user"],
		queryFn: async ({ signal }) => {
			try {
				return await fetchLoginUser({ signal });
			} catch (error) {
				// Cache an explicit signed-out result, replacing any prior profile.
				// Later transient failures must not resurrect that old identity.
				if (isUnauthorizedError(error)) return null;
				throw error;
			}
		},
		staleTime: 30_000,
		refetchOnMount: true,
		refetchOnWindowFocus: "always",
		refetchOnReconnect: "always",
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
		retry: false,
	});
	// A failed revalidation does not invalidate the last confirmed identity.
	// Cookies may be HttpOnly; the profile endpoint is the authority.
	const authStatus =
		query.data === undefined
			? "unknown"
			: query.data?.data?.id
				? "authenticated"
				: "anonymous";
	return {
		...query,
		authStatus,
		isAuthenticated: authStatus === "authenticated",
	};
}
