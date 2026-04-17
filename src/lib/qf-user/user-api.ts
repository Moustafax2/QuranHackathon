import "server-only";

import { getQfClientId, getQfUserApiBaseUrl } from "./config";
import type {
  QfBookmark,
  QfBookmarkListResponse,
  QfBookmarkMutationResponse,
  QfSession,
} from "./types";

export class QfUserApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = "QfUserApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
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

async function request<T>(
  session: QfSession,
  path: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = getQfUserApiBaseUrl();
  const response = await fetch(`${baseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-auth-token": session.access_token,
      "x-client-id": getQfClientId(),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await parseJsonSafe(response);
    throw new QfUserApiError(
      `Quran Foundation User API request failed (${response.status}) for ${path}.`,
      response.status,
      details
    );
  }

  return response.json() as Promise<T>;
}

export async function getUserBookmarks(session: QfSession): Promise<QfBookmarkListResponse> {
  const data: QfBookmark[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  let pagination: QfBookmarkListResponse["pagination"];

  // Quran Foundation caps bookmark pagination at 20 items per request.
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({
      type: "ayah",
      mushafId: "4",
      first: "20",
    });

    if (after) {
      params.set("after", after);
    }

    const response = await request<QfBookmarkListResponse>(
      session,
      `/bookmarks?${params.toString()}`
    );

    for (const bookmark of response.data) {
      if (seen.has(bookmark.id)) continue;
      seen.add(bookmark.id);
      data.push(bookmark);
    }

    pagination = response.pagination;
    const nextCursor = response.pagination?.endCursor ?? null;
    if (!response.pagination?.hasNextPage || !nextCursor) {
      return {
        success: response.success,
        data,
        pagination,
      };
    }

    after = nextCursor;
  }

  throw new Error("Exceeded Quran Foundation bookmark pagination limit while syncing bookmarks.");
}

export async function addUserBookmark(
  session: QfSession,
  input: { chapterId: number; verseNumber: number }
): Promise<QfBookmarkMutationResponse> {
  return request<QfBookmarkMutationResponse>(session, "/bookmarks", {
    method: "POST",
    body: JSON.stringify({
      type: "ayah",
      key: input.chapterId,
      verseNumber: input.verseNumber,
      mushaf: 4,
    }),
  });
}

export async function deleteUserBookmark(
  session: QfSession,
  bookmarkId: string
): Promise<QfBookmarkMutationResponse> {
  return request<QfBookmarkMutationResponse>(session, `/bookmarks/${bookmarkId}`, {
    method: "DELETE",
  });
}
