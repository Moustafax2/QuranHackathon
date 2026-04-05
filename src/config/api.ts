import "server-only";

const QURAN_FOUNDATION_ENVIRONMENTS = {
  prelive: {
    authBaseUrl: "https://prelive-oauth2.quran.foundation",
    apiBaseUrl: "https://apis-prelive.quran.foundation",
  },
  production: {
    authBaseUrl: "https://oauth2.quran.foundation",
    apiBaseUrl: "https://apis.quran.foundation",
  },
} as const;

export type QuranFoundationEnvironment =
  keyof typeof QURAN_FOUNDATION_ENVIRONMENTS;

export interface QuranFoundationConfig {
  environment: QuranFoundationEnvironment;
  authBaseUrl: string;
  apiBaseUrl: string;
  contentApiBaseUrl: string;
  clientId: string;
  clientSecret: string;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveEnvironment(): QuranFoundationEnvironment {
  const value = process.env.QF_ENV?.trim().toLowerCase();

  if (!value) {
    return "prelive";
  }

  if (value !== "prelive" && value !== "production") {
    throw new Error(
      `Unsupported QF_ENV "${process.env.QF_ENV}". Use "prelive" or "production".`
    );
  }

  return value;
}

function detectConfiguredEnvironment(
  url: string
): QuranFoundationEnvironment | "unknown" {
  if (
    url.includes("prelive-oauth2.quran.foundation") ||
    url.includes("apis-prelive.quran.foundation")
  ) {
    return "prelive";
  }

  if (
    url.includes("oauth2.quran.foundation") ||
    url.includes("apis.quran.foundation")
  ) {
    return "production";
  }

  return "unknown";
}

function validateEnvironment(
  environment: QuranFoundationEnvironment,
  authBaseUrl: string,
  apiBaseUrl: string
) {
  const authEnvironment = detectConfiguredEnvironment(authBaseUrl);
  const apiEnvironment = detectConfiguredEnvironment(apiBaseUrl);

  if (authEnvironment !== "unknown" && authEnvironment !== environment) {
    throw new Error(
      `QF_AUTH_BASE_URL (${authBaseUrl}) does not match QF_ENV=${environment}.`
    );
  }

  if (apiEnvironment !== "unknown" && apiEnvironment !== environment) {
    throw new Error(
      `QF_API_BASE_URL (${apiBaseUrl}) does not match QF_ENV=${environment}.`
    );
  }

  if (
    authEnvironment !== "unknown" &&
    apiEnvironment !== "unknown" &&
    authEnvironment !== apiEnvironment
  ) {
    throw new Error(
      "Quran Foundation auth and API base URLs must both point to the same environment."
    );
  }
}

function getRequiredEnvVar(name: "QF_CLIENT_ID" | "QF_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and add your Quran Foundation credentials.`
    );
  }

  return value;
}

export function getQuranFoundationConfig(): QuranFoundationConfig {
  const environment = resolveEnvironment();
  const defaults = QURAN_FOUNDATION_ENVIRONMENTS[environment];
  const authBaseUrl = normalizeBaseUrl(
    process.env.QF_AUTH_BASE_URL?.trim() || defaults.authBaseUrl
  );
  const apiBaseUrl = normalizeBaseUrl(
    process.env.QF_API_BASE_URL?.trim() || defaults.apiBaseUrl
  );

  validateEnvironment(environment, authBaseUrl, apiBaseUrl);

  return {
    environment,
    authBaseUrl,
    apiBaseUrl,
    contentApiBaseUrl: `${apiBaseUrl}/content/api/v4`,
    clientId: getRequiredEnvVar("QF_CLIENT_ID"),
    clientSecret: getRequiredEnvVar("QF_CLIENT_SECRET"),
  };
}
