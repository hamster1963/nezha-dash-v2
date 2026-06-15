import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

export function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
		},
	});
}

type RenderWithProvidersOptions = RenderOptions & {
	route?: string;
	queryClient?: QueryClient;
};

export function renderWithProviders(
	ui: ReactElement,
	{
		route = "/",
		queryClient = createTestQueryClient(),
		...renderOptions
	}: RenderWithProvidersOptions = {},
) {
	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
			</QueryClientProvider>
		);
	}

	return {
		queryClient,
		...render(ui, { wrapper: Wrapper, ...renderOptions }),
	};
}
