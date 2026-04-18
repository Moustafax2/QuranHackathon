import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUsableSession } from "@/lib/qf-user/session";
import { listAcceptedFriendQfUserIds } from "@/lib/social/friends";
import {
  createGameInvitations,
  listIncomingInvitationsForQfUser,
  listOutgoingInvitationsForPlayer,
  type InvitationRecipientInput,
} from "@/lib/social/invitations";

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
    const [incoming, outgoing] = await Promise.all([
      listIncomingInvitationsForQfUser(session.user.sub),
      listOutgoingInvitationsForPlayer(session.player_id),
    ]);

    return NextResponse.json(
      { incoming, outgoing },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load invitations.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieCarrier = new NextResponse();
  const session = await getUsableSession(cookieCarrier.cookies);
  if (!session) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        roomCode?: string;
        invitees?: Array<{
          id?: string;
          displayName?: string;
          username?: string | null;
          avatarUrl?: string | null;
        }>;
      }
    | null;

  const roomCode = body?.roomCode?.trim().toUpperCase();
  if (!roomCode || !body?.invitees?.length) {
    return NextResponse.json(
      { error: "roomCode and invitees are required." },
      { status: 400 }
    );
  }

  const recipients: InvitationRecipientInput[] = body.invitees
    .filter((invitee) => Boolean(invitee?.id && invitee.displayName))
    .filter((invitee) => invitee.id !== session.user.sub)
    .map((invitee) => ({
      qfUserId: invitee.id as string,
      displayName: invitee.displayName as string,
      username: invitee.username ?? null,
      avatarUrl: invitee.avatarUrl ?? null,
    }));

  if (!recipients.length) {
    return NextResponse.json(
      { error: "At least one valid invitee is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const roomResponse = await supabase
    .from("rooms")
    .select("id, code, host_id, status")
    .eq("code", roomCode)
    .maybeSingle();

  if (roomResponse.error) {
    return NextResponse.json({ error: roomResponse.error.message }, { status: 500 });
  }

  if (!roomResponse.data) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (roomResponse.data.host_id !== session.player_id) {
    return NextResponse.json(
      { error: "Only the room host can invite friends." },
      { status: 403 }
    );
  }

  if (roomResponse.data.status !== "lobby") {
    return NextResponse.json(
      { error: "Invites can only be sent while the room is in the lobby." },
      { status: 400 }
    );
  }

  try {
    const acceptedFriendIds = await listAcceptedFriendQfUserIds(session.player_id);
    const invalidRecipients = recipients.filter(
      (recipient) => !acceptedFriendIds.has(recipient.qfUserId)
    );

    if (invalidRecipients.length) {
      return NextResponse.json(
        { error: "You can only invite users who are already on your friends list." },
        { status: 403, headers: cookieCarrier.headers }
      );
    }

    const invitations = await createGameInvitations({
      roomId: roomResponse.data.id,
      inviterPlayerId: session.player_id,
      recipients,
    });

    return NextResponse.json(
      {
        created: invitations.length,
      },
      { headers: cookieCarrier.headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create invitations.",
      },
      { status: 500, headers: cookieCarrier.headers }
    );
  }
}
