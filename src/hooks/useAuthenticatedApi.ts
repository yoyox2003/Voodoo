import { useAuth } from "@clerk/react";
import { useCallback } from "react";
import { ApiError, apiUrl, parseApiResponse } from "../lib/api";

// A hook is a reusable function that can use React state or other hooks. This
// one centralizes the "get a Clerk token, then call the Express API" pattern.
export function useAuthenticatedApi() {
  const { getToken } = useAuth();

  return useCallback(
    async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const token = await getToken();

      if (!token) {
        throw new ApiError("Your sign-in session is not ready. Please try again.", 401);
      }

      // Headers is used instead of a plain object so callers can still pass
      // their own headers without losing the JSON content type or auth token.
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");

      const response = await fetch(apiUrl(path), { ...options, headers });
      return parseApiResponse<T>(response);
    },
    [getToken],
  );
}
