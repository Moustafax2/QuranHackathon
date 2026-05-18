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

const cachedTokens = new Map<string, CachedAccessToken>();
const inFlightTokenRequests = new Map<string, Promise<string>>();

function hasValidCachedToken(scope: string, now = Date.now()): boolean {
  const cachedToken = cachedTokens.get(scope);
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

async function requestAccessToken(scope: string): Promise<string> {
  const config = getQuranFoundationConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope,
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

  const cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(payload.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS, 0),
  };
  cachedTokens.set(scope, cachedToken);

  return cachedToken.accessToken;
}

export function clearQuranFoundationAccessTokenCache(): void {
  cachedTokens.clear();
}

export function getQuranFoundationAccessTokenStatus(): QuranFoundationAccessTokenStatus {
  const cachedToken = cachedTokens.get("content");
  if (!hasValidCachedToken("content") || !cachedToken) {
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

export async function getQuranFoundationAccessToken(scope = "content"): Promise<string> {
  const cachedToken = cachedTokens.get(scope);
  if (hasValidCachedToken(scope) && cachedToken) {
    return cachedToken.accessToken;
  }

  let inFlightTokenRequest = inFlightTokenRequests.get(scope);
  if (!inFlightTokenRequest) {
    inFlightTokenRequest = requestAccessToken(scope).finally(() => {
      inFlightTokenRequests.delete(scope);
    });
    inFlightTokenRequests.set(scope, inFlightTokenRequest);
  }

  return inFlightTokenRequest;
}
