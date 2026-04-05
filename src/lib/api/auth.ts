import "server-only";

import { getQuranFoundationConfig } from "@/config/api";

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedAccessToken: CachedAccessToken | null = null;
let pendingAccessTokenPromise: Promise<string> | null = null;

function isTokenUsable(token: CachedAccessToken | null): token is CachedAccessToken {
  return Boolean(token && Date.now() < token.expiresAt - TOKEN_EXPIRY_BUFFER_MS);
}

async function requestAccessToken(): Promise<string> {
  const { authBaseUrl, clientId, clientSecret } = getQuranFoundationConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "content",
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    let details = "";

    try {
      details = await response.text();
    } catch {
      details = "";
    }

    throw new Error(
      `Failed to fetch Quran Foundation access token: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`
    );
  }

  const data = (await response.json()) as AccessTokenResponse;

  if (!data.access_token || !data.expires_in) {
    throw new Error("Quran Foundation token response is missing access token data.");
  }

  cachedAccessToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedAccessToken.accessToken;
}

export async function getQuranFoundationAccessToken(): Promise<string> {
  if (isTokenUsable(cachedAccessToken)) {
    return cachedAccessToken.accessToken;
  }

  if (!pendingAccessTokenPromise) {
    pendingAccessTokenPromise = requestAccessToken().finally(() => {
      pendingAccessTokenPromise = null;
    });
  }

  return pendingAccessTokenPromise;
}

export function clearQuranFoundationAccessTokenCache() {
  cachedAccessToken = null;
  pendingAccessTokenPromise = null;
}
