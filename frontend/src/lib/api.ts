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

export async function apiDownload(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  if (!response.ok) {
    let message = "The file could not be downloaded.";
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = payload.error?.message ?? payload.message ?? payload.detail ?? message;
    } catch {
      // The server may return a non-JSON error page.
    }
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

export function apiAssetUrl(path: string): string {
  return path.startsWith("/api/") ? `${apiBaseUrl.replace(/\/api\/?$/, "")}${path}` : path;
}

export async function apiUpload<TResponse>(
  path: string,
  file: File,
  accessToken: string,
): Promise<TResponse> {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  const payload = (await response.json()) as TResponse | ApiErrorPayload;
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    throw new ApiError(
      errorPayload.error?.message ?? errorPayload.message ?? errorPayload.detail ?? "The image could not be uploaded.",
      response.status,
      errorPayload.error?.code ?? errorPayload.error_code,
    );
  }
  return payload as TResponse;
}
