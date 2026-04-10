import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/qf-user/config";
import {
  clearLoginTransactionCookie,
  createSessionFromTokenResponse,
  readLoginTransactionCookie,
  writeSessionCookie,
} from "@/lib/qf-user/session";
import { exchangeAuthorizationCode } from "@/lib/qf-user/oidc";

function buildLoginRedirect(message: string) {
  const url = new URL("/login", getAppBaseUrl());
  url.searchParams.set("error", message);
  return url;
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get("error");
  const oauthErrorDescription =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error_details");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (oauthError) {
    const message = oauthErrorDescription
      ? `${oauthError}: ${oauthErrorDescription}`
      : oauthError;
    return NextResponse.redirect(buildLoginRedirect(message));
  }

  if (!code || !state) {
    return NextResponse.redirect(buildLoginRedirect("Missing authorization code or state."));
  }

  const txn = await readLoginTransactionCookie();
  if (!txn) {
    return NextResponse.redirect(buildLoginRedirect("Login session expired. Please try again."));
  }

  if (txn.state !== state) {
    const response = NextResponse.redirect(buildLoginRedirect("Returned state did not match."));
    clearLoginTransactionCookie(response.cookies);
    return response;
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: txn.code_verifier,
    });

    const session = await createSessionFromTokenResponse(tokens, txn.nonce);
    const redirectUrl = new URL(txn.redirect_to || "/", getAppBaseUrl());
    const response = NextResponse.redirect(redirectUrl);

    await writeSessionCookie(response.cookies, session);
    clearLoginTransactionCookie(response.cookies);

    return response;
  } catch (error) {
    const response = NextResponse.redirect(
      buildLoginRedirect(
        error instanceof Error ? error.message : "Authentication failed."
      )
    );
    clearLoginTransactionCookie(response.cookies);
    return response;
  }
}
