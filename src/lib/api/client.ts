import "server-only";

import { getQuranFoundationConfig } from "@/config/api";
import {
  clearQuranFoundationAccessTokenCache,
  getQuranFoundationAccessToken,
} from "./auth";

interface QuranApiErrorBody {
  message?: string;
  type?: string;
  success?: boolean;
}

interface ApiGetOptions {
  cache?: RequestCache;
  revalidate?: number | false;
  tags?: string[];
}

export class QuranApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly type?: string,
    readonly details?: QuranApiErrorBody | string | null
  ) {
    super(message);
    this.name = "QuranApiError";
  }

  static async fromResponse(
    response: Response,
    url: string
  ): Promise<QuranApiError> {
    const details = await parseErrorBody(response);
    const message =
      typeof details === "object" && details?.message
        ? details.message
        : `Quran Foundation API error: ${response.status} ${response.statusText}`;
    const type = typeof details === "object" ? details?.type : undefined;

    return new QuranApiError(message, response.status, url, type, details);
  }
}

async function parseErrorBody(
  response: Response
): Promise<QuranApiErrorBody | string | null> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as QuranApiErrorBody;
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

function buildContentApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
): URL {
  const { contentApiBaseUrl } = getQuranFoundationConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${contentApiBaseUrl}${normalizedPath}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
}

function buildRequestInit(
  accessToken: string,
  clientId: string,
  options: ApiGetOptions
): RequestInit & { next?: { revalidate?: number; tags?: string[] } } {
  const headers = new Headers({
    Accept: "application/json",
    "x-auth-token": accessToken,
    "x-client-id": clientId,
  });

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } =
    {
      headers,
    };

  if (options.revalidate === false) {
    init.cache = options.cache || "no-store";
    return init;
  }

  if (options.cache) {
    init.cache = options.cache;
  }

  init.next = {
    revalidate: options.revalidate ?? 3600,
    tags: options.tags,
  };

  return init;
}

async function fetchContentApi(
  url: URL,
  options: ApiGetOptions = {},
  retryOnUnauthorized = true
): Promise<Response> {
  const { clientId } = getQuranFoundationConfig();
  const accessToken = await getQuranFoundationAccessToken();
  const response = await fetch(
    url.toString(),
    buildRequestInit(accessToken, clientId, options)
  );

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  clearQuranFoundationAccessTokenCache();
  const freshAccessToken = await getQuranFoundationAccessToken();

  return fetch(
    url.toString(),
    buildRequestInit(freshAccessToken, clientId, options)
  );
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  options: ApiGetOptions = {}
): Promise<T> {
  const url = buildContentApiUrl(path, params);
  const res = await fetchContentApi(url, options);

  if (!res.ok) {
    throw await QuranApiError.fromResponse(res, url.toString());
  }

  return res.json() as Promise<T>;
}
