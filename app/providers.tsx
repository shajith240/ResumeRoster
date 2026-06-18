"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// Show cached data immediately; refetch silently in background
						staleTime: 30_000,
						// Keep data in memory for 5 minutes after last subscriber unmounts
						gcTime: 5 * 60_000,
						retry: 1,
						// Don't startle users by reshuffling the feed on tab-focus
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
