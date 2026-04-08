import "server-only";

export function isDevAuthEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_AUTH === "true";
}
