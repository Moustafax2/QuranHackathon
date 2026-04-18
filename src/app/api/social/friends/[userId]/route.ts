import { NextRequest, NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import {
  acceptLocalFriend,
  cancelLocalFriendRequest,
  declineLocalFriend,
  removeLocalFriend,
  requestLocalFriend,
} from "@/lib/social/friends";

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
    | { action?: "request" | "accept" | "decline" | "cancel" | "remove" }
    | null;

  try {
    const action = body?.action ?? "request";
    const result =
      action === "accept"
        ? await acceptLocalFriend(session.player_id, userId)
        : action === "decline"
          ? await declineLocalFriend(session.player_id, userId)
          : action === "cancel"
            ? await cancelLocalFriendRequest(session.player_id, userId)
            : action === "remove"
              ? await removeLocalFriend(session.player_id, userId)
              : await requestLocalFriend(session.player_id, userId);

    return NextResponse.json(result, { headers: cookieCarrier.headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update friendship.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
