import { NextResponse } from "next/server";
import { getUsableSession } from "@/lib/qf-user/session";
import {
  deleteInvitationById,
  getInvitationById,
} from "@/lib/social/invitations";
import { invokeSupabaseEdgeFunction } from "@/lib/multiplayer/server";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const { id } = await context.params;

  try {
    const invitation = await getInvitationById(id);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.invitee_qf_user_id !== session.user.sub) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.status !== "pending") {
      await deleteInvitationById(id);
      return NextResponse.json(
        { error: "This invitation has already been handled." },
        { status: 400 }
      );
    }

    const room = Array.isArray(invitation.rooms) ? invitation.rooms[0] : invitation.rooms;
    if (room.status !== "lobby") {
      await deleteInvitationById(id);
      return NextResponse.json(
        { error: "This room is no longer accepting players." },
        { status: 400 }
      );
    }

    await invokeSupabaseEdgeFunction("join-room", {
      player_id: session.player_id,
      room_code: room.code,
    });

    await deleteInvitationById(id);

    return NextResponse.json(
      { success: true, roomCode: room.code },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to accept invitation.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
