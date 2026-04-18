import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import { listLocalFriendDirectory } from "@/lib/social/friends";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function GET() {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  try {
    const directory = await listLocalFriendDirectory(session.player_id);

    return NextResponse.json(
      {
        total: directory.friends.length,
        friends: directory.friends,
        incomingRequests: directory.incomingRequests,
        outgoingRequests: directory.outgoingRequests,
      },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load friends.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
