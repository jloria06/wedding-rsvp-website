const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is not configured.");
}

type ApiErrorPayload = {
  message?: string;
  detail?: string;
  error_code?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const payload = (await response.json()) as TResponse | ApiErrorPayload;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;

    throw new ApiError(
      errorPayload.error?.message ??
        errorPayload.message ??
        errorPayload.detail ??
        "The request could not be completed.",
      response.status,
      errorPayload.error?.code ?? errorPayload.error_code,
    );
  }

  return payload as TResponse;
}
