import "server-only";

import {
  clearQuranFoundationAccessTokenCache,
  getQuranFoundationAccessToken,
} from "@/lib/quran/auth";
import { getQuranFoundationConfig } from "@/lib/quran/config";

type QuranQueryParams = Record<string, string | number | boolean | undefined>;

interface QuranGetOptions {
  params?: QuranQueryParams;
  revalidate?: number;
  cache?: RequestCache;
}

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export class QuranApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly details: unknown;

  constructor(message: string, status: number, path: string, details: unknown = null) {
    super(message);
    this.name = "QuranApiError";
    this.status = status;
    this.path = path;
    this.details = details;
  }
}

function buildUrl(path: string, params?: QuranQueryParams): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { apiBaseUrl } = getQuranFoundationConfig();
  const url = new URL(`/content/api/v4${normalizedPath}`, apiBaseUrl);

  if (!params) return url;

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  return url;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function createFetchInit(
  accessToken: string,
  clientId: string,
  options: QuranGetOptions
): NextFetchInit {
  const init: NextFetchInit = {
    headers: {
      Accept: "application/json",
      "x-auth-token": accessToken,
      "x-client-id": clientId,
    },
  };

  if (options.cache) {
    init.cache = options.cache;
  } else {
    init.next = { revalidate: options.revalidate ?? 3600 };
  }

  return init;
}

async function fetchWithAuth<T>(
  url: URL,
  path: string,
  options: QuranGetOptions,
  retryOnUnauthorized: boolean
): Promise<T> {
  const config = getQuranFoundationConfig();
  const accessToken = await getQuranFoundationAccessToken();
  const response = await fetch(
    url.toString(),
    createFetchInit(accessToken, config.clientId, options)
  );

  if (response.status === 401 && retryOnUnauthorized) {
    clearQuranFoundationAccessTokenCache();
    return fetchWithAuth<T>(url, path, options, false);
  }

  if (!response.ok) {
    const details = await parseResponsePayload(response);
    throw new QuranApiError(
      `Quran Foundation content request failed (${response.status}) for ${path}.`,
      response.status,
      path,
      details
    );
  }

  return response.json() as Promise<T>;
}

export async function quranContentGet<T>(
  path: string,
  options: QuranGetOptions = {}
): Promise<T> {
  const url = buildUrl(path, options.params);
  return fetchWithAuth<T>(url, path, options, true);
}
