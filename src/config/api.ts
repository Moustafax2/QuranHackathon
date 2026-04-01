export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_QURAN_API_URL || "https://api.quran.com/api/v4",
  authBaseUrl:
    process.env.NEXT_PUBLIC_QURAN_AUTH_API_URL ||
    "https://apis.quran.foundation/content/api/v4",
  useAuth: process.env.NEXT_PUBLIC_USE_AUTH_API === "true",
} as const;

export function getBaseUrl(): string {
  return API_CONFIG.useAuth ? API_CONFIG.authBaseUrl : API_CONFIG.baseUrl;
}
