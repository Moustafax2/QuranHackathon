import "server-only";

export type QuranFoundationEnvironment = "prelive" | "production";

interface QuranFoundationDefaults {
  authBaseUrl: string;
  apiBaseUrl: string;
}

export interface QuranFoundationConfigStatus {
  environment: QuranFoundationEnvironment;
  environmentConfigured: boolean;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  authBaseUrl: string;
  apiBaseUrl: string;
  authBaseUrlSource: "default" | "env";
  apiBaseUrlSource: "default" | "env";
  maskedClientId: string | null;
  issues: string[];
  isReady: boolean;
}

export interface QuranFoundationConfig {
  environment: QuranFoundationEnvironment;
  clientId: string;
  clientSecret: string;
  authBaseUrl: string;
  apiBaseUrl: string;
}

const DEFAULTS: Record<QuranFoundationEnvironment, QuranFoundationDefaults> = {
  prelive: {
    authBaseUrl: "https://prelive-oauth2.quran.foundation",
    apiBaseUrl: "https://apis-prelive.quran.foundation",
  },
  production: {
    authBaseUrl: "https://oauth2.quran.foundation",
    apiBaseUrl: "https://apis.quran.foundation",
  },
};

export class QuranConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(
      issues.length > 0
        ? `Quran Foundation configuration error: ${issues.join(" ")}`
        : "Quran Foundation configuration error."
    );
    this.name = "QuranConfigurationError";
    this.issues = issues;
  }
}

function parseEnvironment(
  value: string | undefined
): {
  environment: QuranFoundationEnvironment;
  environmentConfigured: boolean;
  issues: string[];
} {
  if (!value) {
    return {
      environment: "prelive",
      environmentConfigured: false,
      issues: ['Missing `QF_ENV`. Set it to "prelive" or "production".'],
    };
  }

  if (value === "prelive" || value === "production") {
    return {
      environment: value,
      environmentConfigured: true,
      issues: [],
    };
  }

  return {
    environment: "prelive",
    environmentConfigured: false,
    issues: ['Invalid `QF_ENV`. Use "prelive" or "production".'],
  };
}

function normalizeBaseUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

function isPreliveUrl(url: string): boolean {
  return new URL(url).hostname.toLowerCase().includes("prelive");
}

function maskClientId(clientId: string | undefined): string | null {
  if (!clientId) return null;
  if (clientId.length <= 6) return `${clientId.slice(0, 2)}***`;
  return `${clientId.slice(0, 4)}***${clientId.slice(-4)}`;
}

export function getQuranFoundationConfigStatus(): QuranFoundationConfigStatus {
  const envValue = process.env.QF_ENV?.trim().toLowerCase();
  const { environment, environmentConfigured, issues } = parseEnvironment(envValue);
  const defaults = DEFAULTS[environment];

  const clientId = process.env.QF_CLIENT_ID?.trim();
  const clientSecret = process.env.QF_CLIENT_SECRET?.trim();

  const authBaseUrlValue = process.env.QF_AUTH_BASE_URL?.trim();
  const apiBaseUrlValue = process.env.QF_API_BASE_URL?.trim();

  let authBaseUrl = defaults.authBaseUrl;
  let apiBaseUrl = defaults.apiBaseUrl;
  let authBaseUrlSource: "default" | "env" = "default";
  let apiBaseUrlSource: "default" | "env" = "default";

  if (!clientId) {
    issues.push("Missing `QF_CLIENT_ID`.");
  }

  if (!clientSecret) {
    issues.push("Missing `QF_CLIENT_SECRET`.");
  }

  if (authBaseUrlValue) {
    try {
      authBaseUrl = normalizeBaseUrl(authBaseUrlValue);
      authBaseUrlSource = "env";
    } catch {
      issues.push("`QF_AUTH_BASE_URL` is not a valid URL.");
    }
  }

  if (apiBaseUrlValue) {
    try {
      apiBaseUrl = normalizeBaseUrl(apiBaseUrlValue);
      apiBaseUrlSource = "env";
    } catch {
      issues.push("`QF_API_BASE_URL` is not a valid URL.");
    }
  }

  const authIsPrelive = isPreliveUrl(authBaseUrl);
  const apiIsPrelive = isPreliveUrl(apiBaseUrl);

  if (authIsPrelive !== apiIsPrelive) {
    issues.push(
      "Quran Foundation auth/content URLs are mixed between prelive and production."
    );
  }

  if (environment === "prelive" && (!authIsPrelive || !apiIsPrelive)) {
    issues.push(
      "`QF_ENV=prelive` requires both Quran Foundation base URLs to point at prelive hosts."
    );
  }

  if (environment === "production" && (authIsPrelive || apiIsPrelive)) {
    issues.push(
      "`QF_ENV=production` requires both Quran Foundation base URLs to point at production hosts."
    );
  }

  return {
    environment,
    environmentConfigured,
    clientIdPresent: Boolean(clientId),
    clientSecretPresent: Boolean(clientSecret),
    authBaseUrl,
    apiBaseUrl,
    authBaseUrlSource,
    apiBaseUrlSource,
    maskedClientId: maskClientId(clientId),
    issues,
    isReady: issues.length === 0,
  };
}

export function getQuranFoundationConfig(): QuranFoundationConfig {
  const status = getQuranFoundationConfigStatus();

  if (!status.isReady) {
    throw new QuranConfigurationError(status.issues);
  }

  return {
    environment: status.environment,
    clientId: process.env.QF_CLIENT_ID!.trim(),
    clientSecret: process.env.QF_CLIENT_SECRET!.trim(),
    authBaseUrl: status.authBaseUrl,
    apiBaseUrl: status.apiBaseUrl,
  };
}
