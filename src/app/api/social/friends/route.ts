import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import {
  getCurrentUserProfile,
  getQfFollowing,
  QfUserApiError,
} from "@/lib/qf-user/user-api";
import { serializeSocialUser } from "@/lib/social/qf-users";

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
    const profile = await getCurrentUserProfile(session);
    const friends = await getQfFollowing(session, profile.id, { limit: 20, page: 1 });

    return NextResponse.json(
      {
        profile: serializeSocialUser(profile),
        total: friends.total,
        data: friends.data.map(serializeSocialUser),
      },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    const status = error instanceof QfUserApiError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load friends.",
      },
      { status, headers: cookieCarrier.headers }
    );
  }
}
