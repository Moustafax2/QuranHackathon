import "server-only";

import type { QfOidcDiscoveryDocument } from "./types";

export type QfEnvironment = "prelive" | "production";

const DEFAULT_ISSUERS: Record<QfEnvironment, string> = {
  prelive: "https://prelive-oauth2.quran.foundation",
  production: "https://oauth2.quran.foundation",
};

const DEFAULT_USER_API_BASES: Record<QfEnvironment, string> = {
  prelive: "https://apis-prelive.quran.foundation",
  production: "https://apis.quran.foundation",
};

let discoveryCache: QfOidcDiscoveryDocument | null = null;

export class QfConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QfConfigurationError";
  }
}

function normalizeUrl(url: string): string {
  return new URL(url).origin;
}

export function getQfEnvironment(): QfEnvironment {
  const value = process.env.QF_ENV?.trim().toLowerCase();
  if (value === "prelive" || value === "production") {
    return value;
  }
  return "prelive";
}

export function getQfIssuerBaseUrl(): string {
  return DEFAULT_ISSUERS[getQfEnvironment()];
}

export function getQfClientId(): string {
  const clientId = process.env.QF_CLIENT_ID?.trim();
  if (!clientId) {
    throw new QfConfigurationError("Missing QF_CLIENT_ID.");
  }
  return clientId;
}

export function getQfClientSecret(): string {
  const clientSecret = process.env.QF_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new QfConfigurationError("Missing QF_CLIENT_SECRET.");
  }
  return clientSecret;
}

export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicit) {
    return normalizeUrl(explicit);
  }

  if (process.env.NODE_ENV === "production") {
    return "https://quran-hackathon.vercel.app";
  }

  return "http://localhost:3000";
}

export function getQfCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/auth/callback`;
}

export function getQfUserApiBaseUrl(): string {
  const override = process.env.QF_USER_API_BASE_URL?.trim();
  if (override) {
    return normalizeUrl(override);
  }
  return DEFAULT_USER_API_BASES[getQfEnvironment()];
}

export function getQfRequestedScopes(): string {
  return ["openid", "offline_access", "profile", "email", "bookmark", "user"].join(" ");
}

export function getQfSessionSecret(): string {
  const secret = process.env.QF_SESSION_SECRET?.trim();
  if (!secret) {
    throw new QfConfigurationError("Missing QF_SESSION_SECRET.");
  }
  return secret;
}

export async function getQfDiscoveryDocument(): Promise<QfOidcDiscoveryDocument> {
  if (discoveryCache) {
    return discoveryCache;
  }

  const issuer = getQfIssuerBaseUrl();
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to load Quran Foundation OIDC discovery (${response.status}).`);
  }

  const discovery = (await response.json()) as QfOidcDiscoveryDocument;
  discoveryCache = discovery;
  return discovery;
}
