import { QueryClient } from "@tanstack/react-query";

// This client owns the shared cache for backend data. Creating it outside a
// React component means React re-renders do not accidentally erase the cache.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The tester stays predictable: data is considered fresh briefly, and
      // requests happen from the Refresh button or explicit cache invalidation.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
