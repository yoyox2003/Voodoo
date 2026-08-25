// The backend URL is configurable so the same frontend can use a deployed API
// later. Vite replaces import.meta.env values while it builds the frontend.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  // DELETE routes answer with 204 and intentionally do not have a JSON body.
  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The API request failed.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}
