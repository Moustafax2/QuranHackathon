import "server-only";

import { cookies } from "next/headers";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { getQfSessionSecret } from "./config";
import { refreshAccessToken, verifyIdToken } from "./oidc";
import type {
  QfLoginTransaction,
  QfSession,
  QfSessionSummary,
  QfTokenResponse,
} from "./types";
import { upsertPlayerFromQfUser } from "./user-profile";

const SESSION_COOKIE = "qf_session";
const TXN_COOKIE = "qf_login_txn";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const TXN_TTL_SECONDS = 60 * 15;
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function getAesKey() {
  const secret = getQfSessionSecret();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptValue<T>(value: T): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(payload);
}

async function decryptValue<T>(value: string): Promise<T | null> {
  try {
    const bytes = fromBase64Url(value);
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await getAesKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    return null;
  }
}

function getCookieSecurityOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function writeEncryptedCookie(
  cookieStore: ResponseCookies,
  name: string,
  value: unknown,
  maxAge: number
) {
  cookieStore.set(name, await encryptValue(value), getCookieSecurityOptions(maxAge));
}

export function clearQfCookies(cookieStore: ResponseCookies) {
  cookieStore.set(SESSION_COOKIE, "", { ...getCookieSecurityOptions(0), maxAge: 0 });
  cookieStore.set(TXN_COOKIE, "", { ...getCookieSecurityOptions(0), maxAge: 0 });
}

export function clearLoginTransactionCookie(cookieStore: ResponseCookies) {
  cookieStore.set(TXN_COOKIE, "", { ...getCookieSecurityOptions(0), maxAge: 0 });
}

export async function writeLoginTransactionCookie(
  cookieStore: ResponseCookies,
  txn: QfLoginTransaction
) {
  await writeEncryptedCookie(cookieStore, TXN_COOKIE, txn, TXN_TTL_SECONDS);
}

export async function readLoginTransactionCookie(): Promise<QfLoginTransaction | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TXN_COOKIE)?.value;
  if (!raw) return null;
  return decryptValue<QfLoginTransaction>(raw);
}

export async function writeSessionCookie(cookieStore: ResponseCookies, session: QfSession) {
  await writeEncryptedCookie(cookieStore, SESSION_COOKIE, session, SESSION_TTL_SECONDS);
}

export async function readSessionCookie(): Promise<QfSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decryptValue<QfSession>(raw);
}

export function isSessionRefreshNeeded(session: QfSession): boolean {
  return session.expires_at - Date.now() <= REFRESH_WINDOW_MS;
}

export async function createSessionFromTokenResponse(
  tokens: QfTokenResponse,
  nonce: string
): Promise<QfSession> {
  if (!tokens.id_token) {
    throw new Error("Quran Foundation response did not include id_token.");
  }

  const verifiedUser = await verifyIdToken(tokens.id_token, nonce);
  const player = await upsertPlayerFromQfUser(verifiedUser);

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    id_token: tokens.id_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    user: verifiedUser,
    player_id: player.id,
  };
}

export async function refreshSession(session: QfSession): Promise<QfSession> {
  if (!session.refresh_token) {
    throw new Error("No refresh token available.");
  }

  const refreshed = await refreshAccessToken(session.refresh_token);
  const verifiedUser = refreshed.id_token
    ? await verifyIdToken(refreshed.id_token)
    : session.user;
  const player = await upsertPlayerFromQfUser({
    ...session.user,
    ...verifiedUser,
  });

  return {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? session.refresh_token,
    id_token: refreshed.id_token ?? session.id_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    user: {
      ...session.user,
      ...verifiedUser,
    },
    player_id: player.id,
  };
}

export async function getSessionSummary(): Promise<QfSessionSummary> {
  const session = await readSessionCookie();
  if (!session) {
    return {
      isAuthenticated: false,
      user: null,
      player: null,
    };
  }

  const player = await upsertPlayerFromQfUser(session.user);

  return {
    isAuthenticated: true,
    user: session.user,
    player: {
      id: player.id,
      display_name: player.display_name,
      avatar_url: player.avatar_url,
      total_points: player.total_points,
      total_wins: player.total_wins,
    },
  };
}

export async function getUsableSession(
  cookieStore?: ResponseCookies
): Promise<QfSession | null> {
  const session = await readSessionCookie();
  if (!session) return null;

  if (!isSessionRefreshNeeded(session)) {
    return session;
  }

  try {
    const refreshed = await refreshSession(session);
    if (cookieStore) {
      await writeSessionCookie(cookieStore, refreshed);
    }
    return refreshed;
  } catch {
    if (cookieStore) {
      clearQfCookies(cookieStore);
    }
    return null;
  }
}
