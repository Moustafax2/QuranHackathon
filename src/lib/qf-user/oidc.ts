import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  getQfCallbackUrl,
  getQfClientId,
  getQfClientSecret,
  getQfDiscoveryDocument,
  getQfIssuerBaseUrl,
} from "./config";
import type { QfIdTokenClaims, QfTokenResponse, QfUserProfile } from "./types";

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

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}): Promise<QfTokenResponse> {
  const discovery = await getQfDiscoveryDocument();
  const clientId = getQfClientId();
  const clientSecret = getQfClientSecret();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri ?? getQfCallbackUrl(),
    code_verifier: input.codeVerifier,
  });

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await parseJsonSafe(response);
    throw new Error(
      `Quran Foundation code exchange failed (${response.status}): ${JSON.stringify(details)}`
    );
  }

  return (await response.json()) as QfTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<QfTokenResponse> {
  const discovery = await getQfDiscoveryDocument();
  const clientId = getQfClientId();
  const clientSecret = getQfClientSecret();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await parseJsonSafe(response);
    throw new Error(
      `Quran Foundation token refresh failed (${response.status}): ${JSON.stringify(details)}`
    );
  }

  return (await response.json()) as QfTokenResponse;
}

function toDisplayName(claims: QfIdTokenClaims): string | null {
  if (claims.name) return claims.name;
  const joined = [claims.first_name, claims.last_name].filter(Boolean).join(" ").trim();
  return joined || null;
}

export async function verifyIdToken(
  idToken: string,
  nonce?: string
): Promise<QfUserProfile> {
  const discovery = await getQfDiscoveryDocument();
  const clientId = getQfClientId();
  const issuer = discovery.issuer || `${getQfIssuerBaseUrl()}/`;
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
  });

  const claims = payload as unknown as QfIdTokenClaims;

  if (nonce && claims.nonce !== nonce) {
    throw new Error("Returned id_token nonce did not match the original login nonce.");
  }

  return {
    sub: claims.sub,
    email: claims.email ?? null,
    name: toDisplayName(claims),
    avatar: claims.picture ?? null,
  };
}

export async function fetchUserInfo(accessToken: string): Promise<Partial<QfUserProfile>> {
  const discovery = await getQfDiscoveryDocument();

  if (!discovery.userinfo_endpoint) {
    return {};
  }

  const response = await fetch(discovery.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    avatar: typeof payload.picture === "string" ? payload.picture : null,
  };
}
