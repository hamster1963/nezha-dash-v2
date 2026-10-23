import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useLoginUser } from "@/hooks/use-login-user";
import { ApiError } from "@/lib/http";
import { createTestQueryClient } from "@/test/utils";

const fetchProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/nezha-api", () => ({ fetchLoginUser: fetchProfile }));

function setup() {
	const client = createTestQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper, ...renderHook(() => useLoginUser(), { wrapper }) };
}

describe("confirmed session state", () => {
	it("retains authenticated identity through network and 5xx failures without requiring readable cookies", async () => {
		fetchProfile.mockResolvedValue({ success: true, data: { id: 1 } });
		const { result } = setup();
		await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
		for (const error of [
			new TypeError("offline"),
			new ApiError("unavailable", 503, null),
		]) {
			fetchProfile.mockRejectedValue(error);
			await act(async () => {
				await result.current.refetch();
			});
			await waitFor(() => expect(result.current.isError).toBe(true));
			expect(result.current.authStatus).toBe("authenticated");
		}
	});
	it("explicit unauthorized replaces cached identity and transient failures cannot resurrect it for new observers", async () => {
		fetchProfile.mockResolvedValue({ success: true, data: { id: 1 } });
		const { result, wrapper } = setup();
		await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
		fetchProfile.mockRejectedValue(new ApiError("unauthorized", 401, null));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.authStatus).toBe("anonymous"));
		fetchProfile.mockRejectedValue(new Error("network"));
		await act(async () => {
			await result.current.refetch();
		});
		const second = renderHook(() => useLoginUser(), { wrapper });
		expect(second.result.current.authStatus).toBe("anonymous");
		fetchProfile.mockResolvedValue({ success: true, data: { id: 2 } });
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() =>
			expect(second.result.current.isAuthenticated).toBe(true),
		);
	});
	it("keeps initial transient failure unknown, and recognizes explicit business unauthorized", async () => {
		fetchProfile.mockRejectedValue(new Error("offline"));
		const { result } = setup();
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.authStatus).toBe("unknown");
		fetchProfile.mockRejectedValue(new Error("ApiErrorUnauthorized"));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.authStatus).toBe("anonymous"));
	});
});
