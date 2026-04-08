import { NextResponse } from "next/server";
import { getAppBaseUrl, getQfDiscoveryDocument } from "@/lib/qf-user/config";
import { clearQfCookies, readSessionCookie } from "@/lib/qf-user/session";

async function buildLogoutUrl() {
  const discovery = await getQfDiscoveryDocument();
  if (!discovery.end_session_endpoint) {
    return null;
  }

  const session = await readSessionCookie();
  const logoutUrl = new URL(discovery.end_session_endpoint);
  if (session?.id_token) {
    logoutUrl.searchParams.set("id_token_hint", session.id_token);
  }
  logoutUrl.searchParams.set("post_logout_redirect_uri", getAppBaseUrl());
  return logoutUrl;
}

async function handleLogout() {
  const logoutUrl = await buildLogoutUrl();
  const response = NextResponse.redirect(logoutUrl ?? new URL("/", getAppBaseUrl()));
  clearQfCookies(response.cookies);
  return response;
}

export async function POST() {
  return handleLogout();
}

export async function GET() {
  return handleLogout();
}
