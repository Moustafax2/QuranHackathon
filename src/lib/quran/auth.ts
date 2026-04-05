import "server-only";

import { getQuranFoundationConfig } from "@/lib/quran/config";

interface QuranFoundationTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number;
}

export interface QuranFoundationAccessTokenStatus {
  hasCachedToken: boolean;
  expiresAt: string | null;
  expiresInSeconds: number | null;
}

export class QuranAuthError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "QuranAuthError";
    this.status = status;
    this.details = details;
  }
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedToken: CachedAccessToken | null = null;
let inFlightTokenRequest: Promise<string> | null = null;

function hasValidCachedToken(now = Date.now()): boolean {
  return Boolean(cachedToken && cachedToken.expiresAt > now);
}

async function parseErrorPayload(response: Response): Promise<unknown> {
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

async function requestAccessToken(): Promise<string> {
  const config = getQuranFoundationConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "content",
  });

  const response = await fetch(`${config.authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await parseErrorPayload(response);
    throw new QuranAuthError(
      `Failed to authenticate with Quran Foundation (${response.status}).`,
      response.status,
      details
    );
  }

  const payload = (await response.json()) as QuranFoundationTokenResponse;

  if (!payload.access_token || typeof payload.expires_in !== "number") {
    throw new QuranAuthError(
      "Quran Foundation auth response is missing required token fields.",
      response.status,
      payload
    );
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(payload.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS, 0),
  };

  return cachedToken.accessToken;
}

export function clearQuranFoundationAccessTokenCache(): void {
  cachedToken = null;
}

export function getQuranFoundationAccessTokenStatus(): QuranFoundationAccessTokenStatus {
  if (!hasValidCachedToken() || !cachedToken) {
    return {
      hasCachedToken: false,
      expiresAt: null,
      expiresInSeconds: null,
    };
  }

  return {
    hasCachedToken: true,
    expiresAt: new Date(cachedToken.expiresAt).toISOString(),
    expiresInSeconds: Math.max(
      0,
      Math.floor((cachedToken.expiresAt - Date.now()) / 1000)
    ),
  };
}

export async function getQuranFoundationAccessToken(): Promise<string> {
  if (hasValidCachedToken() && cachedToken) {
    return cachedToken.accessToken;
  }

  if (!inFlightTokenRequest) {
    inFlightTokenRequest = requestAccessToken().finally(() => {
      inFlightTokenRequest = null;
    });
  }

  return inFlightTokenRequest;
}
