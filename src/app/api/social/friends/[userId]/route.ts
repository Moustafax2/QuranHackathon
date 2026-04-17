import { NextRequest, NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { QfUserApiError, toggleQfFollowUser } from "@/lib/qf-user/user-api";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { action?: "follow" | "unfollow" }
    | null;

  try {
    const result = await toggleQfFollowUser(session, userId, body?.action);
    return NextResponse.json(result, { headers: cookieCarrier.headers });
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update follow status.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}
